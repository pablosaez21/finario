mod analytics;
mod backup;
mod db;
mod error;
mod money;
mod store;

#[cfg(test)]
mod analytics_tests;
#[cfg(test)]
mod tests;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::{Manager, State};

use analytics::{CategoryDetail, SearchRequest, SearchResults, Summary};
use backup::{BackupFile, BackupInfo, BackupKind, BackupSummary};
use error::{AppError, AppResult};
use store::{Category, Kind, Movement, MovementInput, MovementPage, Store};

struct AppState(Mutex<Store>);

impl AppState {
    fn with<T>(&self, f: impl FnOnce(&mut Store) -> AppResult<T>) -> AppResult<T> {
        let mut store = self.0.lock().map_err(|_| AppError::new("lock", "La base de datos local no está disponible."))?;
        f(&mut store)
    }
}

type Cmd<'a> = State<'a, AppState>;

#[tauri::command]
async fn list_categories(state: Cmd<'_>, include_archived: bool) -> AppResult<Vec<Category>> {
    state.with(|s| s.list_categories(include_archived))
}

#[tauri::command]
async fn create_category(state: Cmd<'_>, kind: Kind, name: String, icon: String) -> AppResult<Category> {
    state.with(|s| s.create_category(kind, &name, &icon))
}

#[tauri::command]
async fn update_category(state: Cmd<'_>, id: String, name: String, icon: String) -> AppResult<Category> {
    state.with(|s| s.update_category(&id, &name, &icon))
}

#[tauri::command]
async fn set_category_archived(state: Cmd<'_>, id: String, archived: bool) -> AppResult<Category> {
    state.with(|s| s.set_category_archived(&id, archived))
}

#[tauri::command]
async fn reorder_categories(state: Cmd<'_>, kind: Kind, ids: Vec<String>) -> AppResult<Vec<Category>> {
    state.with(|s| s.reorder_categories(kind, &ids))
}

#[tauri::command]
async fn list_movements(state: Cmd<'_>, limit: i64, offset: i64) -> AppResult<MovementPage> {
    state.with(|s| s.list_movements(limit, offset))
}

#[tauri::command]
async fn create_movement(state: Cmd<'_>, input: MovementInput) -> AppResult<Movement> {
    state.with(|s| s.create_movement(&input))
}

#[tauri::command]
async fn update_movement(state: Cmd<'_>, id: String, input: MovementInput) -> AppResult<Movement> {
    state.with(|s| s.update_movement(&id, &input))
}

#[tauri::command]
async fn delete_movement(state: Cmd<'_>, id: String) -> AppResult<()> {
    state.with(|s| s.delete_movement(&id))
}

#[tauri::command]
async fn restore_movement(state: Cmd<'_>, id: String) -> AppResult<Movement> {
    state.with(|s| s.restore_movement(&id))
}

fn today() -> chrono::NaiveDate {
    chrono::Local::now().date_naive()
}

#[tauri::command]
async fn analytics_summary(state: Cmd<'_>, month: String) -> AppResult<Summary> {
    state.with(|s| s.analytics_summary(&month, today()))
}

#[tauri::command]
async fn category_detail(state: Cmd<'_>, category_id: String, month: String, limit: i64) -> AppResult<CategoryDetail> {
    state.with(|s| s.category_detail(&category_id, &month, limit, today()))
}

#[tauri::command]
async fn search(state: Cmd<'_>, request: SearchRequest) -> AppResult<SearchResults> {
    state.with(|s| s.search(&request))
}

#[tauri::command]
async fn backup_info(state: Cmd<'_>) -> AppResult<BackupInfo> {
    state.with(|s| s.backup_info())
}

#[tauri::command]
async fn create_backup(state: Cmd<'_>) -> AppResult<BackupFile> {
    state.with(|s| s.create_backup(BackupKind::Manual))
}

#[tauri::command]
async fn export_backup(state: Cmd<'_>, path: String) -> AppResult<BackupFile> {
    state.with(|s| s.export_backup(&PathBuf::from(path)))
}

#[tauri::command]
async fn inspect_backup(path: String) -> AppResult<BackupSummary> {
    backup::inspect(&PathBuf::from(path))
}

#[tauri::command]
async fn restore_backup(state: Cmd<'_>, path: String) -> AppResult<BackupFile> {
    state.with(|s| s.restore_backup(&PathBuf::from(path)))
}

#[tauri::command]
async fn open_backups_folder(state: Cmd<'_>) -> AppResult<()> {
    let dir = state.with(|s| Ok(s.backups_dir.clone()))?;
    std::fs::create_dir_all(&dir)?;
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "windows") {
        "explorer"
    } else {
        "xdg-open"
    };
    std::process::Command::new(opener).arg(&dir).spawn()?;
    Ok(())
}

pub fn run() {
    with_commands(tauri::Builder::default())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            let (db_path, backups_dir) = backup::default_paths(&data_dir);
            let store = Store::open(&db_path, &backups_dir).map_err(|e| e.message)?;
            if let Err(e) = store.auto_backup_if_due() {
                eprintln!("Finario: no se pudo crear la copia automática: {e}");
            }
            app.manage(AppState(Mutex::new(store)));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar Finario");
}

fn with_commands<R: tauri::Runtime>(builder: tauri::Builder<R>) -> tauri::Builder<R> {
    builder.invoke_handler(tauri::generate_handler![
        list_categories,
        create_category,
        update_category,
        set_category_archived,
        reorder_categories,
        list_movements,
        create_movement,
        update_movement,
        delete_movement,
        restore_movement,
        analytics_summary,
        category_detail,
        search,
        backup_info,
        create_backup,
        export_backup,
        inspect_backup,
        restore_backup,
        open_backups_folder,
    ])
}
