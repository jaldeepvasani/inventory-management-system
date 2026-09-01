"use client";

import { useEffect, useState, useMemo } from "react";

interface Product {
  id: number;
  name: string;
  price: number;
  stockQuantity: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

type Currency = "EUR" | "USD" | "GBP" | "INR";

const CURRENCY_RATES: Record<Currency, { symbol: string; rate: number }> = {
  EUR: { symbol: "€", rate: 1.0 },
  USD: { symbol: "$", rate: 1.08 },
  GBP: { symbol: "£", rate: 0.85 },
  INR: { symbol: "₹", rate: 90.0 },
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://inventory-management-system-zbt4.onrender.com/api";

export default function InventoryDashboard() {
  const [currentUser, setCurrentUser] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("inventory_user");
    }
    return null;
  });

  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Product state
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [loading, setLoading] = useState(false);
  const [isServerWaking, setIsServerWaking] = useState(true);
  const [currency, setCurrency] = useState<Currency>("EUR");

  // Inline editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const refreshInventory = async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err: unknown) {
      console.error("Failed to load inventory:", err);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    async function init() {
      try {
        const res = await fetch(`${API_BASE}/products`);
        if (res.ok && isSubscribed) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (err: unknown) {
        if (isSubscribed) console.error("Initial load failed:", err);
      } finally {
        if (isSubscribed) setIsServerWaking(false);
      }
    }

    init();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const validatePasswordRules = (pass: string): string | null => {
    if (pass.length < 8) return "Password must be at least 8 characters.";
    if (/\s/.test(pass)) return "Password must not contain spaces.";
    if (!/[A-Z]/.test(pass)) return "Password must include at least one uppercase letter (A-Z).";
    if (!/[0-9]/.test(pass)) return "Password must include at least one number (0-9).";
    if (!/[^A-Za-z0-9]/.test(pass)) return "Password must include at least one special character (!@#$%^&*...).";
    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthSuccess("");

    if (authMode === "register") {
      const errorMsg = validatePasswordRules(authPassword);
      if (errorMsg) {
        setAuthError(errorMsg);
        return;
      }
    }

    setLoading(true);

    const endpoint = authMode === "login" ? `${API_BASE}/auth/login` : `${API_BASE}/auth/register`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Authentication failed.");
      }

      const data = await res.json();

      if (authMode === "register") {
        setAuthMode("login");
        setAuthPassword("");
        setShowPassword(false);
        setAuthSuccess("Account created successfully! Please sign in.");
      } else {
        localStorage.setItem("inventory_user", data.username);
        setCurrentUser(data.username);
        setAuthUsername("");
        setAuthPassword("");
        setShowPassword(false);
        refreshInventory();
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setAuthError(err.message);
      } else {
        setAuthError("An unexpected error occurred.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("inventory_user");
    setCurrentUser(null);
  };

  const stats = useMemo(() => {
    const totalItems = products.length;
    const totalUnits = products.reduce((acc, p) => acc + p.stockQuantity, 0);
    const totalValueEur = products.reduce((acc, p) => acc + p.price * p.stockQuantity, 0);
    return {
      totalItems,
      totalUnits,
      totalValueConverted: totalValueEur * CURRENCY_RATES[currency].rate,
    };
  }, [products, currency]);

  const formatPrice = (basePriceEur: number) => {
    const converted = basePriceEur * CURRENCY_RATES[currency].rate;
    return `${CURRENCY_RATES[currency].symbol}${converted.toFixed(2)}`;
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    const inputPrice = parseFloat(price);
    const basePriceEur = inputPrice / CURRENCY_RATES[currency].rate;

    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: basePriceEur,
          stockQuantity: parseInt(stock),
          lastModifiedBy: currentUser,
        }),
      });
      if (res.ok) {
        setName("");
        setPrice("");
        setStock("");
        refreshInventory();
      }
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (p: Product) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPrice((p.price * CURRENCY_RATES[currency].rate).toFixed(2));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
  };

  const saveEdit = async (id: number, currentStock: number) => {
    if (!currentUser) return;
    const inputPrice = parseFloat(editPrice);
    const basePriceEur = inputPrice / CURRENCY_RATES[currency].rate;

    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          name: editName,
          price: basePriceEur,
          stockQuantity: currentStock,
          lastModifiedBy: currentUser,
        }),
      });

      if (res.ok) {
        setEditingId(null);
        refreshInventory();
      }
    } catch (err: unknown) {
      console.error("Update failed:", err);
    }
  };

  const handleStockChange = async (id: number, change: number) => {
    if (!currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/products/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          change,
          username: currentUser,
        }),
      });
      if (res.ok) refreshInventory();
    } catch (err: unknown) {
      console.error("Stock update failed:", err);
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
      if (res.ok) refreshInventory();
    } catch (err: unknown) {
      console.error("Delete failed:", err);
    }
  };

  // Login / Register View
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">📦 Inventory Portal</h1>
            <p className="text-slate-500 text-sm mt-1">
              {authMode === "login" ? "Sign in to manage inventory & track changes" : "Create a new user profile"}
            </p>
          </div>

          {authSuccess && (
            <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
              ✓ {authSuccess}
            </div>
          )}

          {authError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Username</label>
              <input
                type="text"
                required
                value={authUsername}
                onChange={(e) => setAuthUsername(e.target.value)}
                placeholder="e.g. Muster"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    // Eye Slash (Hide Password)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  ) : (
                    // Eye (Show Password)
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {authMode === "register" && (
                <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1">
                  <p className="font-semibold text-slate-600">Password requirements:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li className={authPassword.length >= 8 ? "text-emerald-600 font-medium" : ""}>At least 8 characters</li>
                    <li className={/[A-Z]/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>At least one uppercase letter (A-Z)</li>
                    <li className={/[0-9]/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>At least one number (0-9)</li>
                    <li className={/[^A-Za-z0-9\s]/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>At least one special character (!@#$%^&*...)</li>
                    <li className={authPassword && !/\s/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>No spaces</li>
                  </ul>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-2.5 text-sm transition disabled:opacity-50"
            >
              {loading ? "Processing..." : authMode === "login" ? "Sign In" : "Create Account"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-slate-500">
            {authMode === "login" ? (
              <span>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("register");
                    setAuthError("");
                    setAuthSuccess("");
                    setShowPassword(false);
                  }}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Register here
                </button>
              </span>
            ) : (
              <span>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setAuthSuccess("");
                    setShowPassword(false);
                  }}
                  className="text-blue-600 font-semibold hover:underline"
                >
                  Sign in
                </button>
              </span>
            )}
          </div>
        </div>
      </main>
    );
  }

  // Main Dashboard View (Authenticated)
  return (
    <main className="max-w-6xl mx-auto p-6 md:p-10 font-sans text-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            📦 Inventory Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Active User: <span className="font-semibold text-blue-700">@{currentUser}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 p-2 rounded-lg shadow-sm">
            <label htmlFor="currency-select" className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Currency:
            </label>
            <select
              id="currency-select"
              value={currency}
              onChange={(e) => setCurrency(e.target.value as Currency)}
              className="font-medium text-slate-800 bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="EUR">EUR (€)</option>
              <option value="USD">USD ($)</option>
              <option value="GBP">GBP (£)</option>
              <option value="INR">INR (₹)</option>
            </select>
          </div>

          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition"
          >
            Sign Out
          </button>
        </div>
      </div>

      {isServerWaking && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
          <span className="animate-spin">⏳</span> Connecting to live API...
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Products</span>
          <p className="text-2xl font-bold text-slate-900 mt-1">{stats.totalItems} SKUs</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Stock Count</span>
          <p className="text-2xl font-bold text-blue-600 mt-1">{stats.totalUnits} Units</p>
        </div>
        <div className="bg-white border border-slate-200 p-5 rounded-xl shadow-sm">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Valuation</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {CURRENCY_RATES[currency].symbol}{stats.totalValueConverted.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Product Submission Form */}
      <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl mb-8 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600 mb-3">Add New Inventory Item</h2>
        <form onSubmit={addProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            placeholder="Product Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-blue-500"
          />
          <input
            type="number"
            step="0.01"
            placeholder={`Price in ${CURRENCY_RATES[currency].symbol}`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            className="p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-blue-500"
          />
          <input
            type="number"
            placeholder="Stock Quantity"
            value={stock}
            onChange={(e) => setStock(e.target.value)}
            required
            className="p-2.5 border border-slate-300 rounded-lg bg-white text-sm focus:outline-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-2.5 text-sm transition disabled:opacity-50"
          >
            {loading ? "Adding..." : "+ Add Product"}
          </button>
        </form>
      </div>

      {/* Inventory Table */}
      <div className="overflow-hidden border border-slate-200 rounded-xl bg-white shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider">
            <tr>
              <th className="p-4">ID</th>
              <th className="p-4">Product Name</th>
              <th className="p-4">Unit Price</th>
              <th className="p-4">Stock</th>
              <th className="p-4">Last Modified By</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  No stock items in inventory. Add one above to get started.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const isEditing = editingId === p.id;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4 font-mono font-medium text-slate-400 text-xs">#{p.id}</td>
                    <td className="p-4 font-semibold text-slate-800">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="p-1 border border-blue-400 rounded text-sm w-full"
                        />
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="p-4 font-medium text-slate-700">
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="p-1 border border-blue-400 rounded text-sm w-24"
                        />
                      ) : (
                        formatPrice(p.price)
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.stockQuantity < 5
                            ? "bg-red-50 text-red-700 border border-red-200"
                            : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        }`}
                      >
                        {p.stockQuantity} units
                      </span>
                    </td>
                    <td className="p-4 text-xs text-slate-500">
                      <span className="font-medium text-slate-700">@{p.lastModifiedBy || "System"}</span>
                    </td>
                    <td className="p-4 text-right space-x-1.5 whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={() => saveEdit(p.id, p.stockQuantity)}
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-medium transition"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStockChange(p.id, 1)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium border border-slate-200 transition"
                          >
                            + Restock
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStockChange(p.id, -1)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-xs font-medium border border-amber-200 transition"
                          >
                            - Sell
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(p)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-medium border border-blue-200 transition"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(p.id)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-md text-xs font-medium border border-red-200 transition"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}