//! Analíticas y búsqueda local. Todos los cálculos se hacen sobre el historial completo en
//! SQLite, en céntimos enteros, excluyendo movimientos con borrado lógico y agrupando por ID
//! de categoría (las archivadas se conservan en los históricos). Ver docs/ANALYTICS.md.

use std::collections::{HashMap, HashSet};

use chrono::{Datelike, Duration, NaiveDate};
use rusqlite::params;
use serde::{Deserialize, Serialize};

use crate::db::fold;
use crate::error::{AppError, AppResult};
use crate::store::{
    category_from_row, movement_from_row, validate_date, Category, Kind, Movement, Store, CATEGORY_SELECT,
    MOVEMENT_SELECT,
};

const FMT: &str = "%Y-%m-%d";
/// Por debajo de 1 € el cambio total se considera «casi cero» para las observaciones.
const NEAR_ZERO_CENTS: i64 = 100;
pub const EVOLUTION_MONTHS: i32 = 6;
const SEARCH_MAX_CHARS: usize = 100;

// ---------- Periodos ----------

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Range {
    pub start: NaiveDate,
    pub end: NaiveDate,
}

impl Range {
    fn new(start: NaiveDate, end: NaiveDate) -> Self {
        Self { start, end }
    }

    fn days(&self) -> u32 {
        (self.end - self.start).num_days() as u32 + 1
    }

    fn bounds(&self) -> (String, String) {
        (self.start.format(FMT).to_string(), self.end.format(FMT).to_string())
    }
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RangeDto {
    pub start: String,
    pub end: String,
    pub days: u32,
}

impl From<Range> for RangeDto {
    fn from(r: Range) -> Self {
        let (start, end) = r.bounds();
        Self { start, end, days: r.days() }
    }
}

pub fn parse_month(value: &str) -> AppResult<NaiveDate> {
    let invalid = || AppError::new("invalid_month", "Mes no válido.");
    if value.len() != 7 {
        return Err(invalid());
    }
    NaiveDate::parse_from_str(&format!("{value}-01"), FMT).map_err(|_| invalid())
}

fn add_months(first: NaiveDate, delta: i32) -> NaiveDate {
    let index = first.year() * 12 + first.month0() as i32 + delta;
    NaiveDate::from_ymd_opt(index.div_euclid(12), index.rem_euclid(12) as u32 + 1, 1).expect("fecha válida")
}

fn last_day(first: NaiveDate) -> NaiveDate {
    add_months(first, 1) - Duration::days(1)
}

fn month_key(first: NaiveDate) -> String {
    first.format("%Y-%m").to_string()
}

/// Rangos de un análisis mensual.
///
/// - Mes en curso: del día 1 a hoy frente al mismo tramo del mes anterior. Si el anterior es
///   más corto, las comparaciones se cortan en el último día común (`cut_day`), mientras los
///   totales del mes actual se muestran completos hasta hoy.
/// - Mes cerrado: mes completo frente a mes anterior completo (`different_length` si difieren).
#[derive(Debug, Clone, PartialEq)]
pub struct Periods {
    pub month: NaiveDate,
    pub is_current: bool,
    pub display: Range,
    pub compare: Range,
    pub previous: Range,
    pub cut_day: Option<u32>,
    pub different_length: bool,
}

pub fn periods(month: NaiveDate, today: NaiveDate) -> AppResult<Periods> {
    let current_first = today.with_day(1).expect("día 1");
    if month > current_first {
        return Err(AppError::new("future_month", "No se pueden analizar meses futuros."));
    }
    let prev_first = add_months(month, -1);
    let prev_last = last_day(prev_first);
    if month == current_first {
        let common = today.day().min(prev_last.day());
        Ok(Periods {
            month,
            is_current: true,
            display: Range::new(month, today),
            compare: Range::new(month, month.with_day(common).expect("día común")),
            previous: Range::new(prev_first, prev_first.with_day(common).expect("día común")),
            cut_day: (common < today.day()).then_some(common),
            different_length: false,
        })
    } else {
        let last = last_day(month);
        Ok(Periods {
            month,
            is_current: false,
            display: Range::new(month, last),
            compare: Range::new(month, last),
            previous: Range::new(prev_first, prev_last),
            cut_day: None,
            different_length: last.day() != prev_last.day(),
        })
    }
}

/// Porcentaje con un decimal. `None` si el denominador es cero.
pub fn pct(num: i64, den: i64) -> Option<f64> {
    (den != 0).then(|| ((num as f64) * 1000.0 / den as f64).round() / 10.0)
}

/// Media en céntimos, redondeando la mitad hacia arriba.
fn average(total: i64, count: i64) -> Option<i64> {
    (count > 0).then(|| (total * 2 + count) / (count * 2))
}

// ---------- Tipos devueltos ----------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PeriodInfo {
    pub month: String,
    pub is_current_month: bool,
    pub today: String,
    pub range: RangeDto,
    pub compare_range: RangeDto,
    pub previous_range: RangeDto,
    pub cut_day: Option<u32>,
    pub different_length: bool,
    pub has_previous: bool,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Metric {
    /// Total del periodo mostrado.
    pub total: i64,
    /// Total del tramo comparable (igual a `total` salvo corte por días comunes).
    pub compare: i64,
    pub previous: Option<i64>,
    pub change: Option<i64>,
    pub change_pct: Option<f64>,
}

impl Metric {
    fn new(total: i64, compare: i64, previous: Option<i64>) -> Self {
        Self {
            total,
            compare,
            previous,
            change: previous.map(|p| compare - p),
            change_pct: previous.and_then(|p| pct(compare - p, p)),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryRow {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub kind: Kind,
    pub archived: bool,
    pub total: i64,
    pub count: i64,
    pub share_pct: Option<f64>,
    pub compare: i64,
    pub previous: Option<i64>,
    pub change: Option<i64>,
    pub change_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Series {
    /// Acumulado diario del periodo mostrado (índice 0 = día 1).
    pub current: Vec<i64>,
    /// Acumulado diario del periodo anterior comparable.
    pub previous: Option<Vec<i64>>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Cumulative {
    pub expense: Series,
    pub income: Series,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InsightCategory {
    pub id: String,
    pub name: String,
    pub current: i64,
    pub previous: i64,
    pub change: i64,
}

/// Observación calculada. `type`:
/// - `explains`: la categoría explica `share_pct` del cambio total (≤ 100 %).
/// - `adds_offsets`: la categoría añade y `other` compensa (el porcentaje confundiría).
/// - `offsets`: la categoría va en sentido contrario al cambio total.
/// - `new`: sin importe previo registrado en la categoría.
#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Insight {
    pub kind: Kind,
    #[serde(rename = "type")]
    pub kind_of: &'static str,
    pub category: InsightCategory,
    pub other: Option<InsightCategory>,
    pub total_change: i64,
    pub share_pct: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    #[serde(flatten)]
    pub period: PeriodInfo,
    pub first_month: Option<String>,
    pub future_excluded: i64,
    pub expense: Metric,
    pub income: Metric,
    pub balance: i64,
    pub balance_compare: i64,
    pub balance_previous: Option<i64>,
    pub balance_change: Option<i64>,
    pub retained_pct: Option<f64>,
    pub categories: Vec<CategoryRow>,
    pub cumulative: Cumulative,
    pub insights: Vec<Insight>,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct DetailStats {
    pub total: i64,
    pub count: i64,
    pub average: Option<i64>,
}

impl DetailStats {
    fn new(total: i64, count: i64) -> Self {
        Self { total, count, average: average(total, count) }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionPoint {
    pub month: String,
    pub total: i64,
    pub count: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryDetail {
    #[serde(flatten)]
    pub period: PeriodInfo,
    pub category: Category,
    pub current: DetailStats,
    pub compare: DetailStats,
    pub previous: Option<DetailStats>,
    pub share_pct: Option<f64>,
    pub total_change: Option<i64>,
    pub total_change_pct: Option<f64>,
    pub count_change: Option<i64>,
    pub count_change_pct: Option<f64>,
    pub average_change: Option<i64>,
    pub average_change_pct: Option<f64>,
    pub evolution: Vec<EvolutionPoint>,
    /// En el mes en curso, la evolución compara del día 1 a este día de cada mes.
    pub evolution_day: Option<u32>,
    pub movements: Vec<Movement>,
    pub movement_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchRequest {
    pub query: String,
    #[serde(default)]
    pub start: Option<String>,
    #[serde(default)]
    pub end: Option<String>,
    #[serde(default = "default_category_limit")]
    pub category_limit: i64,
    #[serde(default = "default_movement_limit")]
    pub movement_limit: i64,
    #[serde(default)]
    pub movement_offset: i64,
}

fn default_category_limit() -> i64 {
    5
}

fn default_movement_limit() -> i64 {
    10
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResults {
    pub query: String,
    pub categories: Vec<Category>,
    pub category_total: i64,
    pub movements: Vec<Movement>,
    pub movement_total: i64,
}

// ---------- Observaciones ----------

fn insight_category(row: &CategoryRow) -> InsightCategory {
    InsightCategory {
        id: row.id.clone(),
        name: row.name.clone(),
        current: row.compare,
        previous: row.previous.unwrap_or(0),
        change: row.change.unwrap_or(0),
    }
}

/// De una a tres observaciones por tipo, priorizando el impacto en euros.
pub fn insights_for(kind: Kind, rows: &[CategoryRow], metric: &Metric) -> Vec<Insight> {
    let Some(total_change) = metric.change else {
        return Vec::new();
    };
    let mut movers: Vec<&CategoryRow> = rows
        .iter()
        .filter(|r| r.kind == kind && r.change.is_some_and(|c| c != 0))
        .collect();
    movers.sort_by(|a, b| {
        b.change.unwrap().abs().cmp(&a.change.unwrap().abs()).then_with(|| a.name.cmp(&b.name))
    });
    let mut out = Vec::new();
    let mut used: HashSet<&str> = HashSet::new();
    let make = |kind_of, row: &CategoryRow, other: Option<&CategoryRow>, share_pct| Insight {
        kind,
        kind_of,
        category: insight_category(row),
        other: other.map(insight_category),
        total_change,
        share_pct,
    };

    if total_change.abs() >= NEAR_ZERO_CENTS {
        let sign = total_change.signum();
        let aligned = movers.iter().copied().find(|r| r.change.unwrap().signum() == sign);
        let opposite = movers.iter().copied().find(|r| r.change.unwrap().signum() == -sign);
        if let Some(top) = aligned {
            let share = pct(top.change.unwrap(), total_change);
            if share.is_some_and(|s| s <= 100.0) {
                out.push(make("explains", top, None, share));
            } else {
                out.push(make("adds_offsets", top, opposite, None));
                if let Some(o) = opposite {
                    used.insert(&o.id);
                }
            }
            used.insert(&top.id);
        }
        if let Some(o) = opposite.filter(|o| !used.contains(o.id.as_str()) && o.change.unwrap().abs() >= NEAR_ZERO_CENTS) {
            out.push(make("offsets", o, None, None));
            used.insert(&o.id);
        }
    } else {
        let up = movers.iter().copied().find(|r| r.change.unwrap() > 0);
        let down = movers.iter().copied().find(|r| r.change.unwrap() < 0);
        let (main, other) = match (up, down) {
            (Some(u), Some(d)) if d.change.unwrap().abs() > u.change.unwrap().abs() => (Some(d), Some(u)),
            (Some(u), d) => (Some(u), d),
            (None, d) => (d, None),
        };
        if let Some(m) = main {
            out.push(make("adds_offsets", m, other, None));
            used.insert(&m.id);
            if let Some(o) = other {
                used.insert(&o.id);
            }
        }
    }

    for r in &movers {
        if out.len() >= 3 {
            break;
        }
        if r.previous == Some(0) && r.compare > 0 && !used.contains(r.id.as_str()) {
            out.push(make("new", r, None, None));
            used.insert(&r.id);
        }
    }
    out.truncate(3);
    out
}

// ---------- Consultas ----------

#[derive(Debug, Clone, Copy, Default)]
struct Agg {
    total: i64,
    count: i64,
}

impl Store {
    fn aggregate(&self, r: Range) -> AppResult<HashMap<String, Agg>> {
        let (start, end) = r.bounds();
        let mut stmt = self.conn.prepare_cached(
            "SELECT category_id, SUM(amount_cents), COUNT(*) FROM movements
             WHERE deleted_at IS NULL AND date BETWEEN ?1 AND ?2 GROUP BY category_id",
        )?;
        let rows = stmt
            .query_map(params![start, end], |row| Ok((row.get::<_, String>(0)?, Agg { total: row.get(1)?, count: row.get(2)? })))?
            .collect::<Result<HashMap<_, _>, _>>()?;
        Ok(rows)
    }

    fn has_movements(&self, r: Range) -> AppResult<bool> {
        let (start, end) = r.bounds();
        Ok(self.conn.query_row(
            "SELECT EXISTS (SELECT 1 FROM movements WHERE deleted_at IS NULL AND date BETWEEN ?1 AND ?2)",
            params![start, end],
            |row| row.get(0),
        )?)
    }

    /// Acumulado diario por tipo; los días sin movimientos mantienen el nivel.
    fn cumulative(&self, r: Range) -> AppResult<HashMap<Kind, Vec<i64>>> {
        let (start, end) = r.bounds();
        let days = r.days() as usize;
        let mut out: HashMap<Kind, Vec<i64>> = [(Kind::Expense, vec![0; days]), (Kind::Income, vec![0; days])].into();
        let mut stmt = self.conn.prepare_cached(
            "SELECT kind, date, SUM(amount_cents) FROM movements
             WHERE deleted_at IS NULL AND date BETWEEN ?1 AND ?2 GROUP BY kind, date",
        )?;
        let rows = stmt.query_map(params![start, end], |row| {
            Ok((Kind::parse(&row.get::<_, String>(0)?)?, row.get::<_, String>(1)?, row.get::<_, i64>(2)?))
        })?;
        for row in rows {
            let (kind, date, sum) = row?;
            let d = NaiveDate::parse_from_str(&date, FMT).map_err(|_| AppError::new("invalid_data", "Fecha no válida en la base de datos."))?;
            let index = (d - r.start).num_days() as usize;
            if let Some(slot) = out.get_mut(&kind).and_then(|v| v.get_mut(index)) {
                *slot += sum;
            }
        }
        for series in out.values_mut() {
            let mut acc = 0;
            for v in series.iter_mut() {
                acc += *v;
                *v = acc;
            }
        }
        Ok(out)
    }

    fn period_info(&self, p: &Periods, today: NaiveDate) -> AppResult<PeriodInfo> {
        Ok(PeriodInfo {
            month: month_key(p.month),
            is_current_month: p.is_current,
            today: today.format(FMT).to_string(),
            range: p.display.into(),
            compare_range: p.compare.into(),
            previous_range: p.previous.into(),
            cut_day: p.cut_day,
            different_length: p.different_length,
            has_previous: self.has_movements(p.previous)?,
        })
    }

    pub fn analytics_summary(&self, month: &str, today: NaiveDate) -> AppResult<Summary> {
        let p = periods(parse_month(month)?, today)?;
        let period = self.period_info(&p, today)?;
        let categories: HashMap<String, Category> =
            self.list_categories(true)?.into_iter().map(|c| (c.id.clone(), c)).collect();

        let display = self.aggregate(p.display)?;
        let compare = if p.compare == p.display { display.clone() } else { self.aggregate(p.compare)? };
        let previous = if period.has_previous { Some(self.aggregate(p.previous)?) } else { None };

        let kind_of = |id: &str| categories.get(id).map(|c| c.kind);
        let sum = |map: &HashMap<String, Agg>, kind: Kind| -> i64 {
            map.iter().filter(|(id, _)| kind_of(id) == Some(kind)).map(|(_, a)| a.total).sum()
        };
        let metric = |kind: Kind| {
            Metric::new(sum(&display, kind), sum(&compare, kind), previous.as_ref().map(|m| sum(m, kind)))
        };
        let expense = metric(Kind::Expense);
        let income = metric(Kind::Income);

        let mut ids: Vec<&String> = display.keys().chain(compare.keys()).collect();
        if let Some(prev) = &previous {
            ids.extend(prev.keys());
        }
        let ids: HashSet<&String> = ids.into_iter().collect();
        let mut rows: Vec<CategoryRow> = ids
            .into_iter()
            .filter_map(|id| {
                let c = categories.get(id)?;
                let d = display.get(id).copied().unwrap_or_default();
                let cmp = compare.get(id).copied().unwrap_or_default().total;
                let prev = previous.as_ref().map(|m| m.get(id).copied().unwrap_or_default().total);
                let kind_total = if c.kind == Kind::Expense { expense.total } else { income.total };
                Some(CategoryRow {
                    id: c.id.clone(),
                    name: c.name.clone(),
                    icon: c.icon.clone(),
                    kind: c.kind,
                    archived: c.archived,
                    total: d.total,
                    count: d.count,
                    share_pct: pct(d.total, kind_total),
                    compare: cmp,
                    previous: prev,
                    change: prev.map(|p| cmp - p),
                    change_pct: prev.and_then(|p| pct(cmp - p, p)),
                })
            })
            .collect();
        rows.sort_by(|a, b| b.total.cmp(&a.total).then_with(|| a.name.cmp(&b.name)).then_with(|| a.id.cmp(&b.id)));

        let mut current_series = self.cumulative(p.display)?;
        let mut previous_series = if period.has_previous { Some(self.cumulative(p.previous)?) } else { None };
        let mut series = |kind: Kind| Series {
            current: current_series.remove(&kind).unwrap_or_default(),
            previous: previous_series.as_mut().and_then(|m| m.remove(&kind)),
        };
        let cumulative = Cumulative { expense: series(Kind::Expense), income: series(Kind::Income) };

        let mut insights = insights_for(Kind::Expense, &rows, &expense);
        insights.extend(insights_for(Kind::Income, &rows, &income));

        let balance = income.total - expense.total;
        let balance_compare = income.compare - expense.compare;
        let balance_previous = match (income.previous, expense.previous) {
            (Some(i), Some(e)) => Some(i - e),
            _ => None,
        };
        let future_excluded = if p.is_current {
            let (_, end) = Range::new(p.month, last_day(p.month)).bounds();
            self.conn.query_row(
                "SELECT COUNT(*) FROM movements WHERE deleted_at IS NULL AND date > ?1 AND date <= ?2",
                params![today.format(FMT).to_string(), end],
                |r| r.get(0),
            )?
        } else {
            0
        };
        let first_month: Option<String> = self
            .conn
            .query_row("SELECT substr(MIN(date), 1, 7) FROM movements WHERE deleted_at IS NULL", [], |r| r.get(0))?;

        Ok(Summary {
            period,
            first_month,
            future_excluded,
            retained_pct: pct(balance, income.total),
            expense,
            income,
            balance,
            balance_compare,
            balance_previous,
            balance_change: balance_previous.map(|b| balance_compare - b),
            categories: rows,
            cumulative,
            insights,
        })
    }

    fn category_stats(&self, id: &str, r: Range) -> AppResult<DetailStats> {
        let (start, end) = r.bounds();
        let (total, count) = self.conn.query_row(
            "SELECT COALESCE(SUM(amount_cents), 0), COUNT(*) FROM movements
             WHERE deleted_at IS NULL AND category_id = ?1 AND date BETWEEN ?2 AND ?3",
            params![id, start, end],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        Ok(DetailStats::new(total, count))
    }

    pub fn category_detail(&self, id: &str, month: &str, limit: i64, today: NaiveDate) -> AppResult<CategoryDetail> {
        let category = self.get_category(id)?;
        let p = periods(parse_month(month)?, today)?;
        let period = self.period_info(&p, today)?;
        let current = self.category_stats(id, p.display)?;
        let compare = if p.compare == p.display { current } else { self.category_stats(id, p.compare)? };
        let previous = if period.has_previous { Some(self.category_stats(id, p.previous)?) } else { None };

        let (start, end) = p.display.bounds();
        let kind_total: i64 = self.conn.query_row(
            "SELECT COALESCE(SUM(amount_cents), 0) FROM movements
             WHERE deleted_at IS NULL AND kind = ?1 AND date BETWEEN ?2 AND ?3",
            params![category.kind.as_str(), start, end],
            |r| r.get(0),
        )?;

        let evolution_day = p.is_current.then(|| today.day());
        let evolution = (0..EVOLUTION_MONTHS)
            .rev()
            .map(|back| {
                let first = add_months(p.month, -back);
                let last = last_day(first);
                let end = match evolution_day {
                    Some(day) => first.with_day(day.min(last.day())).expect("día válido"),
                    None => last,
                };
                let s = self.category_stats(id, Range::new(first, end))?;
                Ok(EvolutionPoint { month: month_key(first), total: s.total, count: s.count })
            })
            .collect::<AppResult<Vec<_>>>()?;

        let mut stmt = self.conn.prepare_cached(&format!(
            "{MOVEMENT_SELECT} WHERE m.category_id = ?1 AND m.deleted_at IS NULL AND m.date BETWEEN ?2 AND ?3
             ORDER BY m.date DESC, m.created_at DESC, m.id DESC LIMIT ?4"
        ))?;
        let movements = stmt
            .query_map(params![id, start, end, limit.clamp(1, 1000)], movement_from_row)?
            .collect::<Result<Vec<_>, _>>()?;

        let change = |f: fn(&DetailStats) -> Option<i64>| -> (Option<i64>, Option<f64>) {
            match (previous.as_ref().and_then(f), f(&compare)) {
                (Some(prev), Some(cur)) => (Some(cur - prev), pct(cur - prev, prev)),
                _ => (None, None),
            }
        };
        let (total_change, total_change_pct) = change(|s| Some(s.total));
        let (count_change, count_change_pct) = change(|s| Some(s.count));
        let (average_change, average_change_pct) = change(|s| s.average);

        Ok(CategoryDetail {
            period,
            share_pct: pct(current.total, kind_total),
            movement_count: current.count,
            category,
            current,
            compare,
            previous,
            total_change,
            total_change_pct,
            count_change,
            count_change_pct,
            average_change,
            average_change_pct,
            evolution,
            evolution_day,
            movements,
        })
    }

    /// Búsqueda literal (sin comodines), sin distinguir mayúsculas ni tildes, sobre todo el
    /// historial elegible. Las categorías archivadas solo aparecen si tienen movimientos.
    pub fn search(&self, req: &SearchRequest) -> AppResult<SearchResults> {
        let query: String = req.query.trim().chars().take(SEARCH_MAX_CHARS).collect();
        let needle = fold(&query);
        let empty = SearchResults { query: query.clone(), categories: vec![], category_total: 0, movements: vec![], movement_total: 0 };
        if needle.is_empty() {
            return Ok(empty);
        }
        let start = req.start.as_deref().map(validate_date).transpose()?;
        let end = req.end.as_deref().map(validate_date).transpose()?;

        const CAT_WHERE: &str = "(c.archived_at IS NULL OR EXISTS (SELECT 1 FROM movements mm WHERE mm.category_id = c.id AND mm.deleted_at IS NULL))
             AND instr(fold(c.name), ?1) > 0";
        let category_total = self.conn.query_row(&format!("SELECT COUNT(*) FROM categories c WHERE {CAT_WHERE}"), [&needle], |r| r.get(0))?;
        let mut stmt = self.conn.prepare_cached(&format!(
            "{CATEGORY_SELECT} WHERE {CAT_WHERE}
             ORDER BY CASE WHEN fold(c.name) = ?1 THEN 0 WHEN instr(fold(c.name), ?1) = 1 THEN 1 ELSE 2 END,
                      c.kind, c.sort_order, c.name, c.id
             LIMIT ?2"
        ))?;
        let categories = stmt
            .query_map(params![needle, req.category_limit.clamp(0, 50)], category_from_row)?
            .collect::<Result<Vec<_>, _>>()?;

        const MOV_WHERE: &str = "m.deleted_at IS NULL
             AND (instr(fold(COALESCE(m.note, '')), ?1) > 0 OR instr(fold(c.name), ?1) > 0)
             AND (?2 IS NULL OR m.date >= ?2) AND (?3 IS NULL OR m.date <= ?3)";
        let movement_total = self.conn.query_row(
            &format!("SELECT COUNT(*) FROM movements m JOIN categories c ON c.id = m.category_id WHERE {MOV_WHERE}"),
            params![needle, start, end],
            |r| r.get(0),
        )?;
        let mut stmt = self.conn.prepare_cached(&format!(
            "{MOVEMENT_SELECT} WHERE {MOV_WHERE} ORDER BY m.date DESC, m.created_at DESC, m.id DESC LIMIT ?4 OFFSET ?5"
        ))?;
        let movements = stmt
            .query_map(
                params![needle, start, end, req.movement_limit.clamp(0, 100), req.movement_offset.max(0)],
                movement_from_row,
            )?
            .collect::<Result<Vec<_>, _>>()?;

        Ok(SearchResults { query, categories, category_total, movements, movement_total })
    }
}
