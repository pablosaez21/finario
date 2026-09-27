import { invoke } from "@tauri-apps/api/core";

export type Kind = "expense" | "income";

export interface Category {
  id: string;
  kind: Kind;
  name: string;
  icon: string;
  sortOrder: number;
  archived: boolean;
  movementCount: number;
}

export interface Movement {
  id: string;
  kind: Kind;
  amountCents: number;
  currency: string;
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MovementInput {
  id?: string;
  kind: Kind;
  amount: string;
  categoryId: string;
  date: string;
  note?: string | null;
}

export interface MovementPage {
  items: Movement[];
  total: number;
}

export interface BackupFile {
  path: string;
  fileName: string;
  kind: string;
  created: string;
  sizeBytes: number;
}

export interface BackupInfo {
  dbPath: string;
  backupsDir: string;
  autoKeep: number;
  backups: BackupFile[];
}

export interface BackupSummary {
  path: string;
  schemaVersion: number;
  movements: number;
  categories: number;
  lastMovementDate: string | null;
}

export interface AppError {
  code: string;
  message: string;
  field?: "amount" | "category" | "date" | "note" | "name" | "icon";
}

export function toAppError(err: unknown): AppError {
  if (err && typeof err === "object" && "message" in err) {
    const e = err as Partial<AppError>;
    return { code: e.code ?? "unknown", message: String(e.message), field: e.field };
  }
  return { code: "unknown", message: typeof err === "string" ? err : "Ha ocurrido un error inesperado." };
}

const call = async <T>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
  try {
    return await invoke<T>(cmd, args);
  } catch (err) {
    throw toAppError(err);
  }
};

export const api = {
  listCategories: (includeArchived = true) => call<Category[]>("list_categories", { includeArchived }),
  createCategory: (kind: Kind, name: string, icon: string) => call<Category>("create_category", { kind, name, icon }),
  updateCategory: (id: string, name: string, icon: string) => call<Category>("update_category", { id, name, icon }),
  setCategoryArchived: (id: string, archived: boolean) => call<Category>("set_category_archived", { id, archived }),
  reorderCategories: (kind: Kind, ids: string[]) => call<Category[]>("reorder_categories", { kind, ids }),

  listMovements: (limit: number, offset = 0) => call<MovementPage>("list_movements", { limit, offset }),
  createMovement: (input: MovementInput) => call<Movement>("create_movement", { input }),
  updateMovement: (id: string, input: MovementInput) => call<Movement>("update_movement", { id, input }),
  deleteMovement: (id: string) => call<void>("delete_movement", { id }),
  restoreMovement: (id: string) => call<Movement>("restore_movement", { id }),

  backupInfo: () => call<BackupInfo>("backup_info"),
  createBackup: () => call<BackupFile>("create_backup"),
  exportBackup: (path: string) => call<BackupFile>("export_backup", { path }),
  inspectBackup: (path: string) => call<BackupSummary>("inspect_backup", { path }),
  restoreBackup: (path: string) => call<BackupFile>("restore_backup", { path }),
  openBackupsFolder: () => call<void>("open_backups_folder"),
};
