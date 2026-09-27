use std::path::Path;

use tempfile::TempDir;

use crate::backup::{self, BackupKind};
use crate::store::{Kind, MovementInput, Store};

fn open(dir: &Path) -> Store {
    let (db, backups) = backup::default_paths(dir);
    Store::open(&db, &backups).expect("open store")
}

fn input(kind: Kind, amount: &str, category: &str) -> MovementInput {
    MovementInput {
        id: None,
        kind,
        amount: amount.into(),
        category_id: category.into(),
        date: "2026-09-26".into(),
        note: None,
    }
}

#[test]
fn new_database_starts_empty_with_seed_categories() {
    let dir = TempDir::new().unwrap();
    let store = open(dir.path());
    assert_eq!(store.list_movements(50, 0).unwrap().total, 0);
    let cats = store.list_categories(false).unwrap();
    assert_eq!(cats.iter().filter(|c| c.kind == Kind::Expense).count(), 6);
    assert_eq!(cats.iter().filter(|c| c.kind == Kind::Income).count(), 3);
}

#[test]
fn movements_persist_after_reopen_including_edits_and_deletes() {
    let dir = TempDir::new().unwrap();
    let (kept, edited, deleted);
    {
        let mut store = open(dir.path());
        kept = store.create_movement(&input(Kind::Income, "2.200,00", "nomina")).unwrap();
        edited = store.create_movement(&input(Kind::Expense, "30", "salud")).unwrap();
        deleted = store.create_movement(&input(Kind::Expense, "12,5", "ocio")).unwrap();
        let mut change = input(Kind::Expense, "31,40", "alimentacion");
        change.note = Some("  Farmacia y súper  ".into());
        change.date = "2026-09-20".into();
        store.update_movement(&edited.id, &change).unwrap();
        store.delete_movement(&deleted.id).unwrap();
    }
    let mut store = open(dir.path());
    let page = store.list_movements(50, 0).unwrap();
    assert_eq!(page.total, 2);
    assert_eq!(page.items[0].id, kept.id);
    assert_eq!(page.items[0].amount_cents, 220_000);
    let e = &page.items[1];
    assert_eq!((e.amount_cents, e.category_id.as_str(), e.date.as_str()), (3140, "alimentacion", "2026-09-20"));
    assert_eq!(e.note.as_deref(), Some("Farmacia y súper"));

    let restored = store.restore_movement(&deleted.id).unwrap();
    assert_eq!(restored.amount_cents, 1250);
    drop(store);
    assert_eq!(open(dir.path()).list_movements(50, 0).unwrap().total, 3);
}

#[test]
fn rejects_invalid_movements_without_writing() {
    let dir = TempDir::new().unwrap();
    let mut store = open(dir.path());
    for amount in ["", "0", "-3", "1.234", "12,345"] {
        let err = store.create_movement(&input(Kind::Expense, amount, "ocio")).unwrap_err();
        assert_eq!(err.field, Some("amount"), "amount {amount:?}");
    }
    let err = store.create_movement(&input(Kind::Income, "10", "ocio")).unwrap_err();
    assert_eq!(err.code, "category_kind_mismatch");
    let err = store.create_movement(&input(Kind::Expense, "10", "no-existe")).unwrap_err();
    assert_eq!(err.field, Some("category"));
    let mut bad_date = input(Kind::Expense, "10", "ocio");
    bad_date.date = "2026-02-30".into();
    assert_eq!(store.create_movement(&bad_date).unwrap_err().field, Some("date"));
    let mut long_note = input(Kind::Expense, "10", "ocio");
    long_note.note = Some("x".repeat(121));
    assert_eq!(store.create_movement(&long_note).unwrap_err().field, Some("note"));
    assert_eq!(store.list_movements(50, 0).unwrap().total, 0);
}

#[test]
fn database_constraints_reject_bypassing_the_rust_layer() {
    let dir = TempDir::new().unwrap();
    let store = open(dir.path());
    let insert = |kind: &str, cents: &str, cat: &str, date: &str| {
        store.conn.execute(
            &format!("INSERT INTO movements (id, kind, amount_cents, category_id, date) VALUES (lower(hex(randomblob(16))), '{kind}', {cents}, '{cat}', '{date}')"),
            [],
        )
    };
    assert!(insert("expense", "0", "ocio", "2026-09-01").is_err());
    assert!(insert("expense", "12.5", "ocio", "2026-09-01").is_err());
    assert!(insert("income", "100", "ocio", "2026-09-01").is_err());
    assert!(insert("expense", "100", "nada", "2026-09-01").is_err());
    assert!(insert("expense", "100", "ocio", "2026-13-01").is_err());
    assert!(insert("expense", "100", "ocio", "2026-09-01").is_ok());
    assert!(store.conn.execute("DELETE FROM categories WHERE id = 'ocio'", []).is_err());
    assert!(store.conn.execute("UPDATE categories SET kind = 'income' WHERE id = 'ocio'", []).is_err());
}

#[test]
fn double_submit_with_same_id_does_not_duplicate() {
    let dir = TempDir::new().unwrap();
    let mut store = open(dir.path());
    let mut req = input(Kind::Expense, "9,99", "suscripciones");
    req.id = Some(uuid::Uuid::new_v4().to_string());
    let a = store.create_movement(&req).unwrap();
    let b = store.create_movement(&req).unwrap();
    assert_eq!(a, b);
    assert_eq!(store.list_movements(50, 0).unwrap().total, 1);
}

#[test]
fn renaming_and_archiving_categories_keeps_history() {
    let dir = TempDir::new().unwrap();
    let mut store = open(dir.path());
    let m = store.create_movement(&input(Kind::Expense, "62", "transporte")).unwrap();
    store.update_category("transporte", "Movilidad", "bus").unwrap();
    assert_eq!(store.get_movement(&m.id).unwrap().category_name, "Movilidad");

    store.set_category_archived("transporte", true).unwrap();
    assert!(!store.list_categories(false).unwrap().iter().any(|c| c.id == "transporte"));
    let still = store.get_movement(&m.id).unwrap();
    assert_eq!(still.category_id, "transporte");
    let mut edit = input(Kind::Expense, "65", "transporte");
    edit.note = Some("Abono".into());
    assert_eq!(store.update_movement(&m.id, &edit).unwrap().amount_cents, 6500);
    assert_eq!(store.create_movement(&input(Kind::Expense, "1", "transporte")).unwrap_err().code, "category_archived");

    assert_eq!(store.create_category(Kind::Expense, "movilidad", "car").unwrap_err().code, "duplicate_name");
    let new_cat = store.create_category(Kind::Expense, "Restaurantes", "utensils").unwrap();
    assert_eq!(new_cat.sort_order, 7);
    store.set_category_archived("transporte", false).unwrap();
    assert!(store.create_category(Kind::Expense, "  ", "car").is_err());
    assert!(store.create_category(Kind::Expense, "Algo", "no-icon").is_err());
}

#[test]
fn cannot_archive_last_active_category_of_a_kind() {
    let dir = TempDir::new().unwrap();
    let mut store = open(dir.path());
    store.set_category_archived("nomina", true).unwrap();
    store.set_category_archived("freelance", true).unwrap();
    assert_eq!(store.set_category_archived("otros-ingresos", true).unwrap_err().code, "last_category");
}

#[test]
fn backup_export_and_restore_roundtrip() {
    let dir = TempDir::new().unwrap();
    let mut store = open(dir.path());
    store.create_movement(&input(Kind::Expense, "10", "ocio")).unwrap();
    let exported = dir.path().join("export").join("mi-copia.sqlite3");
    store.export_backup(&exported).unwrap();
    let summary = backup::inspect(&exported).unwrap();
    assert_eq!(summary.movements, 1);

    store.create_movement(&input(Kind::Expense, "20", "ocio")).unwrap();
    store.create_movement(&input(Kind::Expense, "30", "ocio")).unwrap();
    assert_eq!(store.list_movements(50, 0).unwrap().total, 3);

    let safety = store.restore_backup(&exported).unwrap();
    assert_eq!(safety.kind, "antes-de-restaurar");
    assert_eq!(store.list_movements(50, 0).unwrap().total, 1);
    assert_eq!(backup::inspect(Path::new(&safety.path)).unwrap().movements, 3);

    store.create_movement(&input(Kind::Income, "5", "freelance")).unwrap();
    drop(store);
    assert_eq!(open(dir.path()).list_movements(50, 0).unwrap().total, 2);
}

#[test]
fn restore_rejects_invalid_files_and_keeps_data() {
    let dir = TempDir::new().unwrap();
    let mut store = open(dir.path());
    store.create_movement(&input(Kind::Expense, "10", "ocio")).unwrap();

    let text = dir.path().join("nota.sqlite3");
    std::fs::write(&text, "esto no es una base de datos").unwrap();
    let foreign = dir.path().join("otra.sqlite3");
    rusqlite::Connection::open(&foreign).unwrap().execute_batch("CREATE TABLE t (x); INSERT INTO t VALUES (1);").unwrap();

    for bad in [text.as_path(), foreign.as_path(), &dir.path().join("no-existe.sqlite3")] {
        let err = store.restore_backup(bad).unwrap_err();
        assert_eq!(err.code, "invalid_backup", "{bad:?}");
    }
    assert_eq!(store.list_movements(50, 0).unwrap().total, 1);
}

/// Llama a los comandos por IPC con los mismos nombres y argumentos que usa src/lib/api.ts.
#[test]
fn ipc_commands_match_the_frontend_contract() {
    use serde_json::{json, Value};
    use std::sync::Mutex;
    use tauri::ipc::{CallbackFn, InvokeBody};
    use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY};
    use tauri::Manager;

    let dir = TempDir::new().unwrap();
    let app = crate::with_commands(mock_builder()).build(mock_context(noop_assets())).unwrap();
    app.manage(crate::AppState(Mutex::new(open(dir.path()))));
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();

    let call = |cmd: &str, args: Value| -> Result<Value, Value> {
        get_ipc_response(
            &webview,
            tauri::webview::InvokeRequest {
                cmd: cmd.into(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "tauri://localhost".parse().unwrap(),
                body: InvokeBody::Json(args),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.to_string(),
            },
        )
        .map(|b| b.deserialize::<Value>().unwrap())
    };

    let cats = call("list_categories", json!({ "includeArchived": true })).unwrap();
    assert_eq!(cats.as_array().unwrap().len(), 9);
    assert_eq!(cats[0]["movementCount"], 0);

    let id = uuid::Uuid::new_v4().to_string();
    let input = json!({ "id": id, "kind": "expense", "amount": "12,50", "categoryId": "ocio", "date": "2026-09-26", "note": null });
    let created = call("create_movement", json!({ "input": input })).unwrap();
    assert_eq!(created["amountCents"], 1250);
    assert_eq!(created["categoryName"], "Ocio");
    call("create_movement", json!({ "input": input })).unwrap();

    let err = call("create_movement", json!({ "input": { "kind": "expense", "amount": "0", "categoryId": "ocio", "date": "2026-09-26" } })).unwrap_err();
    assert_eq!(err["field"], "amount");
    assert_eq!(err["code"], "invalid_amount");

    let updated = call(
        "update_movement",
        json!({ "id": id, "input": { "kind": "income", "amount": "20", "categoryId": "freelance", "date": "2026-09-25", "note": "Proyecto" } }),
    )
    .unwrap();
    assert_eq!((updated["kind"].as_str(), updated["note"].as_str()), (Some("income"), Some("Proyecto")));

    let page = call("list_movements", json!({ "limit": 30, "offset": 0 })).unwrap();
    assert_eq!(page["total"], 1);
    call("delete_movement", json!({ "id": id })).unwrap();
    assert_eq!(call("list_movements", json!({ "limit": 30, "offset": 0 })).unwrap()["total"], 0);
    call("restore_movement", json!({ "id": id })).unwrap();

    let cat = call("create_category", json!({ "kind": "expense", "name": "Restaurantes", "icon": "utensils" })).unwrap();
    let cat_id = cat["id"].as_str().unwrap();
    call("update_category", json!({ "id": cat_id, "name": "Comer fuera", "icon": "coffee" })).unwrap();
    call("set_category_archived", json!({ "id": cat_id, "archived": true })).unwrap();
    let ids = ["salud", "ocio", "alimentacion", "vivienda", "transporte", "suscripciones"];
    let reordered = call("reorder_categories", json!({ "kind": "expense", "ids": ids })).unwrap();
    assert_eq!(reordered[0]["id"], "salud");

    let month = chrono::Local::now().format("%Y-%m").to_string();
    let summary = call("analytics_summary", json!({ "month": month })).unwrap();
    assert!(summary["expense"]["total"].is_i64());
    assert!(summary["range"]["start"].is_string());
    assert!(summary["cumulative"]["expense"]["current"].is_array());
    let detail = call("category_detail", json!({ "categoryId": "ocio", "month": month, "limit": 5 })).unwrap();
    assert_eq!(detail["category"]["id"], "ocio");
    assert!(detail["evolution"].as_array().unwrap().len() == 6);
    let found = call("search", json!({ "request": { "query": "proyecto", "start": null, "end": null, "categoryLimit": 5, "movementLimit": 10, "movementOffset": 0 } })).unwrap();
    assert_eq!(found["movementTotal"], 1);
    assert_eq!(call("analytics_summary", json!({ "month": "2999-01" })).unwrap_err()["code"], "future_month");

    let backup = call("create_backup", json!({})).unwrap();
    assert_eq!(backup["kind"], "manual");
    let info = call("backup_info", json!({})).unwrap();
    assert_eq!(info["autoKeep"], 14);
    let export = dir.path().join("exportada.sqlite3");
    call("export_backup", json!({ "path": export })).unwrap();
    assert_eq!(call("inspect_backup", json!({ "path": export })).unwrap()["movements"], 1);
    let safety = call("restore_backup", json!({ "path": export })).unwrap();
    assert_eq!(safety["kind"], "antes-de-restaurar");
}

#[test]
fn auto_backup_runs_once_per_day_and_is_listed() {
    let dir = TempDir::new().unwrap();
    let store = open(dir.path());
    assert!(store.auto_backup_if_due().unwrap().is_some());
    assert!(store.auto_backup_if_due().unwrap().is_none());
    store.create_backup(BackupKind::Manual).unwrap();
    store.create_backup(BackupKind::Manual).unwrap();
    let info = store.backup_info().unwrap();
    assert_eq!(info.backups.len(), 3);
    assert_eq!(info.backups.iter().filter(|b| b.kind == "auto").count(), 1);
}
