import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Plus, Search, Pencil, RefreshCw, Truck, Save, X } from "lucide-react";
import { supabase } from "./supabase";
import "./SupplierManagement.css";

type PurchaseSupplierRow = { supplier_name: string | null; total_amount: number; purchase_date: string; created_at: string };
type SupplierProfile = { id: string; name: string; telephone: string | null; address: string | null; sales_rep_name: string | null; sales_rep_phone: string | null };
type SupplierSummary = { id?: string; name: string; telephone: string; address: string; salesRepName: string; salesRepPhone: string; purchaseCount: number; totalSpend: number; latestPurchaseDate: string; latestCreatedAt: string };
type SupplierForm = { name: string; telephone: string; address: string; salesRepName: string; salesRepPhone: string };

const PAGE_SIZE = 500;
const emptyForm: SupplierForm = { name: "", telephone: "", address: "", salesRepName: "", salesRepPhone: "" };
const money = (value: number) => `LKR ${value.toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value: string) => new Intl.DateTimeFormat("en-LK", { dateStyle: "medium", timeZone: "Asia/Colombo" }).format(new Date(`${value}T00:00:00+05:30`));

export default function SupplierManagement() {
  const [rows, setRows] = useState<PurchaseSupplierRow[]>([]);
  const [profiles, setProfiles] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const allRows: PurchaseSupplierRow[] = [];
      for (let start = 0; ; start += PAGE_SIZE) {
        const { data, error: loadError } = await supabase.from("purchases").select("supplier_name, total_amount, purchase_date, created_at").order("created_at", { ascending: false }).range(start, start + PAGE_SIZE - 1);
        if (loadError) throw loadError;
        const page = (data ?? []) as PurchaseSupplierRow[];
        allRows.push(...page);
        if (page.length < PAGE_SIZE) break;
      }
      const { data: profileData, error: profileError } = await supabase.from("suppliers").select("id, name, telephone, address, sales_rep_name, sales_rep_phone").order("name");
      if (profileError) throw profileError;
      setRows(allRows);
      setProfiles((profileData ?? []) as SupplierProfile[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load supplier information.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSuppliers(); }, [loadSuppliers]);

  const suppliers = useMemo(() => {
    const grouped = new Map<string, SupplierSummary>();
    for (const row of rows) {
      const name = row.supplier_name?.trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      const current = grouped.get(key);
      if (current) {
        current.purchaseCount += 1;
        current.totalSpend += Number(row.total_amount || 0);
        if (row.created_at > current.latestCreatedAt) {
          current.latestCreatedAt = row.created_at;
          current.latestPurchaseDate = row.purchase_date;
        }
      } else {
        grouped.set(key, { name, telephone: "", address: "", salesRepName: "", salesRepPhone: "", purchaseCount: 1, totalSpend: Number(row.total_amount || 0), latestPurchaseDate: row.purchase_date, latestCreatedAt: row.created_at });
      }
    }
    for (const profile of profiles) {
      const key = profile.name.trim().toLocaleLowerCase();
      const current = grouped.get(key);
      const details = { id: profile.id, name: profile.name, telephone: profile.telephone ?? "", address: profile.address ?? "", salesRepName: profile.sales_rep_name ?? "", salesRepPhone: profile.sales_rep_phone ?? "" };
      if (current) Object.assign(current, details);
      else grouped.set(key, { ...details, purchaseCount: 0, totalSpend: 0, latestPurchaseDate: "", latestCreatedAt: "" });
    }
    return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, rows]);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return term ? suppliers.filter((supplier) => [supplier.name, supplier.telephone, supplier.address, supplier.salesRepName, supplier.salesRepPhone].join(" ").toLocaleLowerCase().includes(term)) : suppliers;
  }, [search, suppliers]);
  const namedPurchaseCount = suppliers.reduce((sum, supplier) => sum + supplier.purchaseCount, 0);
  const totalSpend = suppliers.reduce((sum, supplier) => sum + supplier.totalSpend, 0);

  function openSupplierForm(supplier?: SupplierSummary) {
    setError("");
    setEditingId(supplier?.id ?? null);
    setForm(supplier ? { name: supplier.name, telephone: supplier.telephone, address: supplier.address, salesRepName: supplier.salesRepName, salesRepPhone: supplier.salesRepPhone } : emptyForm);
    setFormOpen(true);
  }

  async function saveSupplier(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) { setError("Enter the supplier name."); return; }
    setSaving(true);
    setError("");
    const payload = { name, telephone: form.telephone.trim() || null, address: form.address.trim() || null, sales_rep_name: form.salesRepName.trim() || null, sales_rep_phone: form.salesRepPhone.trim() || null };
    try {
      const result = editingId
        ? await supabase.from("suppliers").update(payload).eq("id", editingId).select("id, name, telephone, address, sales_rep_name, sales_rep_phone").single()
        : await supabase.from("suppliers").insert(payload).select("id, name, telephone, address, sales_rep_name, sales_rep_phone").single();
      if (result.error) throw result.error;
      const saved = result.data as SupplierProfile;
      setProfiles((current) => editingId ? current.map((profile) => profile.id === editingId ? saved : profile) : [...current, saved]);
      setFormOpen(false);
      setForm(emptyForm);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save supplier details.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="supplier-page">
    <div className="supplier-heading"><div><h1>Suppliers</h1><p>Keep supplier and sales representative contact details alongside purchase totals.</p></div><div className="supplier-heading-actions"><button type="button" className="supplier-refresh" onClick={() => void loadSuppliers()} disabled={loading}><RefreshCw size={16} className={loading ? "supplier-spinning" : ""} /> Refresh</button><button type="button" className="supplier-primary" onClick={() => openSupplierForm()}><Plus size={16} /> Add supplier</button></div></div>
    {error && <div className="supplier-error" role="alert">{error}</div>}
    <div className="supplier-summary"><div><span>Suppliers</span><strong>{suppliers.length}</strong></div><div><span>Purchases with a supplier</span><strong>{namedPurchaseCount}</strong></div><div><span>Total purchase value</span><strong>{money(totalSpend)}</strong></div></div>
    <section className="supplier-panel"><div className="supplier-panel-heading"><div><h2>Supplier List</h2><p>Supplier names from purchases appear here; add their contact details once.</p></div></div>
      <label className="supplier-search"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search suppliers or contacts" /></label>
      {loading ? <div className="supplier-empty">Loading suppliers...</div> : filteredSuppliers.length === 0 ? <div className="supplier-empty"><Truck size={26} /><strong>{suppliers.length === 0 ? "No suppliers recorded yet" : "No matching suppliers"}</strong><span>{suppliers.length === 0 ? "Record a purchase or add a supplier to start your list." : "Try a different search."}</span></div> : <div className="supplier-table-wrap"><table className="supplier-table"><thead><tr><th>Supplier</th><th>Telephone</th><th>Address</th><th>Sales representative</th><th>Rep telephone</th><th>Purchases</th><th>Total purchase value</th><th>Last purchase</th><th></th></tr></thead><tbody>{filteredSuppliers.map((supplier) => <tr key={supplier.name.toLocaleLowerCase()}><td><strong>{supplier.name}</strong></td><td>{supplier.telephone || "—"}</td><td>{supplier.address || "—"}</td><td>{supplier.salesRepName || "—"}</td><td>{supplier.salesRepPhone || "—"}</td><td>{supplier.purchaseCount}</td><td>{money(supplier.totalSpend)}</td><td>{supplier.latestPurchaseDate ? formatDate(supplier.latestPurchaseDate) : "—"}</td><td><button type="button" className="supplier-row-action" onClick={() => openSupplierForm(supplier)}><Pencil size={14} /> {supplier.id ? "Edit" : "Add details"}</button></td></tr>)}</tbody></table></div>}
    </section>
    {formOpen && <div className="supplier-modal-overlay" onMouseDown={() => !saving && setFormOpen(false)}><section className="supplier-modal" role="dialog" aria-modal="true" aria-labelledby="supplier-form-title" onMouseDown={(event) => event.stopPropagation()}><div className="supplier-modal-heading"><div><h2 id="supplier-form-title">{editingId ? "Edit supplier" : "Add supplier details"}</h2><p>Save contact information for future purchases.</p></div><button type="button" onClick={() => setFormOpen(false)} disabled={saving} aria-label="Close supplier form"><X size={18} /></button></div>
      <form onSubmit={(event) => void saveSupplier(event)}><label>Supplier name<input required value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} readOnly={Boolean(editingId)} /></label><label>Telephone number<input type="tel" value={form.telephone} onChange={(event) => setForm((current) => ({ ...current, telephone: event.target.value }))} placeholder="Supplier phone" /></label><label>Address<input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} placeholder="Optional supplier address" /></label><label>Sales representative name<input value={form.salesRepName} onChange={(event) => setForm((current) => ({ ...current, salesRepName: event.target.value }))} placeholder="Representative name" /></label><label>Sales representative telephone<input type="tel" value={form.salesRepPhone} onChange={(event) => setForm((current) => ({ ...current, salesRepPhone: event.target.value }))} placeholder="Representative phone" /></label>
        {error && <div className="supplier-error" role="alert">{error}</div>}<div className="supplier-modal-actions"><button type="button" onClick={() => setFormOpen(false)} disabled={saving}>Cancel</button><button type="submit" disabled={saving}><Save size={15} />{saving ? "Saving..." : "Save supplier"}</button></div>
      </form></section></div>}
  </div>;
}