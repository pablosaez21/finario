use chrono::NaiveDate;
use tempfile::TempDir;

use crate::analytics::{insights_for, parse_month, pct, periods, SearchRequest, Summary};
use crate::backup;
use crate::store::{Kind, MovementInput, Store};

fn d(s: &str) -> NaiveDate {
    NaiveDate::parse_from_str(s, "%Y-%m-%d").unwrap()
}

fn open(dir: &TempDir) -> Store {
    let (db, backups) = backup::default_paths(dir.path());
    Store::open(&db, &backups).unwrap()
}

fn add(store: &mut Store, kind: Kind, cents: i64, category: &str, date: &str, note: Option<&str>) -> String {
    let amount = format!("{},{:02}", cents / 100, cents % 100);
    store
        .create_movement(&MovementInput {
            id: None,
            kind,
            amount,
            category_id: category.into(),
            date: date.into(),
            note: note.map(Into::into),
        })
        .unwrap()
        .id
}

/// Reparte `total` céntimos en `n` movimientos iguales en días consecutivos desde `from_day`.
fn spread(store: &mut Store, category: &str, month: &str, total: i64, n: i64, from_day: u32) {
    for i in 0..n {
        let day = from_day + i as u32;
        add(store, Kind::Expense, total / n, category, &format!("{month}-{day:02}"), Some("Registro"));
    }
}

/// Datos del ejemplo verificado de docs/ANALYTICS.md: septiembre 1–27 frente a agosto 1–27.
fn example(store: &mut Store) -> (String, String) {
    let restaurantes = store.create_category(Kind::Expense, "Restaurantes", "utensils").unwrap().id;
    let compras = store.create_category(Kind::Expense, "Compras", "shopping-cart").unwrap().id;
    let sep: [(&str, i64, i64); 7] = [
        ("vivienda", 85000, 85000),
        ("alimentacion", 28640, 26840),
        (restaurantes.as_str(), 19200, 12000),
        ("ocio", 14600, 11000),
        ("transporte", 7400, 8000),
        (compras.as_str(), 6200, 2000),
        ("suscripciones", 5400, 3600),
    ];
    for (cat, now, before) in sep {
        if cat == restaurantes {
            spread(store, cat, "2026-09", now, 12, 1);
            spread(store, cat, "2026-08", before, 8, 1);
        } else {
            add(store, Kind::Expense, now, cat, "2026-09-05", None);
            add(store, Kind::Expense, before, cat, "2026-08-05", None);
        }
    }
    add(store, Kind::Income, 220000, "nomina", "2026-09-01", None);
    add(store, Kind::Income, 20000, "freelance", "2026-09-15", None);
    add(store, Kind::Income, 220000, "nomina", "2026-08-01", None);
    add(store, Kind::Income, 10000, "freelance", "2026-08-15", None);
    // Fuera del tramo comparable (agosto 28–31) y fecha futura en septiembre: excluidos.
    add(store, Kind::Expense, 99900, "ocio", "2026-08-30", None);
    add(store, Kind::Expense, 55500, "ocio", "2026-09-29", None);
    // Borrado lógico: excluido.
    let gone = add(store, Kind::Expense, 77700, "salud", "2026-09-10", None);
    store.delete_movement(&gone).unwrap();
    (restaurantes, compras)
}

fn row<'a>(s: &'a Summary, id: &str) -> &'a crate::analytics::CategoryRow {
    s.categories.iter().find(|c| c.id == id).unwrap_or_else(|| panic!("sin fila {id}"))
}

#[test]
fn periods_for_current_and_closed_months() {
    let p = periods(parse_month("2026-09").unwrap(), d("2026-09-27")).unwrap();
    assert!(p.is_current);
    assert_eq!((p.display.start, p.display.end), (d("2026-09-01"), d("2026-09-27")));
    assert_eq!((p.previous.start, p.previous.end), (d("2026-08-01"), d("2026-08-27")));
    assert_eq!(p.cut_day, None);

    // Marzo 31 frente a febrero (28 días en 2026): comparación cortada en el día 28.
    let p = periods(parse_month("2026-03").unwrap(), d("2026-03-31")).unwrap();
    assert_eq!(p.display.end, d("2026-03-31"));
    assert_eq!(p.compare.end, d("2026-03-28"));
    assert_eq!((p.previous.start, p.previous.end), (d("2026-02-01"), d("2026-02-28")));
    assert_eq!(p.cut_day, Some(28));

    // Año bisiesto.
    let p = periods(parse_month("2028-03").unwrap(), d("2028-03-30")).unwrap();
    assert_eq!((p.previous.end, p.cut_day), (d("2028-02-29"), Some(29)));

    // Cambio de año.
    let p = periods(parse_month("2027-01").unwrap(), d("2027-01-15")).unwrap();
    assert_eq!((p.previous.start, p.previous.end), (d("2026-12-01"), d("2026-12-15")));

    // Meses cerrados: completos, avisando de distinta duración.
    let p = periods(parse_month("2026-03").unwrap(), d("2026-09-27")).unwrap();
    assert!(!p.is_current);
    assert_eq!((p.display.end, p.previous.end), (d("2026-03-31"), d("2026-02-28")));
    assert!(p.different_length);
    let p = periods(parse_month("2026-08").unwrap(), d("2026-09-27")).unwrap();
    assert!(!p.different_length);

    assert_eq!(periods(parse_month("2026-10").unwrap(), d("2026-09-27")).unwrap_err().code, "future_month");
    for bad in ["2026-13", "2026-9", "", "sept"] {
        assert!(parse_month(bad).is_err(), "{bad}");
    }
}

#[test]
fn percentages_and_zero_denominators() {
    assert_eq!(pct(18000, 148440), Some(12.1));
    assert_eq!(pct(-600, 8000), Some(-7.5));
    assert_eq!(pct(5, 0), None);
}

#[test]
fn summary_matches_the_verified_example() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    let (restaurantes, compras) = example(&mut store);
    let s = store.analytics_summary("2026-09", d("2026-09-27")).unwrap();

    assert!(s.period.has_previous);
    assert_eq!(s.period.range.days, 27);
    assert_eq!(s.expense.total, 166440);
    assert_eq!(s.expense.previous, Some(148440));
    assert_eq!(s.expense.change, Some(18000));
    assert_eq!(s.expense.change_pct, Some(12.1));
    assert_eq!(s.income.total, 240000);
    assert_eq!(s.income.change, Some(10000));
    assert_eq!(s.income.change_pct, Some(4.3));
    assert_eq!(s.balance, 73560);
    assert_eq!(s.balance_previous, Some(81560));
    assert_eq!(s.balance_change, Some(-8000));
    assert_eq!(s.retained_pct, Some(30.7));
    assert_eq!(s.future_excluded, 1);
    assert_eq!(s.first_month.as_deref(), Some("2026-08"));

    let r = row(&s, &restaurantes);
    assert_eq!((r.total, r.count, r.previous, r.change, r.change_pct), (19200, 12, Some(12000), Some(7200), Some(60.0)));
    assert_eq!(r.share_pct, Some(11.5));
    assert_eq!(row(&s, "vivienda").change_pct, Some(0.0));
    assert_eq!(row(&s, "transporte").change_pct, Some(-7.5));
    assert_eq!(row(&s, &compras).change_pct, Some(210.0));
    assert!(s.categories.iter().all(|c| c.id != "salud"), "el borrado lógico no cuenta");
    let expense_sum: i64 = s.categories.iter().filter(|c| c.kind == Kind::Expense).map(|c| c.total).sum();
    assert_eq!(expense_sum, s.expense.total);
    let first_expense = s.categories.iter().find(|c| c.kind == Kind::Expense).unwrap();
    assert_eq!(first_expense.id, "vivienda", "orden por importe descendente");

    // Acumulado: 27 días, mantiene nivel sin movimientos y termina en el total.
    let cur = &s.cumulative.expense.current;
    assert_eq!(cur.len(), 27);
    assert_eq!(*cur.last().unwrap(), 166440);
    assert!(cur.windows(2).all(|w| w[1] >= w[0]));
    assert_eq!(cur[25], cur[26], "sin movimientos el día 27 se mantiene el nivel");
    let prev = s.cumulative.expense.previous.as_ref().unwrap();
    assert_eq!((prev.len(), *prev.last().unwrap()), (27, 148440));

    let insights: Vec<_> = s.insights.iter().filter(|i| i.kind == Kind::Expense).collect();
    assert_eq!(insights[0].kind_of, "explains");
    assert_eq!(insights[0].category.id, restaurantes);
    assert_eq!((insights[0].category.change, insights[0].share_pct), (7200, Some(40.0)));
    assert_eq!(insights[1].kind_of, "offsets");
    assert_eq!((insights[1].category.id.as_str(), insights[1].category.change), ("transporte", -600));
}

#[test]
fn no_history_zero_income_and_empty_periods() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    let empty = store.analytics_summary("2026-09", d("2026-09-27")).unwrap();
    assert!(!empty.period.has_previous);
    assert_eq!((empty.expense.total, empty.expense.previous, empty.expense.change_pct), (0, None, None));
    assert_eq!((empty.retained_pct, empty.first_month), (None, None));
    assert!(empty.categories.is_empty() && empty.insights.is_empty());
    assert!(empty.cumulative.expense.previous.is_none());

    add(&mut store, Kind::Expense, 5000, "ocio", "2026-09-03", None);
    let s = store.analytics_summary("2026-09", d("2026-09-27")).unwrap();
    assert!(!s.period.has_previous, "sin registros en agosto no hay comparación");
    assert_eq!(s.retained_pct, None, "sin ingresos no hay proporción retenida");
    assert_eq!(s.balance, -5000);
    assert_eq!(row(&s, "ocio").change, None);
}

#[test]
fn category_without_previous_amount_gets_no_percentage() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    add(&mut store, Kind::Expense, 10000, "vivienda", "2026-08-02", None);
    add(&mut store, Kind::Expense, 10000, "vivienda", "2026-09-02", None);
    add(&mut store, Kind::Expense, 4500, "salud", "2026-09-04", None);
    let s = store.analytics_summary("2026-09", d("2026-09-27")).unwrap();
    let salud = row(&s, "salud");
    assert_eq!((salud.previous, salud.change, salud.change_pct), (Some(0), Some(4500), None));
    let exp: Vec<_> = s.insights.iter().filter(|i| i.kind == Kind::Expense).collect();
    assert_eq!((exp[0].kind_of, exp[0].share_pct), ("explains", Some(100.0)));

    // Categoría que baja a cero sigue apareciendo con su cambio negativo.
    let s = store.analytics_summary("2026-10", d("2026-10-05")).unwrap();
    let v = row(&s, "vivienda");
    assert_eq!((v.total, v.previous, v.change_pct), (0, Some(10000), Some(-100.0)));
}

#[test]
fn offsetting_categories_avoid_misleading_percentages() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    add(&mut store, Kind::Expense, 10000, "ocio", "2026-08-02", None);
    add(&mut store, Kind::Expense, 10000, "transporte", "2026-08-02", None);
    add(&mut store, Kind::Expense, 17200, "ocio", "2026-09-02", None);
    add(&mut store, Kind::Expense, 7000, "transporte", "2026-09-02", None);
    let s = store.analytics_summary("2026-09", d("2026-09-27")).unwrap();
    // Total +42 €: ocio +72 € (171 %), transporte −30 €.
    let first = &s.insights[0];
    assert_eq!(first.kind_of, "adds_offsets");
    assert_eq!(first.category.id, "ocio");
    assert_eq!(first.other.as_ref().map(|o| (o.id.as_str(), o.change)), Some(("transporte", -3000)));
    assert_eq!(first.share_pct, None);

    // Cambio total casi cero: se describen los dos movimientos sin porcentaje.
    let rows = s.categories.clone();
    let mut metric = s.expense.clone();
    metric.change = Some(50);
    let near_zero = insights_for(Kind::Expense, &rows, &metric);
    assert_eq!(near_zero[0].kind_of, "adds_offsets");
    assert!(near_zero.iter().all(|i| i.share_pct.is_none()));
}

#[test]
fn comparison_is_cut_at_last_common_day() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    add(&mut store, Kind::Expense, 1000, "ocio", "2026-02-10", None);
    add(&mut store, Kind::Expense, 2000, "ocio", "2026-03-10", None);
    add(&mut store, Kind::Expense, 5000, "ocio", "2026-03-30", None);
    let s = store.analytics_summary("2026-03", d("2026-03-31")).unwrap();
    assert_eq!(s.period.cut_day, Some(28));
    assert_eq!((s.expense.total, s.expense.compare, s.expense.previous), (7000, 2000, Some(1000)));
    assert_eq!(s.expense.change, Some(1000));
    assert_eq!(s.cumulative.expense.current.len(), 31);
    assert_eq!(s.cumulative.expense.previous.as_ref().unwrap().len(), 28);
}

#[test]
fn edits_deletes_and_archived_categories_recalculate() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    let id = add(&mut store, Kind::Expense, 3000, "transporte", "2026-09-02", None);
    add(&mut store, Kind::Expense, 1000, "transporte", "2026-09-03", None);
    store.set_category_archived("transporte", true).unwrap();
    let s = store.analytics_summary("2026-09", d("2026-09-27")).unwrap();
    let t = row(&s, "transporte");
    assert!(t.archived);
    assert_eq!(t.total, 4000);

    let mut edit = MovementInput {
        id: None,
        kind: Kind::Expense,
        amount: "45".into(),
        category_id: "transporte".into(),
        date: "2026-09-02".into(),
        note: None,
    };
    store.update_movement(&id, &edit).unwrap();
    assert_eq!(store.analytics_summary("2026-09", d("2026-09-27")).unwrap().expense.total, 5500);
    edit.date = "2026-08-31".into();
    store.update_movement(&id, &edit).unwrap();
    let s = store.analytics_summary("2026-09", d("2026-09-27")).unwrap();
    assert_eq!(s.expense.total, 1000);
    store.delete_movement(&id).unwrap();
    assert_eq!(store.analytics_summary("2026-08", d("2026-09-27")).unwrap().expense.total, 0);
}

#[test]
fn category_detail_matches_example() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    let (restaurantes, _) = example(&mut store);
    let det = store.category_detail(&restaurantes, "2026-09", 5, d("2026-09-27")).unwrap();
    assert_eq!((det.current.total, det.current.count, det.current.average), (19200, 12, Some(1600)));
    assert_eq!(det.previous.map(|p| (p.total, p.count, p.average)), Some((12000, 8, Some(1500))));
    assert_eq!((det.total_change, det.total_change_pct), (Some(7200), Some(60.0)));
    assert_eq!((det.count_change, det.count_change_pct), (Some(4), Some(50.0)));
    assert_eq!((det.average_change, det.average_change_pct), (Some(100), Some(6.7)));
    assert_eq!(det.share_pct, Some(11.5));
    assert_eq!((det.movement_count, det.movements.len()), (12, 5));
    assert!(det.movements.windows(2).all(|w| w[0].date >= w[1].date));
    assert_eq!(det.evolution_day, Some(27));
    let months: Vec<_> = det.evolution.iter().map(|e| e.month.as_str()).collect();
    assert_eq!(months, ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    assert_eq!(det.evolution[4].total, 12000);
    assert_eq!(det.evolution[5].total, 19200);

    let all = store.category_detail(&restaurantes, "2026-09", 1000, d("2026-09-27")).unwrap();
    assert_eq!(all.movements.iter().map(|m| m.amount_cents).sum::<i64>(), 19200);

    // Sin historial previo y media sin movimientos.
    let empty = store.category_detail("salud", "2026-09", 5, d("2026-09-27")).unwrap();
    assert_eq!((empty.current.count, empty.current.average), (0, None));
    assert_eq!(empty.average_change, None);
    assert_eq!(store.category_detail("no-existe", "2026-09", 5, d("2026-09-27")).unwrap_err().code, "not_found");
}

#[test]
fn search_is_accent_insensitive_literal_and_paginated() {
    let dir = TempDir::new().unwrap();
    let mut store = open(&dir);
    add(&mut store, Kind::Income, 220000, "nomina", "2026-09-01", None);
    add(&mut store, Kind::Expense, 350, "alimentacion", "2026-09-02", Some("Café con Ana"));
    add(&mut store, Kind::Expense, 1200, "ocio", "2026-09-03", Some("Entradas 50% descuento"));
    add(&mut store, Kind::Expense, 800, "ocio", "2026-08-03", Some("Cine_verano"));
    for day in 1..=15 {
        add(&mut store, Kind::Expense, 100, "transporte", &format!("2026-07-{day:02}"), Some("Metro"));
    }
    let q = |query: &str| SearchRequest {
        query: query.into(),
        start: None,
        end: None,
        category_limit: 5,
        movement_limit: 10,
        movement_offset: 0,
    };

    let r = store.search(&q("NOMINA")).unwrap();
    assert_eq!(r.categories[0].id, "nomina");
    assert_eq!(r.movement_total, 1, "coincide por categoría");
    assert_eq!(store.search(&q("cafe")).unwrap().movements[0].note.as_deref(), Some("Café con Ana"));
    assert_eq!(store.search(&q("ÁNA")).unwrap().movement_total, 1);

    assert_eq!(store.search(&q("%")).unwrap().movement_total, 1, "% es literal");
    assert_eq!(store.search(&q("_")).unwrap().movement_total, 1, "_ es literal");
    assert_eq!(store.search(&q("'; DROP TABLE movements; --")).unwrap().movement_total, 0);
    assert_eq!(store.search(&q("   ")).unwrap().movement_total, 0);

    // Orden de categorías: exacta y prefijo antes que contenidas.
    let r = store.search(&q("o")).unwrap();
    assert_eq!(r.categories[0].name, "Ocio");

    // Paginación y totales.
    let mut metro = q("metro");
    let page1 = store.search(&metro).unwrap();
    assert_eq!((page1.movement_total, page1.movements.len()), (15, 10));
    metro.movement_offset = 10;
    let page2 = store.search(&metro).unwrap();
    assert_eq!(page2.movements.len(), 5);
    assert!(page1.movements.iter().all(|a| page2.movements.iter().all(|b| a.id != b.id)));
    assert!(page1.movements.windows(2).all(|w| w[0].date >= w[1].date));

    // Alcance por fechas.
    let mut scoped = q("ocio");
    scoped.start = Some("2026-09-01".into());
    scoped.end = Some("2026-09-30".into());
    assert_eq!(store.search(&scoped).unwrap().movement_total, 1);
    scoped.start = Some("2026-02-30".into());
    assert!(store.search(&scoped).is_err());

    // Archivadas: solo con historial.
    store.set_category_archived("salud", true).unwrap();
    store.set_category_archived("transporte", true).unwrap();
    assert_eq!(store.search(&q("salud")).unwrap().category_total, 0);
    let t = store.search(&q("transp")).unwrap();
    assert_eq!(t.category_total, 1);
    assert!(t.categories[0].archived);

    // Borrados lógicos excluidos.
    let cafe = store.search(&q("cafe")).unwrap().movements[0].id.clone();
    store.delete_movement(&cafe).unwrap();
    assert_eq!(store.search(&q("cafe")).unwrap().movement_total, 0);
}
