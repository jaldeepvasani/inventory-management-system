"use client";

import { useEffect, useState, useCallback } from "react";

interface Product {
  id: number;
  name: string;
  price: number;
  stockQuantity: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5089/api";

export default function InventoryDashboard() {
  const [products, setProducts] = useState<Product[]>([]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("");
  const [loading, setLoading] = useState(false);

  // Wrapped in useCallback so it is stable across renders
  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error("Failed to load inventory:", err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        const res = await fetch(`${API_BASE}/products`);
        if (res.ok && isMounted) {
          const data = await res.json();
          setProducts(data);
        }
      } catch (err) {
        console.error("Failed to load inventory:", err);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  const addProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: parseFloat(price),
          stockQuantity: parseInt(stock),
        }),
      });
      if (res.ok) {
        setName("");
        setPrice("");
        setStock("");
        fetchProducts();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleStockChange = async (id: number, change: number) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(change),
      });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error("Stock update failed:", err);
    }
  };

  const deleteProduct = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, { method: "DELETE" });
      if (res.ok) fetchProducts();
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  return (
    <main className="max-w-5xl mx-auto p-8 font-sans">
      <h1 className="text-3xl font-bold mb-6 text-slate-800">
        📦 Inventory Management Dashboard
      </h1>

      {/* Product Entry Form */}
      <form onSubmit={addProduct} className="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 bg-slate-100 rounded-lg mb-8 shadow-sm">
        <input
          type="text"
          placeholder="Product Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="p-2 border border-slate-300 rounded focus:outline-blue-500 bg-white text-slate-800"
        />
        <input
          type="number"
          step="0.01"
          placeholder="Price (€)"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          required
          className="p-2 border border-slate-300 rounded focus:outline-blue-500 bg-white text-slate-800"
        />
        <input
          type="number"
          placeholder="Stock Quantity"
          value={stock}
          onChange={(e) => setStock(e.target.value)}
          required
          className="p-2 border border-slate-300 rounded focus:outline-blue-500 bg-white text-slate-800"
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded p-2 transition disabled:opacity-50"
        >
          {loading ? "Adding..." : "+ Add Product"}
        </button>
      </form>

      {/* Inventory Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-800 text-white text-sm">
            <tr>
              <th className="p-3">ID</th>
              <th className="p-3">Name</th>
              <th className="p-3">Price</th>
              <th className="p-3">Stock Level</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  No products in inventory. Add one above!
                </td>
              </tr>
            ) : (
              products.map((p) => (
                <tr key={p.id} className="border-b hover:bg-slate-50 text-sm">
                  <td className="p-3 font-mono font-medium text-slate-600">#{p.id}</td>
                  <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                  <td className="p-3 text-slate-700">€{p.price.toFixed(2)}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        p.stockQuantity < 5
                          ? "bg-red-100 text-red-700"
                          : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {p.stockQuantity} units
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      type="button"
                      onClick={() => handleStockChange(p.id, 1)}
                      className="px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-xs font-medium transition"
                    >
                      + Restock
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStockChange(p.id, -1)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded text-xs font-medium transition"
                    >
                      - Sell
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProduct(p.id)}
                      className="px-2.5 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium transition"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}