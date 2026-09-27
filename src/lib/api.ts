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

export interface RangeInfo {
  start: string;
  end: string;
  days: number;
}

export interface PeriodInfo {
  month: string;
  isCurrentMonth: boolean;
  today: string;
  range: RangeInfo;
  compareRange: RangeInfo;
  previousRange: RangeInfo;
  cutDay: number | null;
  differentLength: boolean;
  hasPrevious: boolean;
}

export interface Metric {
  total: number;
  compare: number;
  previous: number | null;
  change: number | null;
  changePct: number | null;
}

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  kind: Kind;
  archived: boolean;
  total: number;
  count: number;
  sharePct: number | null;
  compare: number;
  previous: number | null;
  change: number | null;
  changePct: number | null;
}

export interface Series {
  current: number[];
  previous: number[] | null;
}

export interface InsightCategory {
  id: string;
  name: string;
  current: number;
  previous: number;
  change: number;
}

export interface Insight {
  kind: Kind;
  type: "explains" | "adds_offsets" | "offsets" | "new";
  category: InsightCategory;
  other: InsightCategory | null;
  totalChange: number;
  sharePct: number | null;
}

export interface Summary extends PeriodInfo {
  firstMonth: string | null;
  futureExcluded: number;
  expense: Metric;
  income: Metric;
  balance: number;
  balanceCompare: number;
  balancePrevious: number | null;
  balanceChange: number | null;
  retainedPct: number | null;
  categories: CategoryRow[];
  cumulative: { expense: Series; income: Series };
  insights: Insight[];
}

export interface DetailStats {
  total: number;
  count: number;
  average: number | null;
}

export interface CategoryDetail extends PeriodInfo {
  category: Category;
  current: DetailStats;
  compare: DetailStats;
  previous: DetailStats | null;
  sharePct: number | null;
  totalChange: number | null;
  totalChangePct: number | null;
  countChange: number | null;
  countChangePct: number | null;
  averageChange: number | null;
  averageChangePct: number | null;
  evolution: { month: string; total: number; count: number }[];
  evolutionDay: number | null;
  movements: Movement[];
  movementCount: number;
}

export interface SearchRequest {
  query: string;
  start: string | null;
  end: string | null;
  categoryLimit: number;
  movementLimit: number;
  movementOffset: number;
}

export interface SearchResults {
  query: string;
  categories: Category[];
  categoryTotal: number;
  movements: Movement[];
  movementTotal: number;
}

export interface AppError {
  code: string;
  message: string;
  field?: "amount" | "category" | "date" | "note" | "name" | "icon";
}

/** Datos editables de un movimiento guardado (para deshacer ediciones). */
export function movementToInput(m: Movement): MovementInput {
  const cents = m.amountCents;
  return {
    kind: m.kind,
    amount: `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`,
    categoryId: m.categoryId,
    date: m.date,
    note: m.note,
  };
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

  analyticsSummary: (month: string) => call<Summary>("analytics_summary", { month }),
  categoryDetail: (categoryId: string, month: string, limit: number) =>
    call<CategoryDetail>("category_detail", { categoryId, month, limit }),
  search: (request: SearchRequest) => call<SearchResults>("search", { request }),

  backupInfo: () => call<BackupInfo>("backup_info"),
  createBackup: () => call<BackupFile>("create_backup"),
  exportBackup: (path: string) => call<BackupFile>("export_backup", { path }),
  inspectBackup: (path: string) => call<BackupSummary>("inspect_backup", { path }),
  restoreBackup: (path: string) => call<BackupFile>("restore_backup", { path }),
  openBackupsFolder: () => call<void>("open_backups_folder"),
};
