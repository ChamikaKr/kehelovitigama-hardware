import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Plus, Trash2, RefreshCw, ShoppingCart, History, Save, Pencil, X } from "lucide-react";
import { supabase } from "./supabase";
import "./Purchases.css";

type ProductRow = { id: string; sku: string; name: string; name_en: string | null; name_si: string | null; unit: string; cost_price: number; stock_quantity: number };
type PurchaseRow = { id: string; purchase_number: string; supplier_name: string | null; supplier_invoice: string | null; purchase_date: string; total_amount: number; notes: string | null; created_at: string };
type PurchaseItemRow = { id: string; purchase_id: string; product_id: string; quantity: number; unit_cost: number; line_total: number; products: { name: string; sku: string; unit: string } | null };
type DraftLine = { productId: string; productQuery: string; quantity: string; unitCost: string };

const todayLocal = () => {
  const now = new Date();
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
};
const money = (value: number) => `LKR ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const blankLine = (): DraftLine => ({ productId: "", productQuery: "", quantity: "1", unitCost: "" });

export default function Purchases() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [items, setItems] = useState<PurchaseItemRow[]>([]);
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayLocal());
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<"new" | "history">("new");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [searchingLine, setSearchingLine] = useState<number | null>(null);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [editSupplier, setEditSupplier] = useState("");
  const [editInvoice, setEditInvoice] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState<Array<{ productId: string; quantity: string; unitCost: string }>>([]);
  const [editSaving, setEditSaving] = useState(false);

  async function refresh() {
    setLoading(true); setError("");
    try {
      const [pr, hr] = await Promise.all([
        supabase.from("products").select("id, sku, name, name_en, name_si, unit, cost_price, stock_quantity").eq("is_active", true).order("name"),
        supabase.from("purchases").select("id, purchase_number, supplier_name, supplier_invoice, purchase_date, total_amount, notes, created_at").order("created_at", { ascending: false }).limit(200),
      ]);
      if (pr.error) throw pr.error;
      if (hr.error) throw hr.error;
      setProducts((pr.data ?? []) as ProductRow[]);
      const purchaseRows = (hr.data ?? []) as PurchaseRow[];
      setPurchases(purchaseRows);
      if (purchaseRows.length) {
        const { data, error: itemError } = await supabase.from("purchase_items").select("id, purchase_id, product_id, quantity, unit_cost, line_total, products(name, sku, unit)").in("purchase_id", purchaseRows.map((p) => p.id));
        if (itemError) throw itemError;
        setItems((data ?? []) as unknown as PurchaseItemRow[]);
      } else setItems([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load purchase information.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  const total = useMemo(() => lines.reduce((sum, line) => {
    const q = Number(line.quantity); const c = Number(line.unitCost);
    return sum + (Number.isFinite(q) && q > 0 && Number.isFinite(c) && c >= 0 ? Math.round(q * c * 100) / 100 : 0);
  }, 0), [lines]);
  const selectedIds = lines.map((line) => line.productId).filter(Boolean);

  function updateLine(index: number, patch: Partial<DraftLine>) {
    setLines((current) => current.map((line, i) => i === index ? { ...line, ...patch } : line));
    setError(""); setMessage("");
  }
  function chooseProduct(index: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    updateLine(index, { productId, productQuery: product?.name ?? "", unitCost: product ? String(Number(product.cost_price ?? 0)) : "" });
    setSearchingLine(null);
  }

  async function savePurchase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    const validLines = lines.map((line) => ({ product_id: line.productId, quantity: Number(line.quantity), unit_cost: Number(line.unitCost) }));
    if (!validLines.length || validLines.some((line) => !line.product_id || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isFinite(line.unit_cost) || line.unit_cost < 0)) {
      setError("Select a product and enter a valid quantity and unit purchase cost for every line."); return;
    }
    if (new Set(validLines.map((line) => line.product_id)).size !== validLines.length) {
      setError("A product appears more than once. Combine its quantities into one line."); return;
    }
    setSaving(true);
    try {
      const { data, error: rpcError } = await supabase.rpc("process_purchase", {
        p_supplier_name: supplier.trim() || null,
        p_supplier_invoice: invoice.trim() || null,
        p_purchase_date: purchaseDate,
        p_notes: notes.trim() || null,
        p_items: validLines,
      });
      if (rpcError) throw rpcError;
      const result = Array.isArray(data) ? data[0] : data;
      const purchaseNumber = result?.purchase_number ?? result?.purchaseNumber;
      setMessage(purchaseNumber ? `Purchase ${purchaseNumber} recorded successfully.` : "Purchase recorded successfully. Stock and latest purchase costs have been updated.");
      setSupplier(""); setInvoice(""); setPurchaseDate(todayLocal()); setNotes(""); setLines([blankLine()]);
      await refresh();
      setTab("history");
    } catch (e) {
      setError(e instanceof Error ? `Could not record purchase: ${e.message}` : "Could not record purchase.");
    } finally { setSaving(false); }
  }

  function startEditingPurchase(purchase: PurchaseRow, purchaseItems: PurchaseItemRow[]) {
    setError("");
    setMessage("");
    setEditingPurchaseId(purchase.id);
    setEditSupplier(purchase.supplier_name ?? "");
    setEditInvoice(purchase.supplier_invoice ?? "");
    setEditDate(purchase.purchase_date);
    setEditNotes(purchase.notes ?? "");
    setEditLines(purchaseItems.map((item) => ({
      productId: item.product_id,
      quantity: String(item.quantity),
      unitCost: String(item.unit_cost),
    })));
  }

  function cancelEditingPurchase() {
    setEditingPurchaseId(null);
    setEditLines([]);
    setEditSaving(false);
  }

  async function savePurchaseCorrection(purchaseId: string) {
    setError("");
    setMessage("");
    const validLines = editLines.map((line) => ({
      product_id: line.productId,
      quantity: Number(line.quantity),
      unit_cost: Number(line.unitCost),
    }));
    if (!validLines.length || validLines.some((line) =>
      !line.product_id || !Number.isFinite(line.quantity) || line.quantity <= 0 ||
      !Number.isFinite(line.unit_cost) || line.unit_cost < 0
    )) {
      setError("Enter a valid quantity and unit cost for every purchase item.");
      return;
    }
    if (new Set(validLines.map((line) => line.product_id)).size !== validLines.length) {
      setError("Duplicate products are not allowed in a purchase.");
      return;
    }
    setEditSaving(true);
    try {
      const { error: rpcError } = await supabase.rpc("update_purchase", {
        p_purchase_id: purchaseId,
        p_supplier_name: editSupplier.trim() || null,
        p_supplier_invoice: editInvoice.trim() || null,
        p_purchase_date: editDate,
        p_notes: editNotes.trim() || null,
        p_items: validLines,
      });
      if (rpcError) throw rpcError;
      setMessage("Purchase updated. Stock differences were recorded in stock movement history.");
      cancelEditingPurchase();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? `Could not update purchase: ${e.message}` : "Could not update purchase.");
    } finally {
      setEditSaving(false);
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(`${value}T00:00:00+05:30`));
  }
  function formatDateTime(value: string) {
    return new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" }).format(new Date(value));
  }

  return <div className="purchases-page">
    <div className="purchases-heading"><div><h1>Purchases</h1><p>Record supplier invoices and receive stock into inventory.</p></div><button className="purchase-refresh" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16}/> Refresh</button></div>
    <div className="purchase-summary"><div><span>Products available</span><strong>{products.length}</strong></div><div><span>Purchase records</span><strong>{purchases.length}</strong></div><div><span>Recent purchase value</span><strong>{money(purchases.reduce((s, p) => s + Number(p.total_amount || 0), 0))}</strong></div></div>
    <div className="purchase-tabs"><button className={tab === "new" ? "active" : ""} onClick={() => setTab("new")}><Plus size={16}/> New Purchase</button><button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><History size={16}/> Purchase History</button></div>
    {error && <div className="purchase-alert error">{error}</div>}{message && <div className="purchase-alert success">{message}</div>}
    {tab === "new" ? <form className="purchase-form" onSubmit={savePurchase}>
      <section className="purchase-panel"><div className="purchase-panel-title"><div><h2>Supplier & Invoice Details</h2><p>Enter the details shown on the supplier's bill.</p></div></div>
        <div className="purchase-meta-grid"><label>Supplier name<input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. Supplier / Distributor"/></label><label>Supplier invoice number<input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="Invoice number (optional)"/></label><label>Purchase date<input type="date" required value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}/></label><label className="purchase-notes">Notes<textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this purchase"/></label></div>
      </section>
      <section className="purchase-panel"><div className="purchase-panel-title"><div><h2>Purchased Items</h2><p>Enter the received quantity and unit cost from the invoice.</p></div><button type="button" className="purchase-add-line" onClick={() => setLines((current) => [...current, blankLine()])}><Plus size={15}/> Add item</button></div>
        {loading ? <p className="purchase-loading">Loading products...</p> : products.length === 0 ? <p className="purchase-loading">No active products found. Add products in Stock & Inventory first.</p> : <div className="purchase-lines">{lines.map((line, index) => {
          const product = products.find((p) => p.id === line.productId); const qty = Number(line.quantity); const cost = Number(line.unitCost); const lineTotal = Number.isFinite(qty * cost) ? qty * cost : 0;
          const searchTerm = line.productQuery.trim().toLocaleLowerCase();
          const matches = searchTerm.length >= 1 ? products.filter((p) => {
            const searchable = [p.name, p.name_en ?? "", p.name_si ?? ""].join(" ").toLocaleLowerCase();
            return searchable.includes(searchTerm) && (p.id === line.productId || !selectedIds.includes(p.id));
          }).slice(0, 8) : [];
          return <div className="purchase-line" key={index}><label className="purchase-product-select"><span>Product name</span><div className="purchase-product-search"><input required autoComplete="off" value={line.productQuery} placeholder="Search product name..." onFocus={() => setSearchingLine(index)} onBlur={() => setSearchingLine(null)} onChange={(e) => { updateLine(index, { productQuery: e.target.value, productId: "", unitCost: "" }); setSearchingLine(index); }}/>{searchingLine === index && matches.length > 0 && <div className="purchase-product-results">{matches.map((p) => <button type="button" key={p.id} onMouseDown={(e) => e.preventDefault()} onClick={() => chooseProduct(index, p.id)}><strong>{p.name}</strong><small>{p.name_en || p.name_si ? [p.name_en, p.name_si].filter(Boolean).join(" · ") + " · " : ""}SKU: {p.sku} · {p.unit}</small></button>)}</div>}{searchingLine === index && searchTerm.length > 0 && matches.length === 0 && <div className="purchase-product-results purchase-product-no-results">No matching products found</div>}</div>{product && <small>SKU: {product.sku} · Current stock: {product.stock_quantity} {product.unit} · Latest cost: {money(Number(product.cost_price))}</small>}{!product && line.productQuery && <small>Select a product from the search results.</small>}</label><label><span>Quantity</span><input required type="number" min="0.001" step="0.001" value={line.quantity} onChange={(e) => updateLine(index, { quantity: e.target.value })}/></label><label><span>Unit cost (LKR)</span><input required type="number" min="0" step="0.01" value={line.unitCost} onChange={(e) => updateLine(index, { unitCost: e.target.value })}/></label><div className="purchase-line-total"><span>Line total</span><strong>{money(lineTotal)}</strong></div><button type="button" className="purchase-remove-line" aria-label="Remove item" disabled={lines.length === 1} onClick={() => { setLines((current) => current.filter((_, i) => i !== index)); setSearchingLine(null); }}><Trash2 size={17}/></button></div>;
        })}</div>}
        <div className="purchase-total"><span>Purchase total</span><strong>{money(total)}</strong></div>
      </section>
      <div className="purchase-form-footer"><p>Saving this purchase increases stock and updates each product's latest purchase cost. The transaction is retained in purchase history.</p><button type="submit" disabled={saving || loading || products.length === 0}><Save size={17}/>{saving ? "Recording purchase..." : "Record Purchase"}</button></div>
    </form> : <section className="purchase-panel purchase-history-panel"><div className="purchase-panel-title"><div><h2>Purchase History</h2><p>Latest 200 recorded purchases.</p></div></div>{loading ? <p className="purchase-loading">Loading purchase history...</p> : purchases.length === 0 ? <div className="purchase-empty"><ShoppingCart size={28}/><strong>No purchases recorded yet</strong><span>Completed purchase receipts will appear here.</span></div> : <div className="purchase-history-list">{purchases.map((purchase) => { const purchaseItems = items.filter((item) => item.purchase_id === purchase.id); return <article className="purchase-history-card" key={purchase.id}><button className="purchase-history-top" type="button" onClick={() => setExpanded(expanded === purchase.id ? null : purchase.id)}><div><strong>{purchase.purchase_number}</strong><span>{purchase.supplier_name || "Supplier not specified"}{purchase.supplier_invoice ? ` · Invoice ${purchase.supplier_invoice}` : ""}</span><small>{formatDate(purchase.purchase_date)} · Recorded {formatDateTime(purchase.created_at)}</small></div><div className="purchase-history-amount"><strong>{money(Number(purchase.total_amount))}</strong><span>{purchaseItems.length} item(s)</span></div></button>{expanded === purchase.id && <div className="purchase-history-details">
          {editingPurchaseId === purchase.id ? <>
            <div className="purchase-edit-meta">
              <label>Supplier name<input value={editSupplier} onChange={(e) => setEditSupplier(e.target.value)} /></label>
              <label>Supplier invoice<input value={editInvoice} onChange={(e) => setEditInvoice(e.target.value)} /></label>
              <label>Purchase date<input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} /></label>
              <label className="purchase-edit-notes">Notes<textarea rows={2} value={editNotes} onChange={(e) => setEditNotes(e.target.value)} /></label>
            </div>
            <div className="purchase-edit-items">
              {purchaseItems.map((item, index) => <div className="purchase-edit-line" key={item.id}>
                <div className="purchase-edit-product"><strong>{item.products?.name ?? "Product unavailable"}</strong><small>{item.products?.sku ?? "—"} · {item.products?.unit ?? ""}</small></div>
                <label>Quantity<input type="number" min="0.001" step="0.001" value={editLines[index]?.quantity ?? ""} onChange={(e) => setEditLines((current) => current.map((line, i) => i === index ? { ...line, quantity: e.target.value } : line))} /></label>
                <label>Unit cost (LKR)<input type="number" min="0" step="0.01" value={editLines[index]?.unitCost ?? ""} onChange={(e) => setEditLines((current) => current.map((line, i) => i === index ? { ...line, unitCost: e.target.value } : line))} /></label>
                <strong>{money(Math.max(0, Number(editLines[index]?.quantity || 0)) * Math.max(0, Number(editLines[index]?.unitCost || 0)))}</strong>
              </div>)}
            </div>
            <div className="purchase-edit-actions">
              <p>Changing quantity adjusts current stock by the difference. The correction is recorded in stock movements.</p>
              <div><button type="button" onClick={cancelEditingPurchase} disabled={editSaving}><X size={15}/> Cancel</button><button type="button" onClick={() => void savePurchaseCorrection(purchase.id)} disabled={editSaving}><Save size={15}/>{editSaving ? "Saving..." : "Save changes"}</button></div>
            </div>
          </> : <>
            {purchaseItems.map((item) => <div key={item.id}><span>{item.products?.sku ?? "—"} · {item.products?.name ?? "Product unavailable"}</span><span>{item.quantity} {item.products?.unit ?? ""} × {money(Number(item.unit_cost))}</span><strong>{money(Number(item.line_total))}</strong></div>)}
            {purchase.notes && <p>Notes: {purchase.notes}</p>}
            <button type="button" className="purchase-edit-button" onClick={() => startEditingPurchase(purchase, purchaseItems)}><Pencil size={15}/> Edit purchase</button>
          </>}
        </div>}</article>; })}</div>}</section>}
  </div>;
}
