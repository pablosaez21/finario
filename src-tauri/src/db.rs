use std::path::Path;

use rusqlite::{functions::FunctionFlags, Connection};

use crate::error::{AppError, AppResult};

/// Identifica los archivos SQLite de Finario ("FINA").
pub const APPLICATION_ID: i32 = 0x4649_4E41;

/// Migraciones ordenadas. Nunca modificar una ya publicada: añadir una nueva al final.
const MIGRATIONS: &[&str] = &[
    // 1 — esquema inicial y catálogo provisional de categorías.
    r#"
    CREATE TABLE categories (
        id          TEXT PRIMARY KEY,
        kind        TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
        name        TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
        icon        TEXT NOT NULL,
        sort_order  INTEGER NOT NULL DEFAULT 0,
        archived_at TEXT,
        created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE UNIQUE INDEX categories_kind_name ON categories (kind, name COLLATE NOCASE);

    CREATE TRIGGER categories_kind_immutable BEFORE UPDATE OF kind ON categories
    WHEN NEW.kind IS NOT OLD.kind
    BEGIN SELECT RAISE(ABORT, 'category_kind_immutable'); END;

    CREATE TABLE movements (
        id           TEXT PRIMARY KEY,
        kind         TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
        amount_cents INTEGER NOT NULL CHECK (typeof(amount_cents) = 'integer' AND amount_cents > 0 AND amount_cents <= 100000000000),
        currency     TEXT NOT NULL DEFAULT 'EUR' CHECK (currency = 'EUR'),
        category_id  TEXT NOT NULL REFERENCES categories (id) ON UPDATE RESTRICT ON DELETE RESTRICT,
        date         TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(date) IS date),
        note         TEXT CHECK (note IS NULL OR length(note) BETWEEN 1 AND 120),
        created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        deleted_at   TEXT
    );
    CREATE INDEX movements_recent ON movements (deleted_at, date DESC, created_at DESC);
    CREATE INDEX movements_category ON movements (category_id);

    CREATE TRIGGER movements_kind_insert BEFORE INSERT ON movements
    WHEN (SELECT kind FROM categories WHERE id = NEW.category_id) IS NOT NEW.kind
    BEGIN SELECT RAISE(ABORT, 'category_kind_mismatch'); END;

    CREATE TRIGGER movements_kind_update BEFORE UPDATE OF kind, category_id ON movements
    WHEN (SELECT kind FROM categories WHERE id = NEW.category_id) IS NOT NEW.kind
    BEGIN SELECT RAISE(ABORT, 'category_kind_mismatch'); END;

    CREATE TABLE settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    INSERT INTO categories (id, kind, name, icon, sort_order) VALUES
        ('alimentacion',   'expense', 'Alimentación',   'shopping-basket',    1),
        ('vivienda',       'expense', 'Vivienda',       'house',              2),
        ('transporte',     'expense', 'Transporte',     'train-front',        3),
        ('ocio',           'expense', 'Ocio',           'ticket',             4),
        ('suscripciones',  'expense', 'Suscripciones',  'repeat',             5),
        ('salud',          'expense', 'Salud',          'heart-pulse',        6),
        ('nomina',         'income',  'Nómina',         'briefcase-business', 1),
        ('freelance',      'income',  'Freelance',      'laptop',             2),
        ('otros-ingresos', 'income',  'Otros ingresos', 'wallet',             3);
    "#,
];

pub fn schema_version() -> i32 {
    MIGRATIONS.len() as i32
}

pub fn configure(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = FULL;
         PRAGMA busy_timeout = 5000;",
    )?;
    let fk: i32 = conn.query_row("PRAGMA foreign_keys", [], |r| r.get(0))?;
    if fk != 1 {
        return Err(AppError::new("database", "No se pudo activar la integridad referencial."));
    }
    conn.create_scalar_function(
        "fold",
        1,
        FunctionFlags::SQLITE_UTF8 | FunctionFlags::SQLITE_DETERMINISTIC,
        |ctx| Ok(ctx.get::<Option<String>>(0)?.map(|s| fold(&s))),
    )?;
    Ok(())
}

/// Normaliza texto para búsquedas: minúsculas y sin tildes ni diéresis ("Nómina" → "nomina").
pub fn fold(text: &str) -> String {
    text.chars()
        .flat_map(char::to_lowercase)
        .map(|c| match c {
            'á' | 'à' | 'â' | 'ä' | 'ã' | 'å' => 'a',
            'é' | 'è' | 'ê' | 'ë' => 'e',
            'í' | 'ì' | 'î' | 'ï' => 'i',
            'ó' | 'ò' | 'ô' | 'ö' | 'õ' => 'o',
            'ú' | 'ù' | 'û' | 'ü' => 'u',
            'ñ' => 'n',
            'ç' => 'c',
            'ý' | 'ÿ' => 'y',
            other => other,
        })
        .collect()
}

pub fn migrate(conn: &mut Connection) -> AppResult<()> {
    let app_id: i32 = conn.query_row("PRAGMA application_id", [], |r| r.get(0))?;
    let current: i32 = conn.query_row("PRAGMA user_version", [], |r| r.get(0))?;
    if app_id != 0 && app_id != APPLICATION_ID {
        return Err(AppError::new("not_finario", "El archivo no es una base de datos de Finario."));
    }
    if current > schema_version() {
        return Err(AppError::new(
            "newer_schema",
            "Los datos se crearon con una versión más reciente de Finario. Actualiza la aplicación.",
        ));
    }
    for (index, sql) in MIGRATIONS.iter().enumerate().skip(current as usize) {
        let tx = conn.transaction()?;
        tx.execute_batch(sql)?;
        tx.pragma_update(None, "user_version", index as i32 + 1)?;
        tx.commit()?;
    }
    conn.pragma_update(None, "application_id", APPLICATION_ID)?;
    Ok(())
}

pub fn open(path: &Path) -> AppResult<Connection> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let mut conn = Connection::open(path)?;
    configure(&conn)?;
    migrate(&mut conn)?;
    Ok(conn)
}
