import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronDown, ChevronUp, Printer, RefreshCw, Search } from "lucide-react";
import { supabase } from "./supabase";
import "./SalesHistory.css";

type SaleItem = {
  id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  products: { name: string; name_si: string | null; sku: string } | null;
};
type Sale = {
  id: string;
  sale_number: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  sale_items: SaleItem[];
};

const money = (value: number) => `LKR ${Number(value || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string) => new Date(value).toLocaleString("en-LK", { dateStyle: "medium", timeStyle: "short" });

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function loadSales() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("sales")
      .select("id, sale_number, total_amount, notes, created_at, sale_items(id, product_id, quantity, unit_price, line_total, products(name, name_si, sku))")
      .order("created_at", { ascending: false })
      .limit(500);
    if (loadError) setError(loadError.message);
    else setSales((data || []) as unknown as Sale[]);
    setLoading(false);
  }

  useEffect(() => { void loadSales(); }, []);

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sales;
    return sales.filter((sale) =>
      [sale.sale_number, sale.notes || "", new Date(sale.created_at).toLocaleDateString("en-CA")]
        .join(" ").toLowerCase().includes(term)
      || sale.sale_items.some((item) => [item.products?.name || "", item.products?.name_si || "", item.products?.sku || ""].join(" ").toLowerCase().includes(term))
    );
  }, [sales, search]);

  function printSale(sale: Sale) {
    setExpanded(sale.id);
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <div className="history-page">
      <div className="history-heading">
        <div><h1>Sales History</h1><p>Review previous sales and reprint receipts.</p></div>
        <button className="history-refresh" onClick={() => void loadSales()} disabled={loading}><RefreshCw size={15} /> Refresh</button>
      </div>
      <div className="history-toolbar">
        <div className="history-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search sale reference, product or date..." /></div>
        <span>{filteredSales.length} {filteredSales.length === 1 ? "sale" : "sales"}</span>
      </div>
      {error && <div className="history-error">Could not load sales: {error}</div>}
      {loading ? <div className="history-empty">Loading sales...</div> : filteredSales.length === 0 ? (
        <div className="history-empty"><CalendarDays size={25} /><strong>No sales found</strong><span>{search ? "Try a different search term." : "Completed sales will appear here."}</span></div>
      ) : (
        <div className="history-list">
          {filteredSales.map((sale) => {
            const isOpen = expanded === sale.id;
            return <section className="history-card" key={sale.id}>
              <button className="history-card-summary" onClick={() => setExpanded(isOpen ? null : sale.id)}>
                <div className="history-sale-main"><strong>{sale.sale_number}</strong><span>{dateLabel(sale.created_at)}</span></div>
                <div className="history-sale-total"><strong>{money(Number(sale.total_amount))}</strong><span>{sale.sale_items.length} {sale.sale_items.length === 1 ? "line item" : "line items"}</span></div>
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>
              {isOpen && <div className="history-details" id={`history-receipt-${sale.id}`}>
                <div className="history-receipt-head"><h2>Kehelovitigama Hardware</h2><p>Sales Receipt</p><span>{sale.sale_number} · {dateLabel(sale.created_at)}</span></div>
                <div className="history-items">
                  {sale.sale_items.map((item) => <div className="history-item" key={item.id}>
                    <div><strong>{item.products?.name || "Product"}</strong>{item.products?.name_si && <small>{item.products.name_si}</small>}<small>{item.products?.sku || ""} · {Number(item.quantity)} × {money(Number(item.unit_price))}</small></div>
                    <strong>{money(Number(item.line_total))}</strong>
                  </div>)}
                </div>
                {sale.notes && <p className="history-notes">Note: {sale.notes}</p>}
                <div className="history-grand-total"><span>Total</span><strong>{money(Number(sale.total_amount))}</strong></div>
                <div className="history-actions"><button onClick={() => printSale(sale)}><Printer size={15} /> Print receipt</button></div>
              </div>}
            </section>;
          })}
        </div>
      )}
    </div>
  );
}
