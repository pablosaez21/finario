use std::path::{Path, PathBuf};
use std::time::Duration;

use chrono::Local;
use rusqlite::{backup::Backup, Connection, OpenFlags};
use serde::Serialize;

use crate::db;
use crate::error::{AppError, AppResult};
use crate::store::Store;

/// Número de copias automáticas que se conservan.
pub const AUTO_KEEP: usize = 14;
const PREFIX: &str = "finario-";
const EXT: &str = "sqlite3";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BackupKind {
    Auto,
    Manual,
    PreRestore,
}

impl BackupKind {
    fn tag(self) -> &'static str {
        match self {
            BackupKind::Auto => "auto",
            BackupKind::Manual => "manual",
            BackupKind::PreRestore => "antes-de-restaurar",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub path: String,
    pub file_name: String,
    pub kind: String,
    pub created: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupSummary {
    pub path: String,
    pub schema_version: i32,
    pub movements: i64,
    pub categories: i64,
    pub last_movement_date: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub db_path: String,
    pub backups_dir: String,
    pub auto_keep: usize,
    pub backups: Vec<BackupFile>,
}

fn backup_file(path: &Path) -> Option<BackupFile> {
    let file_name = path.file_name()?.to_str()?.to_string();
    let stem = file_name.strip_prefix(PREFIX)?.strip_suffix(&format!(".{EXT}"))?;
    let (kind, stamp) = stem.rsplit_once('-').and_then(|(rest, time)| {
        let (kind, date) = rest.rsplit_once('-')?;
        let time = time.split('.').next()?;
        Some((kind.to_string(), format!("{date}-{time}")))
    })?;
    let created = chrono::NaiveDateTime::parse_from_str(&stamp, "%Y%m%d-%H%M%S").ok()?;
    Some(BackupFile {
        path: path.to_string_lossy().into_owned(),
        file_name,
        kind,
        created: created.format("%Y-%m-%dT%H:%M:%S").to_string(),
        size_bytes: std::fs::metadata(path).map(|m| m.len()).unwrap_or(0),
    })
}

/// Valida que un archivo sea una copia íntegra de Finario y resume su contenido.
pub fn inspect(path: &Path) -> AppResult<BackupSummary> {
    let invalid = |why: &str| AppError::new("invalid_backup", format!("El archivo no es una copia válida de Finario: {why}."));
    if !path.is_file() {
        return Err(invalid("no existe"));
    }
    let conn = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX)
        .map_err(|_| invalid("no se puede abrir"))?;
    let app_id: i32 = conn.query_row("PRAGMA application_id", [], |r| r.get(0)).map_err(|_| invalid("no es SQLite"))?;
    if app_id != db::APPLICATION_ID {
        return Err(invalid("no pertenece a Finario"));
    }
    let version: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if version < 1 || version > db::schema_version() {
        return Err(invalid("versión de datos no compatible"));
    }
    let check: String = conn.query_row("PRAGMA quick_check", [], |r| r.get(0))?;
    if check != "ok" {
        return Err(invalid("está dañado"));
    }
    let fk_problems: i64 = conn.query_row("SELECT COUNT(*) FROM pragma_foreign_key_check", [], |r| r.get(0))?;
    if fk_problems > 0 {
        return Err(invalid("tiene referencias incoherentes"));
    }
    let movements = conn.query_row("SELECT COUNT(*) FROM movements WHERE deleted_at IS NULL", [], |r| r.get(0))?;
    let categories = conn.query_row("SELECT COUNT(*) FROM categories", [], |r| r.get(0))?;
    let last_movement_date =
        conn.query_row("SELECT MAX(date) FROM movements WHERE deleted_at IS NULL", [], |r| r.get(0))?;
    Ok(BackupSummary { path: path.to_string_lossy().into_owned(), schema_version: version, movements, categories, last_movement_date })
}

impl Store {
    fn write_snapshot(&self, dest: &Path) -> AppResult<()> {
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let tmp = dest.with_extension("tmp");
        let _ = std::fs::remove_file(&tmp);
        self.conn.execute("VACUUM INTO ?1", [tmp.to_string_lossy()])?;
        std::fs::rename(&tmp, dest)?;
        Ok(())
    }

    pub fn create_backup(&self, kind: BackupKind) -> AppResult<BackupFile> {
        let stamp = Local::now().format("%Y%m%d-%H%M%S");
        let mut dest = self.backups_dir.join(format!("{PREFIX}{}-{stamp}.{EXT}", kind.tag()));
        let mut n = 1;
        while dest.exists() {
            n += 1;
            dest = self.backups_dir.join(format!("{PREFIX}{}-{stamp}.{n}.{EXT}", kind.tag()));
        }
        self.write_snapshot(&dest)?;
        if kind == BackupKind::Auto {
            self.prune_auto_backups()?;
        }
        Ok(backup_file(&dest).unwrap_or(BackupFile {
            path: dest.to_string_lossy().into_owned(),
            file_name: dest.file_name().unwrap_or_default().to_string_lossy().into_owned(),
            kind: kind.tag().into(),
            created: Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
            size_bytes: std::fs::metadata(&dest).map(|m| m.len()).unwrap_or(0),
        }))
    }

    pub fn list_backups(&self) -> AppResult<Vec<BackupFile>> {
        let mut files: Vec<BackupFile> = match std::fs::read_dir(&self.backups_dir) {
            Ok(entries) => entries.filter_map(|e| backup_file(&e.ok()?.path())).collect(),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Vec::new(),
            Err(e) => return Err(e.into()),
        };
        files.sort_by(|a, b| b.created.cmp(&a.created).then(b.file_name.cmp(&a.file_name)));
        Ok(files)
    }

    fn prune_auto_backups(&self) -> AppResult<()> {
        let autos: Vec<_> = self.list_backups()?.into_iter().filter(|b| b.kind == "auto").collect();
        for old in autos.iter().skip(AUTO_KEEP) {
            std::fs::remove_file(&old.path)?;
        }
        Ok(())
    }

    /// Copia automática diaria: se crea al abrir la app si no hay ninguna de hoy.
    pub fn auto_backup_if_due(&self) -> AppResult<Option<BackupFile>> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let done_today = self.list_backups()?.iter().any(|b| b.kind == "auto" && b.created.starts_with(&today));
        if done_today {
            return Ok(None);
        }
        self.create_backup(BackupKind::Auto).map(Some)
    }

    pub fn backup_info(&self) -> AppResult<BackupInfo> {
        Ok(BackupInfo {
            db_path: self.db_path.to_string_lossy().into_owned(),
            backups_dir: self.backups_dir.to_string_lossy().into_owned(),
            auto_keep: AUTO_KEEP,
            backups: self.list_backups()?,
        })
    }

    pub fn export_backup(&self, dest: &Path) -> AppResult<BackupFile> {
        if dest == self.db_path {
            return Err(AppError::new("invalid_path", "Elige otro destino para la copia."));
        }
        self.write_snapshot(dest)?;
        Ok(BackupFile {
            path: dest.to_string_lossy().into_owned(),
            file_name: dest.file_name().unwrap_or_default().to_string_lossy().into_owned(),
            kind: "exportada".into(),
            created: Local::now().format("%Y-%m-%dT%H:%M:%S").to_string(),
            size_bytes: std::fs::metadata(dest).map(|m| m.len()).unwrap_or(0),
        })
    }

    /// Sustituye los datos actuales por los de una copia validada. Antes guarda una copia del
    /// estado actual, que se devuelve para poder deshacer la restauración.
    pub fn restore_backup(&mut self, source: &Path) -> AppResult<BackupFile> {
        inspect(source)?;
        let safety = self.create_backup(BackupKind::PreRestore)?;
        let src = Connection::open_with_flags(source, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
        {
            let backup = Backup::new(&src, &mut self.conn)?;
            backup.run_to_completion(256, Duration::from_millis(0), None)?;
        }
        db::configure(&self.conn)?;
        db::migrate(&mut self.conn)?;
        Ok(safety)
    }
}

pub fn default_paths(data_dir: &Path) -> (PathBuf, PathBuf) {
    (data_dir.join("finario.sqlite3"), data_dir.join("copias"))
}
