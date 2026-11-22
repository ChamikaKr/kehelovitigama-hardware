import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Printer,
  RefreshCw,
  Search,
  TrendingUp,
  CalendarRange,
} from "lucide-react";
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

type DateFilter = "all" | "today" | "month" | "last7" | "last30" | "custom";

const PAGE_SIZE = 1000;
const money = (value: number) =>
  `LKR ${Number(value || 0).toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function colomboDateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  });
}

function localDateOffset(days: number) {
  const now = new Date();
  const key = colomboDateKey(now);
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

const inputStyle: React.CSSProperties = {
  minHeight: 40,
  border: "1px solid #dfe3e8",
  borderRadius: 8,
  padding: "8px 11px",
  background: "#fff",
  color: "#252a30",
  fontSize: 13,
};

export default function SalesHistory() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [dateFrom, setDateFrom] = useState(localDateOffset(0));
  const [dateTo, setDateTo] = useState(localDateOffset(0));

  async function loadSales() {
    setLoading(true);
    setError("");
    try {
      const allSales: Sale[] = [];
      let from = 0;

      while (true) {
        const { data, error: loadError } = await supabase
          .from("sales")
          .select(
            "id, sale_number, total_amount, notes, created_at, sale_items(id, product_id, quantity, unit_price, line_total, products(name, name_si, sku))"
          )
          .order("created_at", { ascending: false })
          .range(from, from + PAGE_SIZE - 1);

        if (loadError) throw loadError;

        const rows = (data ?? []) as unknown as Sale[];
        allSales.push(...rows);
        if (rows.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      setSales(allSales);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load sales.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSales();
  }, []);

  const todayKey = colomboDateKey(new Date());
  const monthKey = todayKey.slice(0, 7);

  const todaySales = useMemo(
    () => sales.filter((sale) => colomboDateKey(sale.created_at) === todayKey),
    [sales, todayKey]
  );
  const monthSales = useMemo(
    () => sales.filter((sale) => colomboDateKey(sale.created_at).startsWith(monthKey)),
    [sales, monthKey]
  );

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();
    const start = dateFilter === "today"
      ? todayKey
      : dateFilter === "month"
        ? `${monthKey}-01`
        : dateFilter === "last7"
          ? localDateOffset(-6)
          : dateFilter === "last30"
            ? localDateOffset(-29)
            : dateFilter === "custom"
              ? dateFrom
              : "";

    const end = dateFilter === "today"
      ? todayKey
      : dateFilter === "month"
        ? todayKey
        : dateFilter === "last7" || dateFilter === "last30"
          ? todayKey
          : dateFilter === "custom"
            ? dateTo
            : "9999-12-31";

    return sales.filter((sale) => {
      const saleDate = colomboDateKey(sale.created_at);
      const inDateRange = (!start || saleDate >= start) && saleDate <= end;
      const matchesSearch =
        !term ||
        [
          sale.sale_number,
          sale.notes || "",
          saleDate,
        ].join(" ").toLowerCase().includes(term) ||
        sale.sale_items.some((item) =>
          [
            item.products?.name || "",
            item.products?.name_si || "",
            item.products?.sku || "",
          ].join(" ").toLowerCase().includes(term)
        );
      return inDateRange && matchesSearch;
    });
  }, [sales, search, dateFilter, dateFrom, dateTo, todayKey, monthKey]);

  const filteredTotal = filteredSales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0
  );

  function printSale(sale: Sale) {
    setExpanded(sale.id);
    window.setTimeout(() => window.print(), 100);
  }

  return (
    <div className="history-page">
      <div className="history-heading">
        <div>
          <h1>Sales History</h1>
          <p>Review sales performance, filter transactions and reprint receipts.</p>
        </div>
        <button className="history-refresh" onClick={() => void loadSales()} disabled={loading}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <section
        aria-label="Sales summaries"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 14,
          margin: "18px 0",
        }}
      >
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}><span>Today's Sales</span><CalendarDays size={18} /></div>
          <strong style={summaryValueStyle}>{loading ? "Loading..." : money(todaySales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0))}</strong>
          <span style={summaryHintStyle}>{todaySales.length} transaction(s) today</span>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}><span>This Month's Sales</span><CalendarRange size={18} /></div>
          <strong style={summaryValueStyle}>{loading ? "Loading..." : money(monthSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0))}</strong>
          <span style={summaryHintStyle}>{monthSales.length} transaction(s) this month</span>
        </div>
        <div style={summaryCardStyle}>
          <div style={summaryLabelStyle}><span>Filtered Sales</span><TrendingUp size={18} /></div>
          <strong style={summaryValueStyle}>{loading ? "Loading..." : money(filteredTotal)}</strong>
          <span style={summaryHintStyle}>{filteredSales.length} transaction(s) in current view</span>
        </div>
      </section>

      <section
        aria-label="Sales filters"
        style={{
          background: "#fff",
          border: "1px solid #e7e9ec",
          borderRadius: 10,
          padding: 14,
          marginBottom: 16,
          display: "grid",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          {([
            ["all", "All dates"],
            ["today", "Today"],
            ["month", "This month"],
            ["last7", "Last 7 days"],
            ["last30", "Last 30 days"],
            ["custom", "Custom range"],
          ] as [DateFilter, string][]).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setDateFilter(value)}
              aria-pressed={dateFilter === value}
              style={{
                ...filterButtonStyle,
                background: dateFilter === value ? "#252a30" : "#fff",
                color: dateFilter === value ? "#fff" : "#424a53",
                borderColor: dateFilter === value ? "#252a30" : "#dfe3e8",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {dateFilter === "custom" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "end" }}>
            <label style={dateLabelStyle}>
              From
              <input type="date" value={dateFrom} max={dateTo} onChange={(event) => setDateFrom(event.target.value)} style={inputStyle} />
            </label>
            <label style={dateLabelStyle}>
              To
              <input type="date" value={dateTo} min={dateFrom} onChange={(event) => setDateTo(event.target.value)} style={inputStyle} />
            </label>
          </div>
        )}
        <div className="history-toolbar" style={{ margin: 0 }}>
          <div className="history-search">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search sale reference, product or date..."
            />
          </div>
          <span>{filteredSales.length} {filteredSales.length === 1 ? "sale" : "sales"}</span>
        </div>
      </section>

      {error && <div className="history-error">Could not load sales: {error}</div>}

      {loading ? (
        <div className="history-empty">Loading sales...</div>
      ) : filteredSales.length === 0 ? (
        <div className="history-empty">
          <CalendarDays size={25} />
          <strong>No sales found</strong>
          <span>{search || dateFilter !== "all" ? "Try another date range or search term." : "Completed sales will appear here."}</span>
        </div>
      ) : (
        <div className="history-list">
          {filteredSales.map((sale) => {
            const isOpen = expanded === sale.id;
            return (
              <section className="history-card" key={sale.id}>
                <button className="history-card-summary" onClick={() => setExpanded(isOpen ? null : sale.id)}>
                  <div className="history-sale-main">
                    <strong>{sale.sale_number}</strong>
                    <span>{dateLabel(sale.created_at)}</span>
                  </div>
                  <div className="history-sale-total">
                    <strong>{money(Number(sale.total_amount))}</strong>
                    <span>{sale.sale_items.length} {sale.sale_items.length === 1 ? "line item" : "line items"}</span>
                  </div>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {isOpen && (
                  <div className="history-details" id={`history-receipt-${sale.id}`}>
                    <div className="history-receipt-head">
                      <h2>Kehelovitigama Hardware</h2>
                      <p>Sales Receipt</p>
                      <span>{sale.sale_number} · {dateLabel(sale.created_at)}</span>
                    </div>
                    <div className="history-items">
                      {sale.sale_items.map((item) => (
                        <div className="history-item" key={item.id}>
                          <div>
                            <strong>{item.products?.name || "Product"}</strong>
                            {item.products?.name_si && <small>{item.products.name_si}</small>}
                            <small>{item.products?.sku || ""} · {Number(item.quantity)} × {money(Number(item.unit_price))}</small>
                          </div>
                          <strong>{money(Number(item.line_total))}</strong>
                        </div>
                      ))}
                    </div>
                    {sale.notes && <p className="history-notes">Note: {sale.notes}</p>}
                    <div className="history-grand-total">
                      <span>Total</span>
                      <strong>{money(Number(sale.total_amount))}</strong>
                    </div>
                    <div className="history-actions">
                      <button onClick={() => printSale(sale)}><Printer size={15} /> Print receipt</button>
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

const summaryCardStyle: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e7e9ec",
  borderRadius: 10,
  padding: "17px 18px",
  display: "grid",
  gap: 9,
  minWidth: 0,
};

const summaryLabelStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  color: "#68717b",
  fontSize: 13,
  fontWeight: 600,
};

const summaryValueStyle: React.CSSProperties = {
  color: "#20252b",
  fontSize: 21,
  lineHeight: 1.3,
  overflowWrap: "anywhere",
};

const summaryHintStyle: React.CSSProperties = {
  color: "#87909a",
  fontSize: 12,
};

const filterButtonStyle: React.CSSProperties = {
  border: "1px solid #dfe3e8",
  borderRadius: 7,
  padding: "8px 12px",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const dateLabelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  color: "#59636e",
  fontSize: 12,
  fontWeight: 600,
};
