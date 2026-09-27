use serde::Serialize;

/// Error devuelto a la interfaz. `field` permite situar el mensaje junto al campo afectado.
#[derive(Debug, thiserror::Error, Serialize)]
#[error("{message}")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<&'static str>,
}

impl AppError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), field: None }
    }

    pub fn field(field: &'static str, code: &'static str, message: impl Into<String>) -> Self {
        Self { code, message: message.into(), field: Some(field) }
    }

    pub fn not_found(what: &str) -> Self {
        Self::new("not_found", format!("No se ha encontrado {what}."))
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        let text = err.to_string();
        if text.contains("category_kind_mismatch") {
            return Self::field("category", "category_kind_mismatch", "La categoría no corresponde al tipo de movimiento.");
        }
        if text.contains("category_kind_immutable") {
            return Self::new("category_kind_immutable", "No se puede cambiar el tipo de una categoría.");
        }
        if text.contains("FOREIGN KEY") {
            return Self::field("category", "invalid_reference", "La categoría indicada no existe.");
        }
        if text.contains("CHECK constraint") {
            return Self::new("invalid_data", "Los datos no son válidos y no se han guardado.");
        }
        Self::new("database", format!("Error de la base de datos local: {text}"))
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        Self::new("io", format!("Error de archivo: {err}"))
    }
}

pub type AppResult<T> = Result<T, AppError>;
