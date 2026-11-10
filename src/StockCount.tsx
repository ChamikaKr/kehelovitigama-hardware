import { useEffect, useMemo, useState } from "react";
import { ClipboardList, History, RefreshCw, Search, Save } from "lucide-react";
import { supabase } from "./supabase";
import "./StockCount.css";

type ProductRow = {
  id: string; sku: string; name: string; name_si: string | null;
  size: string | null; variant: string | null; unit: string;
  stock_quantity: number; category_id: string;
};
type CategoryRow = { id: string; name: string };
type CountHistoryRow = {
  id: string; product_id: string; quantity_change: number;
  quantity_before: number; quantity_after: number; reference: string;
  notes: string | null; created_at: string;
  products: { name: string; sku: string; unit: string } | null;
};

export default function StockCount() {
  const [tab, setTab] = useState<"count" | "history">("count");
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [history, setHistory] = useState<CountHistoryRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadProducts() {
    const [pr, cr] = await Promise.all([
      supabase.from("products").select("id, sku, name, name_si, size, variant, unit, stock_quantity, category_id").eq("is_active", true).order("name"),
      supabase.from("product_categories").select("id, name").eq("is_active", true).order("sort_order"),
    ]);
    if (pr.error) throw pr.error;
    if (cr.error) throw cr.error;
    setProducts((pr.data ?? []) as ProductRow[]);
    setCategories((cr.data ?? []) as CategoryRow[]);
  }

  async function loadHistory() {
    setHistoryLoading(true);
    const { data, error: queryError } = await supabase
      .from("stock_movements")
      .select("id, product_id, quantity_change, quantity_before, quantity_after, reference, notes, created_at, products(name, sku, unit)")
      .eq("movement_type", "adjustment")
      .eq("reference", "Physical Stock Count")
      .order("created_at", { ascending: false })
      .limit(500);
    if (queryError) setError(`Could not load count history: ${queryError.message}`);
    else setHistory((data ?? []) as unknown as CountHistoryRow[]);
    setHistoryLoading(false);
  }

  async function refreshAll() {
    setLoading(true); setError("");
    try { await loadProducts(); await loadHistory(); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load stock count data."); }
    setLoading(false);
  }

  useEffect(() => { void refreshAll(); }, []);

  const categoryNames = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((p) => {
      const categoryMatch = categoryFilter === "all" || p.category_id === categoryFilter;
      const text = [p.name, p.name_si ?? "", p.sku, p.size ?? "", p.variant ?? ""].join(" ").toLowerCase();
      return categoryMatch && (!term || text.includes(term));
    });
  }, [products, search, categoryFilter]);
  const filteredHistory = useMemo(() => {
    const term = search.trim().toLowerCase();
    return history.filter((row) => [row.products?.name ?? "", row.products?.sku ?? "", row.notes ?? ""].join(" ").toLowerCase().includes(term));
  }, [history, search]);

  async function saveCount(product: ProductRow) {
    const raw = drafts[product.id];
    if (raw === undefined || raw.trim() === "") { setError("Enter the physical quantity before saving."); return; }
    const quantity = Number(raw);
    if (!Number.isFinite(quantity) || quantity < 0) { setError("Physical quantity must be zero or greater."); return; }
    setSavingId(product.id); setError(""); setMessage("");
    const { data, error: rpcError } = await supabase.rpc("record_stock_count", {
      p_product_id: product.id,
      p_counted_quantity: quantity,
      p_notes: notes[product.id]?.trim() || null,
    });
    setSavingId(null);
    if (rpcError) { setError(`Could not save ${product.name}: ${rpcError.message}`); return; }
    const result = Array.isArray(data) ? data[0] : data;
    const previous = Number(result?.previous_quantity ?? product.stock_quantity);
    const difference = Number(result?.quantity_difference ?? quantity - previous);
    setProducts((current) => current.map((p) => p.id === product.id ? { ...p, stock_quantity: quantity } : p));
    setMessage(`${product.name}: count saved. Previous ${previous}, counted ${quantity}, difference ${difference > 0 ? "+" : ""}${difference} ${product.unit}. You can count it again anytime.`);
    setDrafts((current) => ({ ...current, [product.id]: "" }));
    await loadHistory();
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(value));
  }

  return (
    <div className="stock-count-page">
      <div className="stock-count-heading">
        <div><h1>Stock Count</h1><p>Record physical quantities, correct miscounts, and review every previous count.</p></div>
        <button className="sc-refresh" onClick={() => void refreshAll()} disabled={loading}><RefreshCw size={16} /> Refresh</button>
      </div>

      <div className="sc-summary">
        <div><span>Active products</span><strong>{products.length}</strong></div>
        <div><span>Count records</span><strong>{history.length}</strong></div>
        <div><span>Latest count records</span><strong>{Math.min(history.length, 500)}</strong></div>
      </div>

      <div className="sc-tabs">
        <button className={tab === "count" ? "active" : ""} onClick={() => { setTab("count"); setSearch(""); }}><ClipboardList size={16} /> New / Recount</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => { setTab("history"); setSearch(""); void loadHistory(); }}><History size={16} /> Count History</button>
      </div>

      <div className="sc-toolbar">
        <label className="sc-search"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === "count" ? "Search product name or SKU..." : "Search history by product or SKU..."} /></label>
        {tab === "count" && <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}><option value="all">All categories</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
      </div>

      {error && <div className="sc-alert sc-error">{error}</div>}
      {message && <div className="sc-alert sc-success">{message}</div>}

      {tab === "count" ? (
        loading ? <div className="sc-empty">Loading products...</div> : filteredProducts.length === 0 ? <div className="sc-empty"><ClipboardList size={24} /><strong>No products found</strong><span>Try another search or category.</span></div> :
        <div className="sc-list">{filteredProducts.map((product) => {
          const draft = drafts[product.id] ?? "";
          const diff = draft.trim() === "" || !Number.isFinite(Number(draft)) ? null : Number(draft) - Number(product.stock_quantity);
          return <article className="sc-product" key={product.id}>
            <div className="sc-product-info"><div className="sc-product-title">{product.name}</div>{product.name_si && <div className="sc-sinhala">{product.name_si}</div>}<div className="sc-meta">{product.sku} · {categoryNames.get(product.category_id) ?? "Uncategorised"}{product.size ? ` · ${product.size}` : ""}{product.variant ? ` · ${product.variant}` : ""}</div><div className="sc-current">Current system stock: <strong>{product.stock_quantity} {product.unit}</strong></div></div>
            <div className="sc-entry"><label>Physical count</label><input type="number" min="0" step="any" inputMode="decimal" value={draft} placeholder="Enter qty" onChange={(e) => setDrafts((s) => ({ ...s, [product.id]: e.target.value }))} /><input className="sc-note-input" value={notes[product.id] ?? ""} onChange={(e) => setNotes((s) => ({ ...s, [product.id]: e.target.value }))} placeholder="Optional note (e.g. recount)" />{diff !== null && <span className={`sc-difference ${diff > 0 ? "positive" : diff < 0 ? "negative" : "zero"}`}>{diff > 0 ? "+" : ""}{diff} difference</span>}<button onClick={() => void saveCount(product)} disabled={savingId === product.id}>{savingId === product.id ? "Saving..." : <><Save size={16} /> Save count</>}</button></div>
          </article>;
        })}</div>
      ) : historyLoading ? <div className="sc-empty">Loading count history...</div> : filteredHistory.length === 0 ? <div className="sc-empty"><History size={24} /><strong>No count history found</strong><span>Saved physical counts will appear here, including recounts.</span></div> :
        <div className="sc-history-list">{filteredHistory.map((row) => {
          const diff = Number(row.quantity_change);
          return <article className="sc-history-row" key={row.id}><div className="sc-history-main"><strong>{row.products?.name ?? "Product unavailable"}</strong><span>{row.products?.sku ?? row.product_id}</span><small>{formatDate(row.created_at)}</small>{row.notes && <p>{row.notes}</p>}</div><div className="sc-history-values"><div><span>Before</span><strong>{row.quantity_before}</strong></div><div><span>Counted</span><strong>{row.quantity_after}</strong></div><div><span>Difference</span><strong className={diff > 0 ? "positive" : diff < 0 ? "negative" : "zero"}>{diff > 0 ? "+" : ""}{diff} {row.products?.unit ?? ""}</strong></div></div></article>;
        })}</div>
      }
      <p className="sc-footnote">Every save creates a permanent history record, even when the counted quantity matches system stock. If a count was wrong, enter the corrected physical quantity and save again. Previous records are never overwritten.</p>
    </div>
  );
}
