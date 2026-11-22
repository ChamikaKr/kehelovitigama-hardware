
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  Plus,
  Filter,
  Package,
  MoreHorizontal,
  RefreshCw,
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
  const [selectedCategory, setSelectedCategory] = useState("All Products");
  const [searchTerm, setSearchTerm] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("");

  // Only categories without active child categories can be assigned to products.
  const leafCategories = useMemo(() => {
    const parentIds = new Set(
      categories
        .filter((category) => category.parent_id)
        .map((category) => category.parent_id as string)
    );

    return categories.filter((category) => !parentIds.has(category.id));
  }, [categories]);

  const categoryNames = useMemo(
    () => leafCategories.map((category) => category.name),
    [leafCategories]
  );

  // Build dropdown groups: parent categories are labels, not selectable options.
  const categoryGroups = useMemo<CategoryGroup[]>(() => {
    const groups: CategoryGroup[] = [];
    const categoriesWithChildren = categories.filter((category) =>
      categories.some((child) => child.parent_id === category.id)
    );

    for (const parent of categoriesWithChildren) {
      const children = categories
        .filter((category) => category.parent_id === parent.id)
        .filter((child) => leafCategories.some((leaf) => leaf.id === child.id))
        .map((child) => child.name);

      if (children.length > 0) {
        groups.push({
          label: parent.name,
          options: children,
        });
      }
    }

    const standaloneCategories = leafCategories
      .filter((category) => category.parent_id === null)
      .filter(
        (category) =>
          !categoriesWithChildren.some((parent) => parent.id === category.id)
      )
      .map((category) => category.name);

    if (standaloneCategories.length > 0) {
      groups.push({
        label: "Other Categories",
        options: standaloneCategories,
      });
    }

    // Include any leaf category whose parent is not currently available.
    const ungroupedCategories = leafCategories
      .filter(
        (category) =>
          category.parent_id !== null &&
          !categories.some((parent) => parent.id === category.parent_id)
      )
      .map((category) => category.name);

    if (ungroupedCategories.length > 0) {
      groups.push({
        label: "Other Categories",
        options: ungroupedCategories,
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
        selectedCategory === "All Products" ||
        product.category === selectedCategory;

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
      ]
        .join(" ")
        .toLowerCase();

      return matchesCategory && searchableText.includes(search);
    });
  }, [products, selectedCategory, searchTerm]);

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
      cost_price: draft.costPrice,
      selling_price: draft.sellingPrice,
      stock_quantity: draft.stock,
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
          .insert(productPayload)
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

      setSelectedCategory("All Products");
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

  // New categories are created as standalone categories at the top level.
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

      if (hasChildren) return null;
      return existing.name;
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

  return (
    <div className="inventory-page">
      <div className="inventory-heading">
        <div>
          <h1>Stock & Inventory</h1>
          <p>Manage your products, stock levels and pricing.</p>
        </div>

        <div style={{ display: "flex", gap: "10px" }}>
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
            setSelectedCategory("All Products");
            setSearchTerm("");
          }}
        >
          <Filter size={16} />
          Clear filters
        </button>
      </div>

      <div className="inventory-categories">
        {["All Products", ...categoryNames].map((category) => {
          const count =
            category === "All Products"
              ? products.length
              : products.filter((product) => product.category === category)
                  .length;

          return (
            <button
              key={category}
              className={`category-button ${
                selectedCategory === category ? "selected" : ""
              }`}
              onClick={() => setSelectedCategory(category)}
            >
              {category === "All Products" && <Package size={16} />}
              <span>{category}</span>
              <small>{count}</small>
            </button>
          );
        })}
      </div>

      <div className="inventory-table-panel">
        <div className="inventory-table-heading">
          <div>
            <h3>Product Catalogue</h3>
            <p>
              {loading
                ? "Loading products from Supabase..."
                : `Showing ${filteredProducts.length} products`}
            </p>
          </div>

          <span className="inventory-record-count">
            {products.length} records
          </span>
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
                        <div>{product.nameEn || product.name}</div>
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
                          title="More product actions"
                          onClick={() => {
                            setMessage("");
                            setSelectedProduct(product);
                            setDrawerOpen(true);
                          }}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}

              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="inventory-empty">
                    No products found. Try another search or category.
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

      {drawerOpen && (
        <ProductDrawer
          categories={categoryNames}
          categoryGroups={categoryGroups}
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
