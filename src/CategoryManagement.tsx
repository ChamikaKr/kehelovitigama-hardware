import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Plus,
  Search,
  Pencil,
  Power,
  Layers3,
  FolderTree,
  RefreshCw,
  GripVertical,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { supabase } from "./supabase";
import "./CategoryManagement.css";

type Category = {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  parent_id: string | null;
  created_at?: string;
};

type ProductCount = {
  category_id: string | null;
};

const emptyForm = {
  name: "",
  description: "",
  parent_id: "",
  sort_order: "0",
};

function CategoryManagement() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null);
  const [dragOverCategoryId, setDragOverCategoryId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState<Set<string>>(new Set());

  async function loadCategories() {
    setLoading(true);
    setError("");

    const [{ data: categoryData, error: categoryError }, { data: productData, error: productError }] =
      await Promise.all([
        supabase
          .from("product_categories")
          .select("id,name,description,sort_order,is_active,parent_id,created_at")
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        supabase.from("products").select("category_id"),
      ]);

    if (categoryError) {
      setError(`Could not load categories: ${categoryError.message}`);
      setLoading(false);
      return;
    }

    if (productError) {
      setError(`Categories loaded, but product counts could not be loaded: ${productError.message}`);
    }

    const rows = (categoryData ?? []) as Category[];
    setCategories(rows);

    const counts: Record<string, number> = {};
    ((productData ?? []) as ProductCount[]).forEach((product) => {
      if (product.category_id) {
        counts[product.category_id] = (counts[product.category_id] ?? 0) + 1;
      }
    });
    setProductCounts(counts);
    setLoading(false);
  }

  useEffect(() => {
    void loadCategories();
  }, []);

  const parentCategories = useMemo(
    () => categories.filter((category) => !category.parent_id && category.is_active),
    [categories]
  );

  const filteredCategories = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories.filter((category) => {
      if (!showInactive && !category.is_active) return false;
      if (!term) return true;
      const parentName = categories.find((item) => item.id === category.parent_id)?.name ?? "";
      return `${category.name} ${category.description ?? ""} ${parentName}`.toLowerCase().includes(term);
    });
  }, [categories, search, showInactive]);

  function toggleCategoryExpanded(categoryId: string) {
    setCollapsedCategoryIds((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setForm({
      name: category.name,
      description: category.description ?? "",
      parent_id: category.parent_id ?? "",
      sort_order: String(category.sort_order ?? 0),
    });
    setError("");
    setSuccess("");
    setFormOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();

    if (!name) {
      setError("Enter a category name.");
      return;
    }

    if (form.parent_id && form.parent_id === editing?.id) {
      setError("A category cannot be its own parent.");
      return;
    }

    const duplicate = categories.some(
      (category) =>
        category.id !== editing?.id &&
        category.parent_id === (form.parent_id || null) &&
        category.name.trim().toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
      setError("A category with this name already exists at this level.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    const payload = {
      name,
      description: form.description.trim() || null,
      parent_id: form.parent_id || null,
      sort_order: Number(form.sort_order) || 0,
    };

    const result = editing
      ? await supabase.from("product_categories").update(payload).eq("id", editing.id)
      : await supabase.from("product_categories").insert(payload);

    if (result.error) {
      setError(`Could not save category: ${result.error.message}`);
      setSaving(false);
      return;
    }

    setSaving(false);
    setFormOpen(false);
    setSuccess(editing ? "Category updated successfully." : "Category created successfully.");
    await loadCategories();
  }


  async function saveCategoryOrder(orderedCategories: Category[]) {
    setReordering(true);
    setError("");
    setSuccess("");

    try {
      const results = await Promise.all(
        orderedCategories.map((category, index) =>
          supabase
            .from("product_categories")
            .update({ sort_order: (index + 1) * 10 })
            .eq("id", category.id)
        )
      );

      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;

      setSuccess("Category order saved.");
      await loadCategories();
    } catch (orderError) {
      setError(
        orderError instanceof Error
          ? `Could not save category order: ${orderError.message}`
          : "Could not save category order."
      );
      await loadCategories();
    } finally {
      setReordering(false);
      setDraggedCategoryId(null);
      setDragOverCategoryId(null);
    }
  }

  function handleCategoryDrop(target: Category) {
    if (!draggedCategoryId || draggedCategoryId === target.id) return;

    const dragged = categories.find((item) => item.id === draggedCategoryId);
    if (!dragged || dragged.parent_id !== target.parent_id) {
      setError("Move categories only within the same level and parent.");
      setDraggedCategoryId(null);
      setDragOverCategoryId(null);
      return;
    }

    const siblings = categories
      .filter((item) => item.parent_id === target.parent_id)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

    const fromIndex = siblings.findIndex((item) => item.id === dragged.id);
    const toIndex = siblings.findIndex((item) => item.id === target.id);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...siblings];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    void saveCategoryOrder(reordered);
  }

  async function toggleActive(category: Category) {
    const action = category.is_active ? "deactivate" : "activate";
    if (!window.confirm(`Are you sure you want to ${action} "${category.name}"?`)) return;

    setError("");
    setSuccess("");

    const { error: updateError } = await supabase
      .from("product_categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);

    if (updateError) {
      setError(`Could not ${action} category: ${updateError.message}`);
      return;
    }

    setSuccess(`Category ${action}d successfully.`);
    await loadCategories();
  }

  const mainCategories = filteredCategories.filter((category) => !category.parent_id);
  const subcategories = filteredCategories.filter((category) => category.parent_id);

  return (
    <div className="category-page">
      <div className="category-page-heading">
        <div>
          <h1>Settings & Users</h1>
          <p>Manage the product catalogue structure for Kehelovitigama Hardware.</p>
        </div>
        <button className="category-primary-button" onClick={openCreate}>
          <Plus size={17} /> Add Category
        </button>
      </div>

      <section className="category-settings-card">
        <div className="category-section-heading">
          <div className="category-section-icon"><FolderTree size={20} /></div>
          <div>
            <h2>Categories & Subcategories</h2>
            <p>Create and organise the categories used by your products.</p>
          </div>
        </div>

        <div className="category-summary-grid">
          <div className="category-summary">
            <span>Total categories</span>
            <strong>{categories.length}</strong>
          </div>
          <div className="category-summary">
            <span>Main categories</span>
            <strong>{categories.filter((item) => !item.parent_id).length}</strong>
          </div>
          <div className="category-summary">
            <span>Subcategories</span>
            <strong>{categories.filter((item) => item.parent_id).length}</strong>
          </div>
          <div className="category-summary">
            <span>Active categories</span>
            <strong>{categories.filter((item) => item.is_active).length}</strong>
          </div>
        </div>

        <div className="category-toolbar">
          <label className="category-search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search categories..."
            />
          </label>
          <label className="category-inactive-toggle">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(event) => setShowInactive(event.target.checked)}
            />
            Show inactive
          </label>
          <button className="category-refresh-button" onClick={() => void loadCategories()} title="Refresh categories">
            <RefreshCw size={16} /> Refresh
          </button>
        </div>

        {error && <div className="category-alert error">{error}</div>}
        {success && <div className="category-alert success">{success}</div>}

        {loading ? (
          <div className="category-empty">Loading categories...</div>
        ) : (
          <div className="category-list">
            <div className="category-sort-hint">
              <GripVertical size={15} />
              {reordering
                ? "Saving new order..."
                : search.trim() || showInactive
                  ? "Clear search and hide inactive categories to rearrange."
                  : "Drag the grip handle to rearrange categories. Subcategories can only move within their parent."}
            </div>
            {mainCategories.length === 0 && subcategories.length === 0 ? (
              <div className="category-empty">No categories match your search.</div>
            ) : (
              <>
                {mainCategories.map((category) => {
                  const children = subcategories.filter((item) => item.parent_id === category.id);
                  return (
                    <div
                      className={`category-group ${dragOverCategoryId === category.id ? "category-drag-over" : ""}`}
                      key={category.id}
                      draggable={!search.trim() && !showInactive && !reordering}
                      onDragStart={() => setDraggedCategoryId(category.id)}
                      onDragOver={(event) => {
                        event.preventDefault();
                        setDragOverCategoryId(category.id);
                      }}
                      onDragLeave={() => setDragOverCategoryId(null)}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleCategoryDrop(category);
                      }}
                      onDragEnd={() => {
                        setDraggedCategoryId(null);
                        setDragOverCategoryId(null);
                      }}
                    >
                      <div className="category-row main-category-row">
                        <div className="category-row-main">
                          <button
                            type="button"
                            className="category-collapse-button"
                            onClick={() => toggleCategoryExpanded(category.id)}
                            aria-label={collapsedCategoryIds.has(category.id) ? `Expand ${category.name}` : `Collapse ${category.name}`}
                            aria-expanded={!collapsedCategoryIds.has(category.id)}
                            title={collapsedCategoryIds.has(category.id) ? "Expand subcategories" : "Collapse subcategories"}
                          >
                            {collapsedCategoryIds.has(category.id)
                              ? <ChevronRight size={18} />
                              : <ChevronDown size={18} />}
                          </button>
                          <span className="category-drag-handle" title="Drag to rearrange" aria-label="Drag to rearrange">
                            <GripVertical size={18} />
                          </span>
                          <Layers3 size={18} />
                          <div>
                            <strong>{category.name}</strong>
                            <span>
                              Main category · {productCounts[category.id] ?? 0} products
                              {!category.is_active && " · Inactive"}
                            </span>
                          </div>
                        </div>
                        <div className="category-row-actions">
                          <button onClick={() => openEdit(category)} title="Edit category"><Pencil size={16} /></button>
                          <button onClick={() => void toggleActive(category)} title={category.is_active ? "Deactivate" : "Activate"}>
                            <Power size={16} />
                          </button>
                        </div>
                      </div>
                      {category.description && <p className="category-description">{category.description}</p>}
                      {!collapsedCategoryIds.has(category.id) && children.map((child) => (
                        <div
                          className={`category-row subcategory-row ${dragOverCategoryId === child.id ? "category-drag-over" : ""}`}
                          key={child.id}
                          draggable={!search.trim() && !showInactive && !reordering}
                          onDragStart={(event) => {
                            event.stopPropagation();
                            setDraggedCategoryId(child.id);
                          }}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setDragOverCategoryId(child.id);
                          }}
                          onDragLeave={() => setDragOverCategoryId(null)}
                          onDrop={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleCategoryDrop(child);
                          }}
                          onDragEnd={() => {
                            setDraggedCategoryId(null);
                            setDragOverCategoryId(null);
                          }}
                        >
                          <div className="category-row-main">
                            <span className="category-drag-handle" title="Drag to rearrange" aria-label="Drag to rearrange">
                              <GripVertical size={17} />
                            </span>
                            <span className="category-tree-line" />
                            <div>
                              <strong>{child.name}</strong>
                              <span>
                                Subcategory · {productCounts[child.id] ?? 0} products
                                {!child.is_active && " · Inactive"}
                              </span>
                            </div>
                          </div>
                          <div className="category-row-actions">
                            <button onClick={() => openEdit(child)} title="Edit subcategory"><Pencil size={16} /></button>
                            <button onClick={() => void toggleActive(child)} title={child.is_active ? "Deactivate" : "Activate"}>
                              <Power size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {!collapsedCategoryIds.has(category.id) && <button
                        className="category-add-subcategory"
                        onClick={() => {
                          setEditing(null);
                          setForm({ ...emptyForm, parent_id: category.id });
                          setError("");
                          setSuccess("");
                          setFormOpen(true);
                        }}
                      >
                        <Plus size={14} /> Add subcategory to {category.name}
                      </button>}
                    </div>
                  );
                })}
                {subcategories.filter((item) => !categories.some((parent) => parent.id === item.parent_id)).map((item) => (
                  <div className="category-row subcategory-row" key={item.id}>
                    <div className="category-row-main"><FolderTree size={17} /><div><strong>{item.name}</strong><span>Parent category unavailable</span></div></div>
                    <div className="category-row-actions"><button onClick={() => openEdit(item)} title="Edit"><Pencil size={16} /></button></div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      <section className="category-settings-card category-coming-soon">
        <div className="category-section-heading">
          <div className="category-section-icon"><PackageIcon /></div>
          <div>
            <h2>Other Settings</h2>
            <p>Product units, users and general business settings can be added here in later stages.</p>
          </div>
        </div>
      </section>

      {formOpen && (
        <div className="category-modal-overlay" onMouseDown={() => setFormOpen(false)}>
          <section className="category-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="category-modal-heading">
              <div>
                <h2>{editing ? "Edit Category" : form.parent_id ? "Add Subcategory" : "Add Main Category"}</h2>
                <p>Category information is saved directly to Supabase.</p>
              </div>
              <button type="button" onClick={() => setFormOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <label>
                Category name *
                <input required autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Enter category name" />
              </label>
              <label>
                Parent category
                <select value={form.parent_id} onChange={(event) => setForm({ ...form, parent_id: event.target.value })}>
                  <option value="">None — Main category</option>
                  {parentCategories.filter((item) => item.id !== editing?.id).map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Description
                <textarea rows={3} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Optional description" />
              </label>
              <label>
                Display order
                <input type="number" min="0" step="1" value={form.sort_order} onChange={(event) => setForm({ ...form, sort_order: event.target.value })} />
              </label>
              {error && <div className="category-alert error">{error}</div>}
              <div className="category-modal-actions">
                <button type="button" className="category-secondary-button" onClick={() => setFormOpen(false)}>Cancel</button>
                <button type="submit" className="category-primary-button" disabled={saving}>{saving ? "Saving..." : editing ? "Save Changes" : "Create Category"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

function PackageIcon() {
  return <Layers3 size={20} />;
}

export default CategoryManagement;
