import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Filter,
  Pencil,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Upload,
  X,
  FileSpreadsheet,
} from "lucide-react";

import { supabase } from "./supabase";
import ProductDrawer, {
  type ProductDraft,
  type CategoryGroup,
} from "./ProductDrawer";
import "./Inventory.css";

type CategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
};

type DatabaseProduct = {
  id: string;
  sku: string;
  name: string;
  name_en: string | null;
  name_si: string | null;
  category_id: string;
  size: string | null;
  variant: string | null;
  brand: string | null;
  unit: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  minimum_stock: number;
  description: string | null;
};

type Product = ProductDraft & {
  id: string;
  categoryId: string;
};

type ImportRow = {
  sku: string;
  name: string;
  nameEn: string;
  nameSi: string;
  category: string;
  categoryId: string | null;
  size: string;
  variant: string;
  brand: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minimumStock: number;
  description: string;
  issue: string;
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function csvNumber(value: string) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : NaN;
}

function formatPrice(amount: number) {
  return `LKR ${amount.toLocaleString("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedMainCategoryId, setSelectedMainCategoryId] = useState<string | null>(null);
  const [selectedLeafCategoryId, setSelectedLeafCategoryId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("");
  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importError, setImportError] = useState("");

  // A category is selectable only when it has no active child categories.
  const leafCategories = useMemo(() => {
    const parentIds = new Set(
      categories
        .filter((category) => category.parent_id !== null)
        .map((category) => category.parent_id as string)
    );

    return categories.filter((category) => !parentIds.has(category.id));
  }, [categories]);

  const categoryNames = useMemo(
    () => leafCategories.map((category) => category.name),
    [leafCategories]
  );

  const mainCategories = useMemo(
    () => categories.filter((category) => category.parent_id === null),
    [categories]
  );

  const visibleSubcategories = useMemo(
    () =>
      selectedMainCategoryId
        ? categories.filter((category) => category.parent_id === selectedMainCategoryId)
        : [],
    [categories, selectedMainCategoryId]
  );

  // Native select optgroups display parent categories as non-selectable headings.
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const groups: CategoryGroup[] = [];
    const parentCategories = categories.filter((category) =>
      categories.some((child) => child.parent_id === category.id)
    );
    const groupedLeafIds = new Set<string>();

    for (const parent of parentCategories) {
      const children = categories.filter(
        (category) => category.parent_id === parent.id
      );
      const selectableChildren = children.filter((child) =>
        leafCategories.some((leaf) => leaf.id === child.id)
      );

      selectableChildren.forEach((child) => groupedLeafIds.add(child.id));

      if (selectableChildren.length > 0) {
        groups.push({
          label: parent.name,
          options: selectableChildren.map((child) => child.name),
        });
      }
    }

    const standaloneCategories = leafCategories.filter(
      (category) =>
        category.parent_id === null && !groupedLeafIds.has(category.id)
    );

    if (standaloneCategories.length > 0) {
      groups.push({
        label: "Other Categories",
        options: standaloneCategories.map((category) => category.name),
      });
    }

    // Keep leaf categories visible if their parent is inactive or unavailable.
    const orphanCategories = leafCategories.filter(
      (category) =>
        category.parent_id !== null &&
        !categories.some((parent) => parent.id === category.parent_id)
    );

    if (orphanCategories.length > 0) {
      groups.push({
        label: "Other Categories",
        options: orphanCategories.map((category) => category.name),
      });
    }

    return groups;
  }, [categories, leafCategories]);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [categoryResult, productResult] = await Promise.all([
        supabase
          .from("product_categories")
          .select("id, name, parent_id")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
        supabase
          .from("products")
          .select("*")
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (categoryResult.error) throw categoryResult.error;
      if (productResult.error) throw productResult.error;

      const categoryRows = (categoryResult.data ?? []) as CategoryRow[];
      const productRows = (productResult.data ?? []) as DatabaseProduct[];
      const categoryMap = new Map(
        categoryRows.map((category) => [category.id, category.name])
      );

      const mappedProducts: Product[] = productRows.map((row) => ({
        id: row.id,
        categoryId: row.category_id,
        sku: row.sku,
        name: row.name,
        nameEn: row.name_en ?? "",
        nameSi: row.name_si ?? "",
        category: categoryMap.get(row.category_id) ?? "Uncategorised",
        size: row.size ?? "",
        variant: row.variant ?? "",
        brand: row.brand ?? "",
        unit: row.unit,
        costPrice: Number(row.cost_price ?? 0),
        sellingPrice: Number(row.selling_price ?? 0),
        stock: Number(row.stock_quantity ?? 0),
        minimumStock: Number(row.minimum_stock ?? 0),
        description: row.description ?? "",
      }));

      setCategories(categoryRows);
      setProducts(mappedProducts);
    } catch (err) {
      console.error("Inventory loading error:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load inventory from Supabase."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchesCategory =
        selectedLeafCategoryId !== null
          ? product.categoryId === selectedLeafCategoryId
          : selectedMainCategoryId === null
            ? true
            : product.categoryId === selectedMainCategoryId ||
              categories.some(
                (category) =>
                  category.parent_id === selectedMainCategoryId &&
                  category.id === product.categoryId
              );

      const search = searchTerm.toLowerCase().trim();
      const searchableText = [
        product.name,
        product.nameEn,
        product.nameSi,
        product.sku,
        product.category,
        product.size,
        product.variant,
        product.brand,
      ].join(" ").toLowerCase();

      return matchesCategory && searchableText.includes(search);
    });
  }, [products, categories, selectedMainCategoryId, selectedLeafCategoryId, searchTerm]);

  const handleSaveProduct = async (draft: ProductDraft) => {
    const duplicateSku = products.some(
      (product) =>
        product.id !== selectedProduct?.id &&
        product.sku.trim().toLowerCase() === draft.sku.trim().toLowerCase()
    );

    if (duplicateSku) {
      setMessage("This product code already exists. Use a unique code.");
      return;
    }

    if (!draft.name.trim() && !draft.nameEn.trim() && !draft.nameSi.trim()) {
      setMessage("Please enter at least one product name.");
      return;
    }

    if (draft.sellingPrice < draft.costPrice) {
      const confirmed = window.confirm(
        "The selling price is lower than the purchase price. Do you want to continue?"
      );
      if (!confirmed) return;
    }

    const selectedCategoryRow = leafCategories.find(
      (category) => category.name === draft.category
    );

    if (!selectedCategoryRow) {
      setMessage("Please select a valid subcategory or standalone category.");
      return;
    }

    setSaving(true);
    setMessage("");

    const primaryName =
      draft.name.trim() || draft.nameEn.trim() || draft.nameSi.trim();

    const productPayload = {
      sku: draft.sku.trim(),
      name: primaryName,
      name_en: draft.nameEn.trim() || null,
      name_si: draft.nameSi.trim() || null,
      category_id: selectedCategoryRow.id,
      size: draft.size.trim() || null,
      variant: draft.variant.trim() || null,
      brand: draft.brand.trim() || null,
      unit: draft.unit,
      selling_price: draft.sellingPrice,
      minimum_stock: draft.minimumStock,
      description: draft.description.trim() || null,
    };

    try {
      if (selectedProduct) {
        const { data, error: updateError } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", selectedProduct.id)
          .select()
          .single();

        if (updateError) throw updateError;
        const updated = data as DatabaseProduct;
        const updatedProduct: Product = {
          ...draft,
          costPrice: Number(updated.cost_price ?? selectedProduct.costPrice),
          stock: Number(updated.stock_quantity ?? selectedProduct.stock),
          id: updated.id,
          categoryId: updated.category_id,
          name: updated.name,
          sku: updated.sku,
          category: draft.category,
        };

        setProducts((previous) =>
          previous.map((product) =>
            product.id === updatedProduct.id ? updatedProduct : product
          )
        );
        setMessage("Product updated successfully in Supabase.");
      } else {
        const { data, error: insertError } = await supabase
          .from("products")
          .insert({ ...productPayload, cost_price: 0, stock_quantity: 0 })
          .select()
          .single();

        if (insertError) throw insertError;
        const inserted = data as DatabaseProduct;
        const newProduct: Product = {
          ...draft,
          id: inserted.id,
          categoryId: inserted.category_id,
          name: inserted.name,
          sku: inserted.sku,
          category: draft.category,
        };

        setProducts((previous) => [...previous, newProduct]);
        setMessage("Product saved successfully to Supabase.");
      }

      // Keep the inventory focused on the category where the saved product belongs.
      // If the product was moved to another category while editing, navigate there.
      if (selectedCategoryRow.parent_id) {
        setSelectedMainCategoryId(selectedCategoryRow.parent_id);
        setSelectedLeafCategoryId(selectedCategoryRow.id);
      } else {
        setSelectedMainCategoryId(selectedCategoryRow.id);
        setSelectedLeafCategoryId(null);
      }

      // Clear the previous search so the newly added or updated product is visible.
      setSearchTerm("");
      setDrawerOpen(false);
      setSelectedProduct(null);
    } catch (err) {
      console.error("Product save/update error:", err);
      setMessage(
        err instanceof Error
          ? `Could not save product: ${err.message}`
          : "Could not save product to Supabase."
      );
    } finally {
      setSaving(false);
    }
  };

  // A category created here is a standalone top-level category.
  const handleAddCategory = async (
    categoryName: string
  ): Promise<string | null> => {
    const cleanedCategory = categoryName.trim();
    if (!cleanedCategory) return null;

    const existing = categories.find(
      (category) =>
        category.name.toLowerCase() === cleanedCategory.toLowerCase()
    );

    if (existing) {
      const hasChildren = categories.some(
        (category) => category.parent_id === existing.id
      );
      return hasChildren ? null : existing.name;
    }

    try {
      const { data, error: insertError } = await supabase
        .from("product_categories")
        .insert({ name: cleanedCategory })
        .select("id, name, parent_id")
        .single();

      if (insertError) throw insertError;
      const newCategory = data as CategoryRow;
      setCategories((previous) => [...previous, newCategory]);
      return newCategory.name;
    } catch (err) {
      console.error("Category creation error:", err);
      setMessage(
        err instanceof Error
          ? `Could not add category: ${err.message}`
          : "Could not add category."
      );
      return null;
    }
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setImportError("");
    setImportFileName(file.name);
    try {
      const raw = parseCsv(await file.text());
      if (raw.length < 2) throw new Error("The CSV file does not contain any product rows.");
      const headers = raw[0].map((header) => header.trim().toLowerCase());
      const required = ["sku", "name", "category"];
      const missing = required.filter((header) => !headers.includes(header));
      if (missing.length) throw new Error(`Missing required CSV columns: ${missing.join(", ")}`);
      const index = (key: string) => headers.indexOf(key);
      const get = (cells: string[], key: string) => {
        const at = index(key);
        return at >= 0 ? (cells[at] ?? "").trim() : "";
      };
      const categoryMap = new Map(categories.map((category) => [category.name.toLowerCase(), category]));
      const seen = new Set<string>();
      const parsed: ImportRow[] = raw.slice(1).map((cells) => {
        const sku = get(cells, "sku");
        const name = get(cells, "name");
        const categoryName = get(cells, "category");
        const category = categoryMap.get(categoryName.toLowerCase());
        const duplicateInFile = sku && seen.has(sku.toLowerCase());
        if (sku) seen.add(sku.toLowerCase());
        const costPrice = csvNumber(get(cells, "cost_price"));
        const sellingPrice = csvNumber(get(cells, "selling_price"));
        const stock = csvNumber(get(cells, "stock_quantity"));
        const minimumStock = csvNumber(get(cells, "minimum_stock"));
        const numericInvalid = [costPrice, sellingPrice, stock, minimumStock].some((value) => !Number.isFinite(value) || value < 0);
        const issue = !sku ? "Missing SKU" : !name ? "Missing product name" : !category ? `Category not found: ${categoryName || "blank"}` : duplicateInFile ? "Duplicate SKU in this CSV" : numericInvalid ? "Invalid or negative numeric value" : "";
        return {
          sku, name, nameEn: get(cells, "name_en"), nameSi: get(cells, "name_si"),
          category: categoryName, categoryId: category?.id ?? null,
          size: get(cells, "size"), variant: get(cells, "variant"), brand: get(cells, "brand"),
          unit: get(cells, "unit") || "Piece",
          costPrice: Number.isFinite(costPrice) ? costPrice : 0,
          sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
          stock: Number.isFinite(stock) ? stock : 0,
          minimumStock: Number.isFinite(minimumStock) ? minimumStock : 0,
          description: get(cells, "description"),
          issue,
        };
      });
      setImportRows(parsed);
      setImportOpen(true);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Unable to read this CSV file.");
    }
  };

  const confirmImport = async () => {
    const readyRows = importRows.filter((row) => row.categoryId && !row.issue.startsWith("Missing") && !row.issue.startsWith("Category") && !row.issue.startsWith("Duplicate") && !row.issue.startsWith("Invalid"));
    if (readyRows.length === 0) {
      setImportError("There are no valid rows to import.");
      return;
    }
    setImporting(true);
    setImportError("");
    try {
      const { data: existingProducts, error: skuError } = await supabase
        .from("products")
        .select("sku");
      if (skuError) throw skuError;
      const existingSkuSet = new Set(
        (existingProducts ?? []).map((item: { sku: string }) => item.sku.toLowerCase())
      );
      const duplicates = readyRows.filter((row) => existingSkuSet.has(row.sku.toLowerCase()));
      if (duplicates.length) {
        setImportError(`${duplicates.length} SKU(s) already exist in the database: ${duplicates.slice(0, 5).map((row) => row.sku).join(", ")}${duplicates.length > 5 ? "…" : ""}. Remove or change these rows in the CSV and upload again. Nothing was imported.`);
        return;
      }
      const payload = readyRows.map((row) => ({
        sku: row.sku, name: row.name, name_en: row.nameEn || null, name_si: row.nameSi || null,
        category_id: row.categoryId, size: row.size || null, variant: row.variant || null,
        brand: row.brand || null, unit: row.unit, cost_price: 0,
        selling_price: row.sellingPrice, stock_quantity: 0,
        minimum_stock: row.minimumStock, description: row.description || null,
      }));
      const { error: insertError } = await supabase.from("products").insert(payload);
      if (insertError) throw insertError;
      setImportOpen(false);
      setImportRows([]);
      setImportFileName("");
      setMessage(`Successfully imported ${payload.length} products. Refreshing catalogue...`);
      await loadInventory();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "The products could not be imported.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="inventory-page">
      <div className="inventory-heading">
        <div>
          <h1>Stock & Inventory</h1>
          <p>Manage your products, stock levels and pricing.</p>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <label className="inventory-filter-button" style={{ cursor: "pointer" }}>
            <Upload size={16} />
            Bulk Import CSV
            <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={(event) => { void handleImportFile(event.target.files?.[0]); event.currentTarget.value = ""; }} />
          </label>
          <button
            className="inventory-filter-button"
            onClick={() => void loadInventory()}
            disabled={loading}
            title="Refresh inventory"
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button
            className="inventory-add-button"
            onClick={() => {
              setMessage("");
              setSelectedProduct(null);
              setDrawerOpen(true);
            }}
          >
            <Plus size={17} />
            Add Product
          </button>
        </div>
      </div>

      {message && (
        <div className="inventory-message" role="status">
          <span>{message}</span>
          <button
            onClick={() => setMessage("")}
            aria-label="Dismiss message"
          >
            ×
          </button>
        </div>
      )}

      {error && (
        <div className="inventory-message" role="alert">
          <span>{error}</span>
          <button onClick={() => void loadInventory()}>Retry</button>
        </div>
      )}

      <div className="inventory-toolbar">
        <div className="inventory-search">
          <Search size={17} />
          <input
            type="text"
            placeholder="Search products, SKU or size..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
        <button
          className="inventory-filter-button"
          onClick={() => {
            setSelectedMainCategoryId(null);
            setSelectedLeafCategoryId(null);
            setSearchTerm("");
          }}
        >
          <Filter size={16} />
          Clear filters
        </button>
      </div>

      <section className="inventory-category-browser">
        <div className="inventory-table-heading">
          <div>
            <h3>Main Categories</h3>
            <p>Select a category to view its subcategories.</p>
          </div>
          <span className="inventory-record-count">{mainCategories.length} categories</span>
        </div>
        <div className="inventory-categories">
          {mainCategories.map((category) => {
            const hasChildren = categories.some((child) => child.parent_id === category.id);
            const count = products.filter((product) => {
              if (hasChildren) {
                const childIds = categories
                  .filter((child) => child.parent_id === category.id)
                  .map((child) => child.id);
                return product.categoryId === category.id || childIds.includes(product.categoryId);
              }
              return product.categoryId === category.id;
            }).length;
            const selected = selectedMainCategoryId === category.id;
            return (
              <button
                key={category.id}
                className={`category-button ${selected ? "selected" : ""}`}
                onClick={() => {
                  setSelectedMainCategoryId(selected ? null : category.id);
                  setSelectedLeafCategoryId(hasChildren || selected ? null : category.id);
                }}
              >
                <span>{category.name}</span>
                <small>{count}</small>
                {hasChildren && (selected ? <ChevronDown size={15} /> : <ChevronRight size={15} />)}
              </button>
            );
          })}
        </div>

        {selectedMainCategoryId && visibleSubcategories.length > 0 && (
          <div className="inventory-subcategory-section">
            <div className="inventory-table-heading">
              <div>
                <h3>{categories.find((category) => category.id === selectedMainCategoryId)?.name} — Subcategories</h3>
                <p>Select a subcategory to display its products below.</p>
              </div>
            </div>
            <div className="inventory-categories">
              {visibleSubcategories.map((category) => {
                const count = products.filter((product) => product.categoryId === category.id).length;
                return (
                  <button
                    key={category.id}
                    className={`category-button ${selectedLeafCategoryId === category.id ? "selected" : ""}`}
                    onClick={() => setSelectedLeafCategoryId(category.id)}
                  >
                    <span>{category.name}</span>
                    <small>{count}</small>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div className="inventory-table-panel">
        <div className="inventory-table-heading">
          <div>
            <h3>{selectedLeafCategoryId ? `${categories.find((category) => category.id === selectedLeafCategoryId)?.name ?? "Selected Category"} Products` : "Product Catalogue"}</h3>
            <p>
              {loading
                ? "Loading products from Supabase..."
                : `Showing ${filteredProducts.length} products`}
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="inventory-record-count">{products.length} records</span>
            <button
              className="inventory-add-button"
              onClick={() => {
                setMessage("");
                setSelectedProduct(null);
                setDrawerOpen(true);
              }}
            >
              <Plus size={16} /> Add Product
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Size / Variant</th>
                <th>Unit</th>
                <th>Cost Price</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={10} className="inventory-empty">
                    Loading your product catalogue...
                  </td>
                </tr>
              )}

              {!loading &&
                filteredProducts.map((product) => {
                  const isOutOfStock = product.stock === 0;
                  const isLowStock =
                    product.stock > 0 &&
                    product.stock <= product.minimumStock;

                  return (
                    <tr key={product.id}>
                      <td className="product-sku">{product.sku}</td>
                      <td className="product-name">
                        <div>{product.name}</div>
                        {product.nameSi && <small>{product.nameSi}</small>}
                      </td>
                      <td>{product.category}</td>
                      <td>
                        {[product.size, product.variant]
                          .filter(Boolean)
                          .join(" / ") || "—"}
                      </td>
                      <td>{product.unit}</td>
                      <td>
                        {product.costPrice > 0
                          ? formatPrice(product.costPrice)
                          : "Not entered"}
                      </td>
                      <td>
                        {product.sellingPrice > 0
                          ? formatPrice(product.sellingPrice)
                          : "Not entered"}
                      </td>
                      <td className="stock-number">
                        {product.stock === 0 ? "Not entered" : product.stock}
                      </td>
                      <td>
                        <span
                          className={`stock-status ${
                            isOutOfStock
                              ? "out"
                              : isLowStock
                              ? "low"
                              : "available"
                          }`}
                        >
                          {isOutOfStock
                            ? "Not recorded"
                            : isLowStock
                            ? "Low Stock"
                            : "In Stock"}
                        </span>
                      </td>
                      <td>
                        <button
                          className="product-more-button"
                          title="Edit product"
                          onClick={() => {
                            setMessage("");
                            setSelectedProduct(product);
                            setDrawerOpen(true);
                          }}
                        >
                          <><Pencil size={16} /> Edit</>
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="inventory-empty">
                    {selectedLeafCategoryId
                      ? "No products found in this category. You can add a product using the Add Product button."
                      : "No products found. Select a category or change your search."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="inventory-disclaimer">
        Product information is loaded from your Kehelovitigama Hardware
        Supabase database. Prices and stock marked as not entered require
        verification.
      </p>

      {importOpen && (
        <div className="drawer-overlay" onMouseDown={() => !importing && setImportOpen(false)}>
          <section className="product-drawer" style={{ width: "min(1000px, 96vw)", maxWidth: "96vw" }} onMouseDown={(event) => event.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2><FileSpreadsheet size={19} style={{ verticalAlign: "middle", marginRight: 8 }} />Review CSV Import</h2>
                <p>{importFileName} · {importRows.length} product rows detected</p>
              </div>
              <button className="drawer-close" onClick={() => setImportOpen(false)} disabled={importing} aria-label="Close import preview"><X size={20} /></button>
            </div>
            <div className="drawer-body">
              <div className="inventory-message" role="note">Existing products will not be overwritten. Rows with missing categories or duplicate SKUs must be corrected before importing. Selling prices and minimum-stock alerts are imported; opening stock and purchase cost start at 0. Record received stock through Purchases and verified quantities through Stock Count.</div>
              {importError && <div className="drawer-error" role="alert">{importError}</div>}
              <div style={{ overflowX: "auto", maxHeight: "55vh", border: "1px solid #e2e6eb", borderRadius: 8 }}>
                <table className="inventory-table">
                  <thead><tr><th>SKU</th><th>Product</th><th>Category</th><th>Size</th><th>CSV Cost*</th><th>Selling</th><th>CSV Stock*</th><th>Validation</th></tr></thead>
                  <tbody>{importRows.map((row, index) => <tr key={`${row.sku}-${index}`}>
                    <td className="product-sku">{row.sku || "—"}</td><td>{row.name || "—"}</td><td>{row.category || "—"}</td><td>{row.size || "—"}</td><td>{row.costPrice.toLocaleString("en-LK")}</td><td>{row.sellingPrice.toLocaleString("en-LK")}</td><td>{row.stock}</td>
                    <td><span className={`stock-status ${row.issue ? "low" : "available"}`}>{row.issue || "Ready · DB check"}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>
              <p style={{ color: "#64748b", fontSize: 13, marginTop: 12 }}>*CSV cost and stock values are shown for reference only and are not imported. New products start with zero stock and zero purchase cost. Database duplicate checks run on confirmation; if any duplicate is found, the entire import is cancelled.</p>
            </div>
            <div className="drawer-footer" style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <button type="button" className="inventory-filter-button" onClick={() => setImportOpen(false)} disabled={importing}>Cancel</button>
              <button type="button" className="inventory-add-button" onClick={() => void confirmImport()} disabled={importing || importRows.length === 0}>{importing ? "Importing..." : `Import ${importRows.filter((row) => !row.issue && row.categoryId).length} Products`}</button>
            </div>
          </section>
        </div>
      )}

      {drawerOpen && (
        <ProductDrawer
          categories={categoryNames}
          categoryGroups={categoryGroups}
          defaultCategory={
            selectedLeafCategoryId
              ? categories.find((category) => category.id === selectedLeafCategoryId)?.name ?? ""
              : ""
          }
          initialProduct={selectedProduct ?? undefined}
          onClose={() => {
            setDrawerOpen(false);
            setSelectedProduct(null);
          }}
          onSave={handleSaveProduct}
          onAddCategory={handleAddCategory}
        />
      )}

      {saving && (
        <div className="inventory-message" role="status">
          Saving product to Supabase...
        </div>
      )}
    </div>
  );
}

export default Inventory;
