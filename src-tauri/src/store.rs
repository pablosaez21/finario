use std::path::{Path, PathBuf};

use chrono::{Datelike, NaiveDate};
use rusqlite::{params, Connection, OptionalExtension, Row};
use serde::{Deserialize, Serialize};

use crate::db;
use crate::error::{AppError, AppResult};
use crate::money::parse_amount;

/// Iconos permitidos para categorías (familia outline de Lucide en la interfaz).
pub const ICONS: &[&str] = &[
    "shopping-basket", "shopping-cart", "house", "train-front", "bus", "car", "fuel", "ticket",
    "repeat", "heart-pulse", "pill", "utensils", "coffee", "shirt", "gift", "book-open",
    "graduation-cap", "plane", "dumbbell", "paw-print", "baby", "smartphone", "wifi", "zap",
    "receipt", "piggy-bank", "briefcase-business", "laptop", "wallet", "hand-coins", "landmark",
    "circle-ellipsis",
];

pub const NOTE_MAX: usize = 120;
pub const CATEGORY_NAME_MAX: usize = 40;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Expense,
    Income,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Expense => "expense",
            Kind::Income => "income",
        }
    }

    pub(crate) fn parse(value: &str) -> rusqlite::Result<Self> {
        match value {
            "expense" => Ok(Kind::Expense),
            "income" => Ok(Kind::Income),
            other => Err(rusqlite::Error::InvalidColumnType(0, other.into(), rusqlite::types::Type::Text)),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Category {
    pub id: String,
    pub kind: Kind,
    pub name: String,
    pub icon: String,
    pub sort_order: i64,
    pub archived: bool,
    pub movement_count: i64,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Movement {
    pub id: String,
    pub kind: Kind,
    pub amount_cents: i64,
    pub currency: String,
    pub category_id: String,
    pub category_name: String,
    pub category_icon: String,
    pub date: String,
    pub note: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementInput {
    #[serde(default)]
    pub id: Option<String>,
    pub kind: Kind,
    pub amount: String,
    pub category_id: String,
    pub date: String,
    #[serde(default)]
    pub note: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MovementPage {
    pub items: Vec<Movement>,
    pub total: i64,
}

struct Validated {
    kind: Kind,
    amount_cents: i64,
    category_id: String,
    date: String,
    note: Option<String>,
}

pub struct Store {
    pub(crate) conn: Connection,
    pub(crate) db_path: PathBuf,
    pub(crate) backups_dir: PathBuf,
}

pub(crate) const MOVEMENT_SELECT: &str = "SELECT m.id, m.kind, m.amount_cents, m.currency, m.category_id, c.name, c.icon,
            m.date, m.note, m.created_at, m.updated_at
     FROM movements m JOIN categories c ON c.id = m.category_id";

pub(crate) const CATEGORY_SELECT: &str = "SELECT c.id, c.kind, c.name, c.icon, c.sort_order, c.archived_at IS NOT NULL,
            (SELECT COUNT(*) FROM movements m WHERE m.category_id = c.id AND m.deleted_at IS NULL)
     FROM categories c";

pub(crate) fn movement_from_row(row: &Row) -> rusqlite::Result<Movement> {
    Ok(Movement {
        id: row.get(0)?,
        kind: Kind::parse(&row.get::<_, String>(1)?)?,
        amount_cents: row.get(2)?,
        currency: row.get(3)?,
        category_id: row.get(4)?,
        category_name: row.get(5)?,
        category_icon: row.get(6)?,
        date: row.get(7)?,
        note: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub(crate) fn category_from_row(row: &Row) -> rusqlite::Result<Category> {
    Ok(Category {
        id: row.get(0)?,
        kind: Kind::parse(&row.get::<_, String>(1)?)?,
        name: row.get(2)?,
        icon: row.get(3)?,
        sort_order: row.get(4)?,
        archived: row.get(5)?,
        movement_count: row.get(6)?,
    })
}

pub fn validate_date(value: &str) -> AppResult<String> {
    let invalid = || AppError::field("date", "invalid_date", "Indica una fecha válida.");
    if value.len() != 10 {
        return Err(invalid());
    }
    let date = NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|_| invalid())?;
    if !(1900..=2200).contains(&date.year()) {
        return Err(AppError::field("date", "invalid_date", "La fecha está fuera del rango admitido."));
    }
    Ok(date.format("%Y-%m-%d").to_string())
}

fn validate_note(note: Option<&str>) -> AppResult<Option<String>> {
    let Some(text) = note.map(str::trim).filter(|t| !t.is_empty()) else {
        return Ok(None);
    };
    if text.chars().count() > NOTE_MAX {
        return Err(AppError::field("note", "note_too_long", format!("El concepto admite como máximo {NOTE_MAX} caracteres.")));
    }
    Ok(Some(text.to_string()))
}

fn validate_category_name(name: &str) -> AppResult<String> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if name.is_empty() {
        return Err(AppError::field("name", "invalid_name", "Escribe un nombre para la categoría."));
    }
    if name.chars().count() > CATEGORY_NAME_MAX {
        return Err(AppError::field("name", "invalid_name", format!("El nombre admite como máximo {CATEGORY_NAME_MAX} caracteres.")));
    }
    Ok(name)
}

fn validate_icon(icon: &str) -> AppResult<String> {
    if ICONS.contains(&icon) {
        Ok(icon.to_string())
    } else {
        Err(AppError::field("icon", "invalid_icon", "Elige un icono de la lista."))
    }
}

fn validate_id(id: &str) -> AppResult<String> {
    uuid::Uuid::parse_str(id)
        .map(|u| u.to_string())
        .map_err(|_| AppError::new("invalid_id", "Identificador de movimiento no válido."))
}

impl Store {
    pub fn open(db_path: &Path, backups_dir: &Path) -> AppResult<Self> {
        let conn = db::open(db_path)?;
        Ok(Self { conn, db_path: db_path.to_path_buf(), backups_dir: backups_dir.to_path_buf() })
    }

    // ---------- Categorías ----------

    pub fn list_categories(&self, include_archived: bool) -> AppResult<Vec<Category>> {
        let sql = format!(
            "{CATEGORY_SELECT} {} ORDER BY c.kind, c.sort_order, c.name",
            if include_archived { "" } else { "WHERE c.archived_at IS NULL" }
        );
        let mut stmt = self.conn.prepare(&sql)?;
        let rows = stmt.query_map([], category_from_row)?.collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }

    pub fn get_category(&self, id: &str) -> AppResult<Category> {
        self.conn
            .query_row(&format!("{CATEGORY_SELECT} WHERE c.id = ?1"), [id], category_from_row)
            .optional()?
            .ok_or_else(|| AppError::not_found("la categoría"))
    }

    fn ensure_unique_name(&self, kind: Kind, name: &str, except_id: Option<&str>) -> AppResult<()> {
        let lower = name.to_lowercase();
        let mut stmt = self.conn.prepare("SELECT id, name, archived_at IS NOT NULL FROM categories WHERE kind = ?1")?;
        let clash = stmt
            .query_map([kind.as_str()], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?, r.get::<_, bool>(2)?)))?
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .find(|(id, n, _)| n.to_lowercase() == lower && Some(id.as_str()) != except_id);
        match clash {
            Some((_, _, true)) => Err(AppError::field("name", "duplicate_name", "Ya existe una categoría archivada con ese nombre. Puedes recuperarla.")),
            Some(_) => Err(AppError::field("name", "duplicate_name", "Ya existe una categoría con ese nombre.")),
            None => Ok(()),
        }
    }

    pub fn create_category(&mut self, kind: Kind, name: &str, icon: &str) -> AppResult<Category> {
        let name = validate_category_name(name)?;
        let icon = validate_icon(icon)?;
        self.ensure_unique_name(kind, &name, None)?;
        let id = uuid::Uuid::new_v4().to_string();
        self.conn.execute(
            "INSERT INTO categories (id, kind, name, icon, sort_order)
             VALUES (?1, ?2, ?3, ?4, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories WHERE kind = ?2))",
            params![id, kind.as_str(), name, icon],
        )?;
        self.get_category(&id)
    }

    pub fn update_category(&mut self, id: &str, name: &str, icon: &str) -> AppResult<Category> {
        let current = self.get_category(id)?;
        let name = validate_category_name(name)?;
        let icon = validate_icon(icon)?;
        self.ensure_unique_name(current.kind, &name, Some(id))?;
        self.conn.execute(
            "UPDATE categories SET name = ?2, icon = ?3, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1",
            params![id, name, icon],
        )?;
        self.get_category(id)
    }

    pub fn set_category_archived(&mut self, id: &str, archived: bool) -> AppResult<Category> {
        let current = self.get_category(id)?;
        if archived && !current.archived {
            let active: i64 = self.conn.query_row(
                "SELECT COUNT(*) FROM categories WHERE kind = ?1 AND archived_at IS NULL",
                [current.kind.as_str()],
                |r| r.get(0),
            )?;
            if active <= 1 {
                return Err(AppError::new("last_category", "Debe quedar al menos una categoría activa de este tipo."));
            }
        }
        self.conn.execute(
            "UPDATE categories SET archived_at = CASE WHEN ?2 THEN COALESCE(archived_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) END,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?1",
            params![id, archived],
        )?;
        self.get_category(id)
    }

    pub fn reorder_categories(&mut self, kind: Kind, ids: &[String]) -> AppResult<Vec<Category>> {
        let tx = self.conn.transaction()?;
        for (index, id) in ids.iter().enumerate() {
            let changed = tx.execute(
                "UPDATE categories SET sort_order = ?3 WHERE id = ?1 AND kind = ?2",
                params![id, kind.as_str(), index as i64 + 1],
            )?;
            if changed != 1 {
                return Err(AppError::not_found("la categoría"));
            }
        }
        tx.commit()?;
        self.list_categories(true)
    }

    // ---------- Movimientos ----------

    fn validate_movement(&self, input: &MovementInput, previous_category: Option<&str>) -> AppResult<Validated> {
        let amount_cents = parse_amount(&input.amount)?;
        let category = self
            .conn
            .query_row(
                "SELECT kind, archived_at IS NOT NULL FROM categories WHERE id = ?1",
                [&input.category_id],
                |r| Ok((r.get::<_, String>(0)?, r.get::<_, bool>(1)?)),
            )
            .optional()?;
        let Some((kind, archived)) = category else {
            return Err(AppError::field("category", "invalid_category", "Elige una categoría."));
        };
        if kind != input.kind.as_str() {
            return Err(AppError::field("category", "category_kind_mismatch", "La categoría no corresponde al tipo de movimiento."));
        }
        if archived && previous_category != Some(input.category_id.as_str()) {
            return Err(AppError::field("category", "category_archived", "Esa categoría está archivada. Elige otra."));
        }
        Ok(Validated {
            kind: input.kind,
            amount_cents,
            category_id: input.category_id.clone(),
            date: validate_date(&input.date)?,
            note: validate_note(input.note.as_deref())?,
        })
    }

    pub fn get_movement(&self, id: &str) -> AppResult<Movement> {
        self.conn
            .query_row(&format!("{MOVEMENT_SELECT} WHERE m.id = ?1 AND m.deleted_at IS NULL"), [id], movement_from_row)
            .optional()?
            .ok_or_else(|| AppError::not_found("el movimiento"))
    }

    pub fn list_movements(&self, limit: i64, offset: i64) -> AppResult<MovementPage> {
        let limit = limit.clamp(1, 500);
        let offset = offset.max(0);
        let mut stmt = self.conn.prepare(&format!(
            "{MOVEMENT_SELECT} WHERE m.deleted_at IS NULL
             ORDER BY m.date DESC, m.created_at DESC, m.id DESC LIMIT ?1 OFFSET ?2"
        ))?;
        let items = stmt.query_map([limit, offset], movement_from_row)?.collect::<Result<Vec<_>, _>>()?;
        let total = self.conn.query_row("SELECT COUNT(*) FROM movements WHERE deleted_at IS NULL", [], |r| r.get(0))?;
        Ok(MovementPage { items, total })
    }

    /// Crea un movimiento. Si llega un `id` ya guardado (doble envío), devuelve el existente
    /// sin duplicarlo.
    pub fn create_movement(&mut self, input: &MovementInput) -> AppResult<Movement> {
        let id = match input.id.as_deref() {
            Some(raw) => validate_id(raw)?,
            None => uuid::Uuid::new_v4().to_string(),
        };
        let exists: bool = self.conn.query_row("SELECT EXISTS (SELECT 1 FROM movements WHERE id = ?1)", [&id], |r| r.get(0))?;
        if exists {
            return self.get_movement(&id);
        }
        let v = self.validate_movement(input, None)?;
        self.conn.execute(
            "INSERT INTO movements (id, kind, amount_cents, currency, category_id, date, note)
             VALUES (?1, ?2, ?3, 'EUR', ?4, ?5, ?6)",
            params![id, v.kind.as_str(), v.amount_cents, v.category_id, v.date, v.note],
        )?;
        self.get_movement(&id)
    }

    pub fn update_movement(&mut self, id: &str, input: &MovementInput) -> AppResult<Movement> {
        let current = self.get_movement(id)?;
        let v = self.validate_movement(input, Some(&current.category_id))?;
        self.conn.execute(
            "UPDATE movements SET kind = ?2, amount_cents = ?3, category_id = ?4, date = ?5, note = ?6,
                 updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, v.kind.as_str(), v.amount_cents, v.category_id, v.date, v.note],
        )?;
        self.get_movement(id)
    }

    /// Borrado recuperable: marca el movimiento; `restore_movement` lo recupera.
    pub fn delete_movement(&mut self, id: &str) -> AppResult<()> {
        let changed = self.conn.execute(
            "UPDATE movements SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?1 AND deleted_at IS NULL",
            [id],
        )?;
        if changed == 0 {
            return Err(AppError::not_found("el movimiento"));
        }
        Ok(())
    }

    pub fn restore_movement(&mut self, id: &str) -> AppResult<Movement> {
        let changed = self.conn.execute(
            "UPDATE movements SET deleted_at = NULL WHERE id = ?1 AND deleted_at IS NOT NULL",
            [id],
        )?;
        if changed == 0 {
            return Err(AppError::not_found("el movimiento borrado"));
        }
        self.get_movement(id)
    }
}
