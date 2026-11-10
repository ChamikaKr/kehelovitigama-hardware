import { useEffect, useMemo, useState } from "react";
import {
  Search, Plus, Minus, Trash2, ShoppingCart, RefreshCw,
  Printer, AlertTriangle, X
} from "lucide-react";
import { supabase } from "./supabase";
import "./SalesManagement.css";

type ProductRow = {
  id: string;
  sku: string;
  name: string;
  name_si: string | null;
  size: string | null;
  variant: string | null;
  unit: string;
  selling_price: number;
  stock_quantity: number;
};

type CartItem = ProductRow & {
  quantity: number;
  unitPrice: string;
};

type SaleResult = {
  sale_id: string;
  sale_number: string;
  total_amount: number;
};

function money(value: number) {
  return `LKR ${value.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function SalesManagement() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"quick" | "multi">("quick");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const [completedSale, setCompletedSale] = useState<SaleResult | null>(null);
  const [receiptItems, setReceiptItems] = useState<CartItem[]>([]);

  async function loadProducts() {
    setLoading(true);
    setError("");
    const { data, error: loadError } = await supabase
      .from("products")
      .select("id, sku, name, name_si, size, variant, unit, selling_price, stock_quantity")
      .eq("is_active", true)
      .order("name");

    if (loadError) {
      setError(loadError.message);
    } else {
      setProducts((data || []) as ProductRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products.slice(0, 30);
    return products.filter((product) =>
      [
        product.name, product.name_si || "", product.sku,
        product.size || "", product.variant || ""
      ].join(" ").toLowerCase().includes(term)
    ).slice(0, 40);
  }, [products, search]);

  const total = cart.reduce(
    (sum, item) => sum + item.quantity * Number(item.unitPrice || 0),
    0
  );

  function addProduct(product: ProductRow) {
    setError("");
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...current,
        { ...product, quantity: 1, unitPrice: String(product.selling_price ?? "") },
      ];
    });
    if (mode === "quick") setSearch("");
  }

  function updateItem(id: string, changes: Partial<CartItem>) {
    setCart((current) =>
      current.map((item) => item.id === id ? { ...item, ...changes } : item)
    );
  }

  function removeItem(id: string) {
    setCart((current) => current.filter((item) => item.id !== id));
  }

  function resetSale() {
    setCart([]);
    setSearch("");
    setNotes("");
    setCompletedSale(null);
    setReceiptItems([]);
    setError("");
  }

  async function completeSale() {
    setError("");
    if (cart.length === 0) {
      setError("Add at least one product to the sale.");
      return;
    }

    for (const item of cart) {
      const price = Number(item.unitPrice);
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
        setError(`Enter a valid quantity for ${item.name}.`);
        return;
      }
      if (!Number.isFinite(price) || price <= 0) {
        setError(`A selling price greater than zero is required for ${item.name}.`);
        return;
      }
    }

    setSaving(true);
    const payload = cart.map((item) => ({
      product_id: item.id,
      quantity: item.quantity,
      unit_price: Number(item.unitPrice),
    }));

    const { data, error: saleError } = await supabase.rpc("process_sale", {
      p_items: payload,
      p_notes: notes.trim() || null,
    });

    setSaving(false);

    if (saleError) {
      setError(saleError.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.sale_id || !result?.sale_number) {
      setError("The sale was submitted, but its confirmation could not be read. Please check Sales before retrying.");
      return;
    }

    setReceiptItems([...cart]);
    setCompletedSale({
      sale_id: result.sale_id,
      sale_number: result.sale_number,
      total_amount: Number(result.total_amount),
    });
    setCart([]);
    setNotes("");
    await loadProducts();
  }

  if (completedSale) {
    return (
      <div className="sales-page">
        <div className="sales-heading no-print">
          <div>
            <h1>Sale completed</h1>
            <p>The stock quantities and stock movement history have been updated.</p>
          </div>
          <button className="sales-secondary" onClick={resetSale}>
            <Plus size={16} /> New sale
          </button>
        </div>

        <section className="receipt-card" id="sale-receipt">
          <div className="receipt-brand">
            <h2>Kehelovitigama Hardware</h2>
            <p>Sales Receipt</p>
          </div>
          <div className="receipt-meta">
            <span>Sale reference</span>
            <strong>{completedSale.sale_number}</strong>
            <span>Date</span>
            <strong>{new Date().toLocaleString("en-LK", { timeZone: "Asia/Colombo" })}</strong>
          </div>
          <div className="receipt-lines">
            {receiptItems.map((item, index) => (
              <div className="receipt-line" key={`${item.id}-${index}`}>
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.quantity} × {money(Number(item.unitPrice))}</small>
                </div>
                <strong>{money(item.quantity * Number(item.unitPrice))}</strong>
              </div>
            ))}
          </div>
          <div className="receipt-total">
            <span>Total</span>
            <strong>{money(completedSale.total_amount)}</strong>
          </div>
          <p className="receipt-thanks">Thank you for your business.</p>
        </section>

        <div className="receipt-actions no-print">
          <button className="sales-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print receipt
          </button>
          <button className="sales-secondary" onClick={resetSale}>Start another sale</button>
        </div>
      </div>
    );
  }

  // Keep a copy of the last submitted cart for the receipt before clearing it.
  return (
    <div className="sales-page">
      <div className="sales-heading">
        <div>
          <h1>Sales / POS</h1>
          <p>Record a quick sale or add multiple products to one transaction.</p>
        </div>
        <button className="sales-secondary" onClick={loadProducts} disabled={loading}>
          <RefreshCw size={15} /> Refresh products
        </button>
      </div>

      <div className="sales-mode-switch">
        <button className={mode === "quick" ? "selected" : ""} onClick={() => setMode("quick")}>
          Quick sale
        </button>
        <button className={mode === "multi" ? "selected" : ""} onClick={() => setMode("multi")}>
          Multi-item sale
        </button>
      </div>

      {error && (
        <div className="sales-error" role="alert">
          <AlertTriangle size={17} /> <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button>
        </div>
      )}

      <div className="sales-layout">
        <section className="sales-panel product-picker">
          <div className="sales-panel-title">
            <div>
              <h2>Add products</h2>
              <p>Search by product name or SKU.</p>
            </div>
            <span className="product-count">{products.length} products</span>
          </div>

          <div className="sales-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product name or SKU..."
            />
            {search && <button onClick={() => setSearch("")} aria-label="Clear search"><X size={15} /></button>}
          </div>

          {loading ? (
            <div className="sales-empty">Loading products...</div>
          ) : filteredProducts.length === 0 ? (
            <div className="sales-empty">No matching products found.</div>
          ) : (
            <div className="product-results">
              {filteredProducts.map((product) => (
                <button className="product-result" key={product.id} onClick={() => addProduct(product)}>
                  <span className="product-result-main">
                    <strong>{product.name}</strong>
                    {product.name_si && <small>{product.name_si}</small>}
                    <small>{product.sku}{product.size ? ` · ${product.size}` : ""}{product.variant ? ` · ${product.variant}` : ""}</small>
                  </span>
                  <span className="product-result-side">
                    <strong>{money(Number(product.selling_price))}</strong>
                    <small>Stock: {product.stock_quantity} {product.unit}</small>
                    <span className="add-product"><Plus size={14} /> Add</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="sales-panel cart-panel">
          <div className="sales-panel-title">
            <div>
              <h2><ShoppingCart size={18} /> Sale items</h2>
              <p>{cart.length} product{cart.length === 1 ? "" : "s"} selected</p>
            </div>
            {cart.length > 0 && <button className="clear-cart" onClick={() => setCart([])}>Clear</button>}
          </div>

          {cart.length === 0 ? (
            <div className="cart-empty">
              <ShoppingCart size={27} />
              <strong>No products added</strong>
              <span>Search and select products to begin.</span>
            </div>
          ) : (
            <div className="cart-items">
              {cart.map((item) => (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-top">
                    <div>
                      <strong>{item.name}</strong>
                      <small>{item.sku} · Available: {item.stock_quantity} {item.unit}</small>
                    </div>
                    <button className="remove-item" onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <div className="cart-controls">
                    <label>
                      Quantity
                      <span className="quantity-control">
                        <button onClick={() => updateItem(item.id, { quantity: Math.max(0.001, item.quantity - 1) })}><Minus size={13} /></button>
                        <input type="number" min="0.001" step="any" value={item.quantity} onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) })} />
                        <button onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })}><Plus size={13} /></button>
                      </span>
                    </label>
                    <label>
                      Unit price (LKR)
                      <input className="price-input" type="number" min="0.01" step="0.01" value={item.unitPrice} onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} />
                    </label>
                  </div>
                  {item.quantity > item.stock_quantity && (
                    <div className="negative-stock-warning">
                      <AlertTriangle size={14} />
                      Sale will leave negative stock ({item.stock_quantity - item.quantity} {item.unit}).
                    </div>
                  )}
                  <div className="cart-line-total">
                    <span>Line total</span>
                    <strong>{money(item.quantity * Number(item.unitPrice || 0))}</strong>
                  </div>
                </div>
              ))}
            </div>
          )}

          <label className="sales-notes">
            Notes (optional)
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Optional sale notes" />
          </label>

          <div className="sale-total-row">
            <span>Sale total</span>
            <strong>{money(total)}</strong>
          </div>
          <button className="sales-primary complete-sale" onClick={completeSale} disabled={saving || cart.length === 0}>
            {saving ? "Processing sale..." : "Complete sale"}
          </button>
          <p className="sale-footnote">Selling price is required for every item. Negative stock is allowed.</p>
        </section>
      </div>
    </div>
  );
}

