"use client";

import { useEffect, useState, useMemo } from "react";

interface Product {
  id: number;
  name: string;
  price: number;
  stockQuantity: number;
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
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  };

  useEffect(() => {
    let isSubscribed = true;

    async function initialize() {
      try {
        const res = await fetch(`${API_BASE}/products`);
        if (res.ok && isSubscribed) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (err) {
        if (isSubscribed) {
          console.error("Failed to load inventory:", err);
        }
      } finally {
        if (isSubscribed) {
          setIsServerWaking(false);
        }
      }
    }

    initialize();

    return () => {
      isSubscribed = false;
    };
  }, []);

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
        }),
      });

      if (res.ok) {
        setEditingId(null);
        refreshInventory();
      }
    } catch (err) {
      console.error("Update failed:", err);
    }
  };

  const handleStockChange = async (id: number, change: number) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (res.ok) refreshInventory();
    } catch (err) {
      console.error("Stock update failed:", err);
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
      if (res.ok) refreshInventory();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <main className="max-w-6xl mx-auto p-6 md:p-10 font-sans text-slate-800">
      {/* Header & Currency Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            📦 Inventory Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor stock levels, track valuations, and manage products.
          </p>
        </div>

        {/* Currency Dropdown */}
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
      </div>

      {/* Backend Wake-up Notice */}
      {isServerWaking && (
        <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
          <span className="animate-spin">⏳</span> Connecting to live Render API (may take ~20s if waking up)...
        </div>
      )}

      {/* Summary KPI Cards */}
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
              <th className="p-4">Total Stock</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-slate-400">
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