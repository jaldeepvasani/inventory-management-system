"use client";

import { useEffect, useState, useMemo, useSyncExternalStore } from "react";

interface Product {
  id: number;
  name: string;
  price: number;
  stockQuantity: number;
  lastModifiedBy: string;
  lastModifiedAt: string;
}

type Currency = "EUR" | "USD" | "GBP" | "INR";

// Initial fallbacks in case network is slow or offline
const DEFAULT_RATES: Record<Currency, { symbol: string; rate: number }> = {
  EUR: { symbol: "€", rate: 1.0 },
  USD: { symbol: "$", rate: 1.08 },
  GBP: { symbol: "£", rate: 0.85 },
  INR: { symbol: "₹", rate: 90.0 },
};

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "In what city were you born?",
  "What is your mother's maiden name?",
  "What was the model of your first car?",
  "What was your elementary school name?",
];

const PRESET_AVATARS = ["👨‍💻", "👩‍💻", "🦊", "🚀", "⚡", "📦", "💼", "🤖"];

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://inventory-management-system-zbt4.onrender.com/api";

const emptySubscribe = () => () => {};

export default function InventoryDashboard() {
  // Safe hydration check compliant with React 19 rules
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  // Dynamic Live Exchange Rates State
  const [rates, setRates] = useState(DEFAULT_RATES);

  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentAvatar, setCurrentAvatar] = useState<string>("👨‍💻");

  // Auth Navigation states: 'login' | 'register' | 'forgot_step1' | 'forgot_step2'
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot_step1" | "forgot_step2">("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState(SECURITY_QUESTIONS[0]);
  const [securityAnswer, setSecurityAnswer] = useState("");
  const [fetchedQuestion, setFetchedQuestion] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authSuccess, setAuthSuccess] = useState("");

  // Profile Modal State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [profileOldPassword, setProfileOldPassword] = useState("");
  const [profileNewPassword, setProfileNewPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [profileError, setProfileError] = useState("");
  const [showProfilePassword, setShowProfilePassword] = useState(false);

  // Products State
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

  // 1. Fetch Live Exchange Rates
  useEffect(() => {
    async function fetchLiveRates() {
      try {
        const res = await fetch("https://open.er-api.com/v6/latest/EUR");
        if (res.ok) {
          const data = await res.json();
          if (data && data.rates) {
            setRates({
              EUR: { symbol: "€", rate: 1.0 },
              USD: { symbol: "$", rate: data.rates.USD || 1.08 },
              GBP: { symbol: "£", rate: data.rates.GBP || 0.85 },
              INR: { symbol: "₹", rate: data.rates.INR || 90.0 },
            });
          }
        }
      } catch (err) {
        console.warn("Could not fetch live forex rates, using fallback rates.", err);
      }
    }

    fetchLiveRates();
  }, []);

  // 2. Initial Data & Session Restore
  useEffect(() => {
    let isSubscribed = true;

    async function init() {
      const savedUser = localStorage.getItem("inventory_user");
      const savedAvatar = localStorage.getItem("inventory_avatar");

      if (isSubscribed) {
        if (savedUser) setCurrentUser(savedUser);
        if (savedAvatar) setCurrentAvatar(savedAvatar);
      }

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
    if (!/[^A-Za-z0-9\s]/.test(pass)) return "Password must include at least one special character (!@#$%^&*...).";
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

    try {
      if (authMode === "register") {
        const res = await fetch(`${API_BASE}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: authUsername.trim(),
            password: authPassword,
            securityQuestion,
            securityAnswer: securityAnswer.trim(),
            avatarUrl: "👨‍💻",
          }),
        });

        if (!res.ok) throw new Error((await res.text()) || "Registration failed.");

        setAuthMode("login");
        setAuthPassword("");
        setSecurityAnswer("");
        setShowPassword(false);
        setAuthSuccess("Account created successfully! Please sign in.");
      } else if (authMode === "login") {
        const res = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: authUsername.trim(), password: authPassword }),
        });

        if (!res.ok) throw new Error((await res.text()) || "Invalid login credentials.");

        const data = await res.json();
        localStorage.setItem("inventory_user", data.username);
        if (data.avatarUrl) {
          localStorage.setItem("inventory_avatar", data.avatarUrl);
          setCurrentAvatar(data.avatarUrl);
        }
        setCurrentUser(data.username);
        setAuthUsername("");
        setAuthPassword("");
        setShowPassword(false);
        refreshInventory();
      }
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/get-question`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: authUsername.trim() }),
      });

      if (!res.ok) throw new Error((await res.text()) || "User not found.");

      const data = await res.json();
      setFetchedQuestion(data.question);
      setAuthMode("forgot_step2");
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Failed to retrieve user.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");

    const errorMsg = validatePasswordRules(newPassword);
    if (errorMsg) {
      setAuthError(errorMsg);
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: authUsername.trim(),
          securityAnswer: securityAnswer.trim(),
          newPassword,
        }),
      });

      if (!res.ok) throw new Error((await res.text()) || "Password reset failed.");

      setAuthMode("login");
      setAuthPassword("");
      setNewPassword("");
      setSecurityAnswer("");
      setShowPassword(false);
      setAuthSuccess("Password has been reset successfully! Please sign in.");
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError("");
    setProfileMsg("");

    const err = validatePasswordRules(profileNewPassword);
    if (err) {
      setProfileError(err);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUser,
          currentPassword: profileOldPassword,
          newPassword: profileNewPassword,
        }),
      });

      if (!res.ok) throw new Error((await res.text()) || "Password change failed.");

      setProfileMsg("Password successfully updated!");
      setProfileOldPassword("");
      setProfileNewPassword("");
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateAvatar = async (avatar: string) => {
    setCurrentAvatar(avatar);
    localStorage.setItem("inventory_avatar", avatar);
    try {
      await fetch(`${API_BASE}/auth/update-profile`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: currentUser, avatarUrl: avatar }),
      });
    } catch (err) {
      console.error("Avatar update error:", err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("inventory_user");
    localStorage.removeItem("inventory_avatar");
    setCurrentUser(null);
  };

  // Uses dynamic live rates
  const stats = useMemo(() => {
    const totalItems = products.length;
    const totalUnits = products.reduce((acc, p) => acc + p.stockQuantity, 0);
    const totalValueEur = products.reduce((acc, p) => acc + p.price * p.stockQuantity, 0);
    return {
      totalItems,
      totalUnits,
      totalValueConverted: totalValueEur * rates[currency].rate,
    };
  }, [products, currency, rates]);

  // Uses dynamic live rates
  const formatPrice = (basePriceEur: number) => {
    const converted = basePriceEur * rates[currency].rate;
    return `${rates[currency].symbol}${converted.toFixed(2)}`;
  };

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setLoading(true);

    const inputPrice = parseFloat(price);
    const basePriceEur = inputPrice / rates[currency].rate;

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
    setEditPrice((p.price * rates[currency].rate).toFixed(2));
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditName("");
    setEditPrice("");
  };

  const saveEdit = async (id: number, currentStock: number) => {
    if (!currentUser) return;
    const inputPrice = parseFloat(editPrice);
    const basePriceEur = inputPrice / rates[currency].rate;

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
        body: JSON.stringify({ change, username: currentUser }),
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

  if (!mounted) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="text-center">
          <span className="text-3xl animate-spin inline-block mb-3">📦</span>
          <p className="text-slate-500 text-sm font-medium">Loading portal...</p>
        </div>
      </main>
    );
  }

  // Unauthenticated View
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans text-slate-800">
        <div className="bg-white p-8 rounded-2xl shadow-md border border-slate-200 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">📦 Inventory Portal</h1>
            <p className="text-slate-500 text-sm mt-1">
              {authMode === "login" && "Sign in to manage inventory & track changes"}
              {authMode === "register" && "Create a new user account with security key"}
              {authMode === "forgot_step1" && "Reset Password - Step 1 of 2"}
              {authMode === "forgot_step2" && "Reset Password - Step 2 of 2"}
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

          {/* 1. Login & Register Form */}
          {(authMode === "login" || authMode === "register") && (
            <form onSubmit={handleAuth} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="e.g. jaldeep"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-600">Password</label>
                  {authMode === "login" && (
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot_step1");
                        setAuthError("");
                        setAuthSuccess("");
                      }}
                      className="text-xs text-blue-600 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {authMode === "register" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Security Question</label>
                    <select
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                    >
                      {SECURITY_QUESTIONS.map((q, idx) => (
                        <option key={idx} value={q}>{q}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Security Answer</label>
                    <input
                      type="text"
                      required
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      placeholder="Your secret answer (case-insensitive)"
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                    />
                  </div>

                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 space-y-1">
                    <p className="font-semibold text-slate-600">Password requirements:</p>
                    <ul className="list-disc pl-4 space-y-0.5">
                      <li className={authPassword.length >= 8 ? "text-emerald-600 font-medium" : ""}>At least 8 characters</li>
                      <li className={/[A-Z]/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>At least one uppercase letter (A-Z)</li>
                      <li className={/[0-9]/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>At least one number (0-9)</li>
                      <li className={/[^A-Za-z0-9\s]/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>At least one special character (!@#$%^&*...)</li>
                      <li className={authPassword && !/\s/.test(authPassword) ? "text-emerald-600 font-medium" : ""}>No spaces</li>
                    </ul>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-2.5 text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Processing..." : authMode === "login" ? "Sign In" : "Create Account"}
              </button>
            </form>
          )}

          {/* 2. Forgot Password Step 1 */}
          {authMode === "forgot_step1" && (
            <form onSubmit={handleFetchQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Enter Your Username</label>
                <input
                  type="text"
                  required
                  value={authUsername}
                  onChange={(e) => setAuthUsername(e.target.value)}
                  placeholder="Username registered on your account"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-2.5 text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Checking..." : "Continue"}
              </button>
            </form>
          )}

          {/* 3. Forgot Password Step 2 */}
          {authMode === "forgot_step2" && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-600 font-semibold uppercase tracking-wide">Security Question:</p>
                <p className="text-sm text-blue-900 font-medium mt-0.5">{fetchedQuestion}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Your Security Answer</label>
                <input
                  type="text"
                  required
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Enter the answer you set during registration"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter strong new password"
                    className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg p-2.5 text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Resetting..." : "Set New Password"}
              </button>
            </form>
          )}

          {/* Footer Auth Switcher */}
          <div className="mt-6 text-center text-xs text-slate-500">
            {authMode === "login" && (
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
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
                >
                  Register here
                </button>
              </span>
            )}
            {(authMode === "register" || authMode === "forgot_step1" || authMode === "forgot_step2") && (
              <span>
                Back to{" "}
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("login");
                    setAuthError("");
                    setAuthSuccess("");
                    setShowPassword(false);
                  }}
                  className="text-blue-600 font-semibold hover:underline cursor-pointer"
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

  // Authenticated Dashboard View
  return (
    <main className="max-w-6xl mx-auto p-6 md:p-10 font-sans text-slate-800">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            📦 Inventory Management
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Monitor stock levels, track valuations, and manage products.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Profile Button */}
          <button
            onClick={() => {
              setIsProfileOpen(true);
              setProfileError("");
              setProfileMsg("");
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg shadow-sm transition cursor-pointer"
          >
            <span className="text-lg">{currentAvatar}</span>
            <span className="text-xs font-semibold text-slate-700">@{currentUser}</span>
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">Settings</span>
          </button>

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

          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer"
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
            {rates[currency].symbol}{stats.totalValueConverted.toFixed(2)}
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
            placeholder={`Price in ${rates[currency].symbol}`}
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-2.5 text-sm transition disabled:opacity-50 cursor-pointer"
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
                            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition cursor-pointer"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md text-xs font-medium transition cursor-pointer"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => handleStockChange(p.id, 1)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-xs font-medium border border-slate-200 transition cursor-pointer"
                          >
                            + Restock
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStockChange(p.id, -1)}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md text-xs font-medium border border-amber-200 transition cursor-pointer"
                          >
                            - Sell
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditing(p)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-medium border border-blue-200 transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteProduct(p.id)}
                            className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded-md text-xs font-medium border border-red-200 transition cursor-pointer"
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

      {/* Profile & Settings Modal */}
      {isProfileOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900">User Profile Settings</h3>
              <button
                onClick={() => setIsProfileOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Profile Avatar Chooser */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-slate-600 mb-2">Choose Avatar</label>
              <div className="flex gap-2 flex-wrap">
                {PRESET_AVATARS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => handleUpdateAvatar(emoji)}
                    className={`text-2xl p-2 rounded-xl border transition cursor-pointer ${
                      currentAvatar === emoji ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Change Password Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Change Password</h4>

              {profileMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg">
                  ✓ {profileMsg}
                </div>
              )}

              {profileError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {profileError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Current Password</label>
                <input
                  type="password"
                  required
                  value={profileOldPassword}
                  onChange={(e) => setProfileOldPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showProfilePassword ? "text" : "password"}
                    required
                    value={profileNewPassword}
                    onChange={(e) => setProfileNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full p-2.5 pr-10 border border-slate-300 rounded-lg text-sm bg-white focus:outline-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowProfilePassword(!showProfilePassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  >
                    {showProfilePassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg p-2.5 text-sm transition disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}