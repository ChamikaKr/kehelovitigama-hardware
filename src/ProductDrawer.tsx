import { useState } from "react";
import type { FormEvent } from "react";
import { X, Plus, Save } from "lucide-react";
import "./ProductDrawer.css";

export type ProductDraft = {
  sku: string;
  name: string;
  nameEn: string;
  nameSi: string;
  category: string;
  size: string;
  variant: string;
  brand: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  minimumStock: number;
  description: string;
};

export type CategoryGroup = {
  label: string;
  options: string[];
};

type InitialProduct = ProductDraft & {
  id: string;
  categoryId: string;
};

type ProductDrawerProps = {
  categories: string[];
  categoryGroups: CategoryGroup[];
  existingSkus: string[];
  defaultCategory?: string;
  initialProduct?: InitialProduct;
  onClose: () => void;
  onSave: (product: ProductDraft) => void | Promise<void>;
  onAddCategory: (category: string) => Promise<string | null>;
};

function abbreviateSegment(value: string): string {
  const words = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .match(/[A-Z0-9]+/g) ?? [];

  return words.length === 0 ? "" : words.length === 1 ? words[0] : words.map((word) => word[0]).join("");
}

function generateProductSku(product: ProductDraft, existingSkus: string[]): string {
  const productSegment = [product.name, product.nameEn, product.category, product.nameSi]
    .map(abbreviateSegment)
    .find(Boolean) ?? "";
  const brandSegment = abbreviateSegment(product.brand);
  const variantSegment = [product.variant, product.size]
    .filter(Boolean)
    .map((value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, ""))
    .filter(Boolean)
    .join("-");
  const baseSku = ["KH", productSegment, brandSegment, variantSegment].filter(Boolean).join("-");
  const existing = new Set(existingSkus.map((sku) => sku.trim().toUpperCase()));

  if (!existing.has(baseSku)) return baseSku;

  let suffix = 2;
  while (existing.has(`${baseSku}-${suffix}`)) suffix += 1;
  return `${baseSku}-${suffix}`;
}
const emptyForm: ProductDraft = {
  sku: "",
  name: "",
  nameEn: "",
  nameSi: "",
  category: "",
  size: "",
  variant: "",
  brand: "",
  unit: "Piece",
  costPrice: 0,
  sellingPrice: 0,
  stock: 0,
  minimumStock: 0,
  description: "",
};

function ProductDrawer({
  categories,
  categoryGroups,
  existingSkus,
  defaultCategory,
  initialProduct,
  onClose,
  onSave,
  onAddCategory,
}: ProductDrawerProps) {
  const [form, setForm] = useState<ProductDraft>(() => {
    if (initialProduct) {
      return {
        sku: initialProduct.sku,
        name: initialProduct.name,
        nameEn: initialProduct.nameEn ?? "",
        nameSi: initialProduct.nameSi ?? "",
        category: initialProduct.category,
        size: initialProduct.size ?? "",
        variant: initialProduct.variant ?? "",
        brand: initialProduct.brand ?? "",
        unit: initialProduct.unit,
        costPrice: initialProduct.costPrice,
        sellingPrice: initialProduct.sellingPrice,
        stock: initialProduct.stock,
        minimumStock: initialProduct.minimumStock,
        description: initialProduct.description ?? "",
      };
    }

    return { ...emptyForm, category: defaultCategory ?? categories[0] ?? "" };
  });

  const [skuManuallyEdited, setSkuManuallyEdited] = useState(Boolean(initialProduct));
  const [newCategory, setNewCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const updateField = (
    field: keyof ProductDraft,
    value: string | number
  ) => {
    if (field === "sku") setSkuManuallyEdited(true);
    setForm((previous) => {
      const updated = { ...previous, [field]: value };
      if (!initialProduct && !skuManuallyEdited && field !== "sku") {
        updated.sku = generateProductSku(updated, existingSkus);
      }
      return updated;
    });
    setError("");
  };

  const handleAddCategory = async () => {
    const category = newCategory.trim();

    if (!category) {
      setError("Please enter a category name.");
      return;
    }

    if (categories.some((item) => item.toLowerCase() === category.toLowerCase())) {
      setError("This category already exists.");
      return;
    }

    setCreatingCategory(true);
    setError("");

    try {
      const createdCategory = await onAddCategory(category);
      if (!createdCategory) {
        setError("The category could not be created. Please try again.");
        return;
      }

      setForm((previous) => ({ ...previous, category: createdCategory }));
      setNewCategory("");
      setAddingCategory(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create the category."
      );
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.sku.trim()) {
      setError("Please enter a product code.");
      return;
    }

    if (!form.name.trim() && !form.nameEn.trim() && !form.nameSi.trim()) {
      setError("Please enter at least one product name.");
      return;
    }

    if (!form.category.trim() || !categories.includes(form.category)) {
      setError("Please select a valid selectable category.");
      return;
    }

    if (form.costPrice < 0 || form.sellingPrice < 0) {
      setError("Prices cannot be negative.");
      return;
    }

    if (form.stock < 0 || form.minimumStock < 0) {
      setError("Stock quantities cannot be negative.");
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        sku: form.sku.trim(),
        name: form.name.trim(),
        nameEn: form.nameEn.trim(),
        nameSi: form.nameSi.trim(),
        category: form.category.trim(),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not save the product."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="drawer-overlay" onMouseDown={onClose}>
      <aside
        className="product-drawer"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div>
            <h2>{initialProduct ? "Edit Product" : "Add Product"}</h2>
            <p>
              {initialProduct
                ? "Update the product information."
                : "Add a new item to your product catalogue."}
            </p>
          </div>
          <button
            type="button"
            className="drawer-close"
            onClick={onClose}
            aria-label="Close form"
          >
            <X size={20} />
          </button>
        </div>

        <form className="drawer-form" onSubmit={handleSubmit}>
          <div className="drawer-body">
            {error && (
              <div className="drawer-error" role="alert">
                {error}
              </div>
            )}

            <section className="form-section">
              <h3>Product Information</h3>
              <div className="form-grid">
                <label className="drawer-field">
                  Product Code *
                  <input
                    required
                    value={form.sku}
                    onChange={(event) => updateField("sku", event.target.value)}
                    placeholder="Generated from product details; editable"
                  />
                </label>

                <label className="drawer-field">
                  Product Name *
                  <input
                    required
                    value={form.name}
                    onChange={(event) => updateField("name", event.target.value)}
                    placeholder="Enter product name"
                  />
                </label>

                <label className="drawer-field">
                  English Name
                  <input
                    value={form.nameEn}
                    onChange={(event) => updateField("nameEn", event.target.value)}
                    placeholder="English product name"
                  />
                </label>

                <label className="drawer-field">
                  Sinhala Name
                  <input
                    value={form.nameSi}
                    onChange={(event) => updateField("nameSi", event.target.value)}
                    placeholder="සිංහල නම"
                  />
                </label>

                <label className="drawer-field">
                  Category *
                  <select
                    required
                    value={form.category}
                    onChange={(event) => updateField("category", event.target.value)}
                  >
                    <option value="" disabled>
                      Select a category
                    </option>
                    {categoryGroups.map((group, index) => (
                      <optgroup key={`${group.label}-${index}`} label={group.label}>
                        {group.options.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>

                <div className="category-add-area">
                  {addingCategory ? (
                    <div className="category-add-input">
                      <input
                        value={newCategory}
                        onChange={(event) => setNewCategory(event.target.value)}
                        placeholder="New category name"
                        disabled={creatingCategory}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void handleAddCategory();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleAddCategory()}
                        disabled={creatingCategory}
                      >
                        {creatingCategory ? "Adding..." : "Add"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAddingCategory(false);
                          setNewCategory("");
                          setError("");
                        }}
                        disabled={creatingCategory}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="add-category-button"
                      onClick={() => setAddingCategory(true)}
                    >
                      <Plus size={14} />
                      Add a new category
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="form-section">
              <h3>Product Details</h3>
              <div className="form-grid">
                <label className="drawer-field">
                  Size
                  <input
                    value={form.size}
                    onChange={(event) => updateField("size", event.target.value)}
                    placeholder="e.g. 50kg, ½ inch, 6m"
                  />
                </label>

                <label className="drawer-field">
                  Variant / Type
                  <input
                    value={form.variant}
                    onChange={(event) => updateField("variant", event.target.value)}
                    placeholder="Enter variant"
                  />
                </label>

                <label className="drawer-field">
                  Brand
                  <input
                    value={form.brand}
                    onChange={(event) => updateField("brand", event.target.value)}
                    placeholder="Enter brand"
                  />
                </label>

                <label className="drawer-field">
                  Unit *
                  <select
                    required
                    value={form.unit}
                    onChange={(event) => updateField("unit", event.target.value)}
                  >
                    {[
                      "Piece", "Bag", "Kg", "Gram", "Length", "Meter",
                      "Roll", "Pack", "Box", "Bundle", "Liter", "Set",
                    ].map((unit) => (
                      <option key={unit} value={unit}>{unit}</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3>Pricing & Stock</h3>
              <div className="form-grid">
                <label className="drawer-field">
                  Latest Purchase Cost (LKR)
                  <input
                    type="number"
                    value={form.costPrice}
                    readOnly
                    aria-readonly="true"
                  />
                  <small className="drawer-field-help">Updated automatically when a purchase is recorded.</small>
                </label>

                <label className="drawer-field">
                  Selling Price (LKR) *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={form.sellingPrice}
                    onChange={(event) => updateField("sellingPrice", Number(event.target.value))}
                  />
                </label>

                <label className="drawer-field">
                  Current Stock
                  <input
                    type="number"
                    value={form.stock}
                    readOnly
                    aria-readonly="true"
                  />
                  <small className="drawer-field-help">Use Purchases or Stock Count to change stock.</small>
                </label>

                <label className="drawer-field">
                  Minimum Stock Alert
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={form.minimumStock}
                    onChange={(event) => updateField("minimumStock", Number(event.target.value))}
                  />
                </label>
              </div>
            </section>

            <section className="form-section">
              <h3>Additional Information</h3>
              <label className="drawer-field">
                Description / Notes
                <textarea
                  rows={3}
                  value={form.description}
                  onChange={(event) => updateField("description", event.target.value)}
                  placeholder="Optional product details..."
                />
              </label>
            </section>
          </div>

          <div className="drawer-footer">
            <button
              type="button"
              className="drawer-cancel-button"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="drawer-save-button"
              disabled={saving || creatingCategory}
            >
              <Save size={16} />
              {saving
                ? "Saving..."
                : initialProduct
                ? "Update Product"
                : "Save Product"}
            </button>
          </div>
        </form>
      </aside>
    </div>
  );
}

export default ProductDrawer;
