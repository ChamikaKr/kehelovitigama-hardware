import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  DatabaseBackup,
  FolderTree,
  UserRound,
  CheckCircle2,
  ShieldCheck,
  Cloud,
  Download,
  RefreshCw,
  FileUp,
  AlertCircle,
  Check,
} from "lucide-react";
import CategoryManagement from "./CategoryManagement";
import { supabase } from "./supabase";
import "./SettingsManagement.css";

type SettingsTab = "categories" | "users" | "backup";

type SettingsManagementProps = {
  userEmail: string;
};

type BackupTableName =
  | "product_categories"
  | "products"
  | "stock_movements";

type BackupPackage = {
  application: "Kehelovitigama Hardware Management System";
  backup_format_version: 1;
  created_at: string;
  timezone: "Asia/Colombo";
  currency: "LKR";
  tables: Record<BackupTableName, Record<string, unknown>[]>;
  record_counts: Record<BackupTableName, number>;
};

type CloudBackup = {
  name: string;
  created_at?: string | null;
  metadata?: { size?: number };
};

const BACKUP_BUCKET = "hardware-backups";
const PAGE_SIZE = 1000;

async function fetchAllRows(table: BackupTableName) {
  const allRows: Record<string, unknown>[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Could not export ${table}: ${error.message}`);

    const rows = (data ?? []) as Record<string, unknown>[];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return allRows;
}

function makeBackupFilename(date: Date) {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return `kehelovitigama-backup-${stamp}.json`;
}

function downloadJson(filename: string, backup: BackupPackage) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatBytes(bytes?: number) {
  if (bytes === undefined || bytes === null) return "Size unavailable";
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value?: string | null) {
  if (!value) return "Date unavailable";
  return new Date(value).toLocaleString("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  });
}

function SettingsManagement({ userEmail }: SettingsManagementProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("categories");
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [loadingCloudBackups, setLoadingCloudBackups] = useState(false);
  const [cloudBackups, setCloudBackups] = useState<CloudBackup[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastBackupCounts, setLastBackupCounts] =
    useState<Record<BackupTableName, number> | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<BackupPackage | null>(null);
  const [selectedBackupName, setSelectedBackupName] = useState("");
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [validatingBackup, setValidatingBackup] = useState(false);
  const restoreFileInput = useRef<HTMLInputElement | null>(null);

  const loadCloudBackups = useCallback(async () => {
    setLoadingCloudBackups(true);
    setError("");

    const { data, error: listError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .list("", {
        limit: 100,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (listError) {
      setError(
        `Could not load cloud backups: ${listError.message}. Check that the private bucket and Storage policies were created.`
      );
      setCloudBackups([]);
    } else {
      setCloudBackups(
        (data ?? [])
          .filter((item) => item.name.endsWith(".json"))
          .map((item) => ({
            name: item.name,
            created_at: item.created_at,
            metadata: item.metadata as { size?: number } | undefined,
          }))
      );
    }

    setLoadingCloudBackups(false);
  }, []);

  useEffect(() => {
    if (activeTab === "backup") {
      void loadCloudBackups();
    }
  }, [activeTab, loadCloudBackups]);

  async function createBackup() {
    setCreatingBackup(true);
    setMessage("");
    setError("");

    try {
      const [categories, products, movements] = await Promise.all([
        fetchAllRows("product_categories"),
        fetchAllRows("products"),
        fetchAllRows("stock_movements"),
      ]);

      const now = new Date();
      const backup: BackupPackage = {
        application: "Kehelovitigama Hardware Management System",
        backup_format_version: 1,
        created_at: now.toISOString(),
        timezone: "Asia/Colombo",
        currency: "LKR",
        tables: {
          product_categories: categories,
          products,
          stock_movements: movements,
        },
        record_counts: {
          product_categories: categories.length,
          products: products.length,
          stock_movements: movements.length,
        },
      };

      const filename = makeBackupFilename(now);
      downloadJson(filename, backup);
      setLastBackupCounts(backup.record_counts);

      const file = new File([JSON.stringify(backup, null, 2)], filename, {
        type: "application/json",
      });

      const { error: uploadError } = await supabase.storage
        .from(BACKUP_BUCKET)
        .upload(filename, file, {
          contentType: "application/json",
          upsert: false,
        });

      if (uploadError) {
        setError(
          `The local backup was downloaded, but the cloud upload failed: ${uploadError.message}. Keep the downloaded file safe.`
        );
        await loadCloudBackups();
        return;
      }

      setMessage(
        "Backup created successfully. A local copy was downloaded and a separate copy was uploaded to private Supabase Storage."
      );
      await loadCloudBackups();
    } catch (backupError) {
      console.error("Backup creation failed:", backupError);
      setError(
        backupError instanceof Error
          ? backupError.message
          : "Backup could not be created."
      );
    } finally {
      setCreatingBackup(false);
    }
  }

  async function createPreRestoreSafetyBackup() {
    const [categories, products, movements] = await Promise.all([
      fetchAllRows("product_categories"),
      fetchAllRows("products"),
      fetchAllRows("stock_movements"),
    ]);

    const now = new Date();
    const backup: BackupPackage = {
      application: "Kehelovitigama Hardware Management System",
      backup_format_version: 1,
      created_at: now.toISOString(),
      timezone: "Asia/Colombo",
      currency: "LKR",
      tables: {
        product_categories: categories,
        products,
        stock_movements: movements,
      },
      record_counts: {
        product_categories: categories.length,
        products: products.length,
        stock_movements: movements.length,
      },
    };

    // Use milliseconds in the safety filename to avoid same-second collisions.
    const filename = `kehelovitigama-pre-restore-${Date.now()}.json`;

    const file = new File([JSON.stringify(backup, null, 2)], filename, {
      type: "application/json",
    });

    // Cloud upload must succeed before restoration is allowed to continue.
    const { error: uploadError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .upload(filename, file, {
        contentType: "application/json",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(
        `Safety backup could not be uploaded to cloud storage. Restore cancelled. ${uploadError.message}`
      );
    }

    // Also trigger a local download after the verified cloud upload.
    downloadJson(filename, backup);
    setLastBackupCounts(backup.record_counts);
    await loadCloudBackups();

    return {
      filename,
      counts: backup.record_counts,
    };
  }

  async function handleRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setSelectedBackup(null);
    setSelectedBackupName("");
    setMessage("");
    setError("");

    if (!file) return;

    setValidatingBackup(true);

    try {
      if (!file.name.toLowerCase().endsWith(".json")) {
        throw new Error("Please select a JSON backup file.");
      }

      const parsed: unknown = JSON.parse(await file.text());
      if (!parsed || typeof parsed !== "object") {
        throw new Error("The selected file is not a valid backup package.");
      }

      const candidate = parsed as Partial<BackupPackage>;
      if (
        candidate.application !== "Kehelovitigama Hardware Management System" ||
        candidate.backup_format_version !== 1 ||
        !candidate.tables ||
        !Array.isArray(candidate.tables.product_categories) ||
        !Array.isArray(candidate.tables.products) ||
        !Array.isArray(candidate.tables.stock_movements)
      ) {
        throw new Error("This file is not a supported Kehelovitigama Hardware backup.");
      }

      const counts = candidate.record_counts;
      if (
        !counts ||
        counts.product_categories !== candidate.tables.product_categories.length ||
        counts.products !== candidate.tables.products.length ||
        counts.stock_movements !== candidate.tables.stock_movements.length
      ) {
        throw new Error("Backup record counts do not match the data. The file may be incomplete or modified.");
      }

      // Run the server-side, non-destructive structural and relationship validation.
      const { data: validationResult, error: validationError } = await supabase.rpc(
        "validate_hardware_backup",
        { backup_payload: candidate }
      );

      if (validationError) {
        throw new Error(`Database validation failed: ${validationError.message}`);
      }

      const validation = validationResult as {
        success?: boolean;
        validated_categories?: number;
        validated_products?: number;
        validated_stock_movements?: number;
        database_changed?: boolean;
      } | null;

      if (!validation?.success || validation.database_changed !== false) {
        throw new Error("The database did not confirm a successful non-destructive validation.");
      }

      setSelectedBackup(candidate as BackupPackage);
      setSelectedBackupName(file.name);
      setMessage(
        `Backup validated by the database. Categories: ${validation.validated_categories ?? 0}, products: ${validation.validated_products ?? 0}, stock movements: ${validation.validated_stock_movements ?? 0}. No database records were changed.`
      );
    } catch (fileError) {
      setError(fileError instanceof Error ? fileError.message : "Could not validate this backup file.");
    } finally {
      setValidatingBackup(false);
      // Allow selecting the same file again after correcting an issue.
      event.target.value = "";
    }
  }

  async function restoreSelectedBackup() {
    if (!selectedBackup || restoringBackup || validatingBackup) return;

    const confirmed = window.confirm(
      `WARNING: This will replace all current categories, products and stock movements with the data in "${selectedBackupName}". A fresh safety backup will first be uploaded to private cloud storage and downloaded locally. Continue?`
    );

    if (!confirmed) return;

    setRestoringBackup(true);
    setMessage("");
    setError("");

    try {
      setMessage("Creating a safety backup of the current database before restoration...");

      const safetyBackup = await createPreRestoreSafetyBackup();

      setMessage(
        `Safety backup secured: ${safetyBackup.filename}. Starting restore...`
      );

      const { data, error: restoreError } = await supabase.rpc(
        "restore_hardware_backup",
        { backup_payload: selectedBackup }
      );

      if (restoreError) {
        throw new Error(
          `Restore failed. The pre-restore safety backup is available in cloud storage as ${safetyBackup.filename}. ${restoreError.message}`
        );
      }

      const result = data as {
        success?: boolean;
        restored_categories?: number;
        restored_products?: number;
        restored_stock_movements?: number;
      };

      if (!result?.success) {
        throw new Error(
          `The database did not confirm a successful restore. Your pre-restore safety backup is ${safetyBackup.filename}.`
        );
      }

      setMessage(
        `Restore completed. Categories: ${result.restored_categories ?? 0}, products: ${result.restored_products ?? 0}, stock movements: ${result.restored_stock_movements ?? 0}. A safety backup was saved locally and in cloud storage as ${safetyBackup.filename}. Refresh the application to reload all data.`
      );
      setSelectedBackup(null);
      setSelectedBackupName("");
      await loadCloudBackups();
    } catch (restoreError) {
      console.error("Backup restore failed:", restoreError);
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Restore failed. Check the cloud backup list before attempting another recovery."
      );
    } finally {
      setRestoringBackup(false);
    }
  }

  async function downloadCloudBackup(filename: string) {
    setError("");
    setMessage("");

    const { data, error: downloadError } = await supabase.storage
      .from(BACKUP_BUCKET)
      .download(filename);

    if (downloadError) {
      setError(`Could not download cloud backup: ${downloadError.message}`);
      return;
    }

    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMessage(`Downloaded ${filename}.`);
  }

  const tabs = [
    { id: "categories" as const, label: "Categories", icon: FolderTree },
    { id: "users" as const, label: "Account", icon: UserRound },
    { id: "backup" as const, label: "Backup & Restore", icon: DatabaseBackup },
  ];

  return (
    <div className="settings-page">
      <div className="settings-page-heading">
        <div>
          <h1>Settings &amp; Users</h1>
          <p>Manage your shop catalogue, account access and data protection.</p>
        </div>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Settings sections">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const selected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={`settings-tab ${selected ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={17} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="settings-tab-content" role="tabpanel">
        {activeTab === "categories" && <CategoryManagement />}

        {activeTab === "users" && (
          <section className="settings-feature-panel">
            <div className="settings-feature-icon"><UserRound size={22} /></div>
            <div>
              <h2>Administrator Account</h2>
              <p>This account is shared by you and your father for managing Kehelovitigama Hardware.</p>
            </div>
            <div className="settings-feature-status">Administrator</div>

            <div className="settings-feature-details">
              <div>
                <strong>Signed-in email</strong>
                <span>{userEmail}</span>
              </div>
              <div>
                <strong>Account status</strong>
                <span><CheckCircle2 size={14} style={{ display: "inline", verticalAlign: "-2px", marginRight: 6 }} />Active</span>
              </div>
              <div>
                <strong>Access level</strong>
                <span>Full access to all application modules and settings.</span>
              </div>
            </div>

            <p className="settings-note">
              Only one login account is currently used. Because you and your father share this account, the system cannot identify which person performed an action. If you later add employees or need individual activity tracking, we can introduce separate accounts and roles.
            </p>
          </section>
        )}

        {activeTab === "backup" && (
          <section className="settings-feature-panel backup-feature-panel">
            <div className="settings-feature-icon"><DatabaseBackup size={22} /></div>
            <div>
              <h2>Backup &amp; Restore</h2>
              <p>Protect your shop records with local downloads and private cloud copies.</p>
            </div>
            <div className="settings-feature-status backup-ready-status">Backup enabled</div>

            {message && (
              <div className="backup-feedback success" role="status">
                <Check size={17} />
                <span>{message}</span>
              </div>
            )}
            {error && (
              <div className="backup-feedback error" role="alert">
                <AlertCircle size={17} />
                <span>{error}</span>
              </div>
            )}

            <div className="backup-options">
              <div className="backup-option">
                <div className="backup-option-title"><Download size={19} /><strong>Create a backup</strong></div>
                <p>Export categories, products and stock movements. The same backup is saved to your computer and private cloud storage.</p>
                <button
                  type="button"
                  className="backup-action-button"
                  onClick={() => void createBackup()}
                  disabled={creatingBackup}
                >
                  {creatingBackup ? <><RefreshCw size={15} className="backup-spin" /> Creating backup...</> : <><ShieldCheck size={16} /> Create local + cloud backup</>}
                </button>
              </div>

              <div className="backup-option">
                <div className="backup-option-title"><Cloud size={19} /><strong>Cloud backup storage</strong></div>
                <p>Private Supabase Storage keeps a separate copy that can be downloaded later from this account.</p>
                <button
                  type="button"
                  className="backup-secondary-button"
                  onClick={() => void loadCloudBackups()}
                  disabled={loadingCloudBackups}
                >
                  <RefreshCw size={15} className={loadingCloudBackups ? "backup-spin" : ""} />
                  {loadingCloudBackups ? "Refreshing..." : "Refresh cloud backups"}
                </button>
              </div>

              <div className="backup-option restore-upload-option">
                <div className="backup-option-title"><FileUp size={19} /><strong>Restore from a backup</strong></div>
                <p>Select a previously downloaded JSON backup. The file will be validated and its contents previewed before any database changes.</p>
                <input
                  ref={restoreFileInput}
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => void handleRestoreFile(event)}
                  className="backup-file-input"
                  disabled={validatingBackup || restoringBackup}
                />
                <button
                  type="button"
                  className="backup-secondary-button"
                  onClick={() => restoreFileInput.current?.click()}
                  disabled={restoringBackup || validatingBackup}
                >
                  {validatingBackup ? <><RefreshCw size={15} className="backup-spin" /> Validating backup...</> : <><FileUp size={15} /> Select backup file</>}
                </button>
              </div>
            </div>

            {selectedBackup && (
              <div className="restore-preview">
                <div className="restore-preview-heading">
                  <div>
                    <h3>Backup validation preview</h3>
                    <p>{selectedBackupName}</p>
                  </div>
                  <span className="restore-valid-label"><CheckCircle2 size={14} /> Valid format</span>
                </div>
                <div className="restore-preview-meta">
                  <span>Backup date: {formatDate(selectedBackup.created_at)}</span>
                  <span>Format version: {selectedBackup.backup_format_version}</span>
                </div>
                <div className="restore-preview-counts">
                  <div><strong>{selectedBackup.record_counts.product_categories}</strong><span>Categories</span></div>
                  <div><strong>{selectedBackup.record_counts.products}</strong><span>Products</span></div>
                  <div><strong>{selectedBackup.record_counts.stock_movements}</strong><span>Stock movements</span></div>
                </div>
                <div className="restore-warning">
                  <AlertCircle size={17} />
                  <span>Restoring will replace all existing records in these three tables. Create a fresh backup of the current data before continuing.</span>
                </div>
                <button
                  type="button"
                  className="restore-confirm-button"
                  onClick={() => void restoreSelectedBackup()}
                  disabled={restoringBackup || validatingBackup}
                >
                  {restoringBackup ? <><RefreshCw size={15} className="backup-spin" /> Creating safety backup / restoring...</> : "Confirm and restore backup"}
                </button>
              </div>
            )}

            {lastBackupCounts && (
              <div className="backup-count-summary">
                <strong>Last backup record counts</strong>
                <span>Categories: {lastBackupCounts.product_categories}</span>
                <span>Products: {lastBackupCounts.products}</span>
                <span>Stock movements: {lastBackupCounts.stock_movements}</span>
              </div>
            )}

            <div className="cloud-backup-list">
              <div className="cloud-backup-heading">
                <div>
                  <h3>Cloud backups</h3>
                  <p>{cloudBackups.length} backup file(s) found in private storage</p>
                </div>
                <Cloud size={19} />
              </div>

              {loadingCloudBackups ? (
                <p className="backup-empty-state">Loading cloud backups...</p>
              ) : cloudBackups.length === 0 ? (
                <p className="backup-empty-state">No cloud backups found yet. Create your first backup above.</p>
              ) : (
                <div className="cloud-backup-items">
                  {cloudBackups.map((backup) => (
                    <div className="cloud-backup-item" key={backup.name}>
                      <div className="cloud-backup-file-icon"><FileUp size={18} /></div>
                      <div className="cloud-backup-file-info">
                        <strong>{backup.name}</strong>
                        <span>{formatDate(backup.created_at)} · {formatBytes(backup.metadata?.size)}</span>
                      </div>
                      <button
                        type="button"
                        className="cloud-download-button"
                        onClick={() => void downloadCloudBackup(backup.name)}
                      >
                        <Download size={15} />
                        Download
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="backup-scope-note">
              <strong>What's included:</strong> product categories, products and stock movements, including inactive records.
              <br />
              <strong>Not included:</strong> login accounts, database policies, database functions or Supabase infrastructure settings. Those require separate platform-level backups.
              <br />
              <strong>Restore:</strong> selected files are checked by the database before restoration. A fresh safety backup is uploaded to private cloud storage before any restore begins.
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default SettingsManagement;
