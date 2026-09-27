use crate::error::{AppError, AppResult};

/// Límite superior: 1.000.000.000,00 €.
pub const MAX_CENTS: i64 = 100_000_000_000;

const FIELD: &str = "amount";

fn invalid(message: &str) -> AppError {
    AppError::field(FIELD, "invalid_amount", message)
}

fn digits_to_i64(digits: &str) -> AppResult<i64> {
    digits
        .bytes()
        .try_fold(0i64, |acc, b| acc.checked_mul(10)?.checked_add(i64::from(b - b'0')))
        .ok_or_else(|| invalid("El importe es demasiado grande."))
}

/// Comprueba grupos de miles con punto: "1.234.567".
fn valid_thousands(int_part: &str) -> bool {
    let mut groups = int_part.split('.');
    let first = groups.next().unwrap_or_default();
    (1..=3).contains(&first.len()) && groups.all(|g| g.len() == 3)
}

/// Convierte un importe escrito por el usuario en céntimos enteros, sin coma flotante.
///
/// Acepta coma decimal ("12,5"), punto decimal con 1–2 decimales ("12.50") y separador
/// de miles con punto cuando hay coma decimal ("1.234,56") o varios grupos ("1.234.567").
/// Rechaza vacíos, cero, negativos, más de dos decimales y casos ambiguos como "1.234".
pub fn parse_amount(input: &str) -> AppResult<i64> {
    let cleaned: String = input
        .trim()
        .trim_end_matches('€')
        .chars()
        .filter(|c| !c.is_whitespace())
        .collect();
    if cleaned.is_empty() {
        return Err(invalid("Escribe un importe."));
    }
    if cleaned.starts_with('-') || cleaned.starts_with('−') {
        return Err(invalid("El importe debe ser positivo. Elige Gasto o Ingreso para indicar el signo."));
    }
    if !cleaned.chars().all(|c| c.is_ascii_digit() || c == ',' || c == '.') {
        return Err(invalid("Usa solo cifras y una coma para los decimales."));
    }

    let commas = cleaned.matches(',').count();
    let dots = cleaned.matches('.').count();
    let (int_part, frac_part) = match (commas, dots) {
        (0, 0) => (cleaned.clone(), String::new()),
        (1, _) => {
            let (int_raw, frac) = cleaned.split_once(',').unwrap();
            if dots > 0 && !valid_thousands(int_raw) {
                return Err(invalid("Separa los miles con punto (1.234,56) o no los separes."));
            }
            (int_raw.replace('.', ""), frac.to_string())
        }
        (0, 1) => {
            let (int_raw, frac) = cleaned.split_once('.').unwrap();
            if frac.len() == 3 {
                return Err(invalid("Importe ambiguo: usa coma para decimales (12,50) o escribe los miles sin punto."));
            }
            (int_raw.to_string(), frac.to_string())
        }
        (0, _) if valid_thousands(&cleaned) => (cleaned.replace('.', ""), String::new()),
        _ => return Err(invalid("Formato no válido. Ejemplo: 12,50")),
    };

    if !int_part.bytes().chain(frac_part.bytes()).all(|b| b.is_ascii_digit()) {
        return Err(invalid("Formato no válido. Ejemplo: 12,50"));
    }
    if int_part.is_empty() && frac_part.is_empty() {
        return Err(invalid("Escribe un importe."));
    }
    if frac_part.len() > 2 {
        return Err(invalid("Usa como máximo dos decimales."));
    }
    if (commas + dots > 0) && frac_part.is_empty() && commas == 1 {
        return Err(invalid("Faltan los decimales después de la coma."));
    }

    let euros = if int_part.is_empty() { 0 } else { digits_to_i64(&int_part)? };
    let cents = match frac_part.len() {
        0 => 0,
        1 => digits_to_i64(&frac_part)? * 10,
        _ => digits_to_i64(&frac_part)?,
    };
    let total = euros
        .checked_mul(100)
        .and_then(|v| v.checked_add(cents))
        .ok_or_else(|| invalid("El importe es demasiado grande."))?;
    if total == 0 {
        return Err(invalid("El importe debe ser mayor que cero."));
    }
    if total > MAX_CENTS {
        return Err(invalid("El importe es demasiado grande."));
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::parse_amount;

    #[test]
    fn accepts_common_formats() {
        let cases = [
            ("12", 1200),
            ("12,5", 1250),
            ("12,50", 1250),
            ("0,01", 1),
            (",5", 50),
            ("12.5", 1250),
            ("12.05", 1205),
            ("1.234,56", 123_456),
            ("1.234.567", 123_456_700),
            (" 30,00 € ", 3000),
            ("1 250,40", 125_040),
            ("1000000000", 100_000_000_000),
        ];
        for (input, expected) in cases {
            assert_eq!(parse_amount(input).unwrap(), expected, "input {input:?}");
        }
    }

    #[test]
    fn rejects_invalid_and_ambiguous() {
        for input in [
            "", "   ", "0", "0,00", "-5", "−5", "abc", "12,345", "1.234", "1,2,3", "12,", "1.2.3",
            "12.3.45", "1,234.56", "12.34,5.6", "1000000000,01", "99999999999999999999",
        ] {
            assert!(parse_amount(input).is_err(), "should reject {input:?}");
        }
    }
}
