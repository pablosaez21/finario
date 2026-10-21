//! Puente HTTP solo para desarrollo: expone los comandos Tauri reales en http://127.0.0.1:1430
//! para revisar la interfaz en un navegador (`pnpm dev:browser`). Trabaja sobre la carpeta de
//! `FINARIO_DATA_DIR`, nunca sobre los datos de la app instalada. Se ejecuta como test ignorado:
//!
//!   FINARIO_DATA_DIR=/tmp/finario-copia pnpm bridge

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::Mutex;

use serde_json::Value;
use tauri::ipc::{CallbackFn, InvokeBody};
use tauri::test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY};
use tauri::Manager;

use crate::backup;
use crate::store::Store;

const ALLOWED_ORIGIN: &str = "http://localhost:1420";

#[test]
#[ignore = "servidor de desarrollo; se lanza a mano con FINARIO_DATA_DIR"]
fn dev_bridge() {
    let dir = PathBuf::from(std::env::var("FINARIO_DATA_DIR").expect("define FINARIO_DATA_DIR con una copia de los datos"));
    let real = dirs_data().join("es.finario.escritorio");
    assert!(dir.canonicalize().ok() != real.canonicalize().ok() || !real.exists(), "no uses la carpeta real de Finario");

    let (db, backups) = backup::default_paths(&dir);
    let app = crate::with_commands(mock_builder()).build(mock_context(noop_assets())).unwrap();
    app.manage(crate::AppState(Mutex::new(Store::open(&db, &backups).expect("abrir copia"))));
    let webview = tauri::WebviewWindowBuilder::new(&app, "main", Default::default()).build().unwrap();

    let listener = TcpListener::bind("127.0.0.1:1430").expect("puerto 1430 libre");
    eprintln!("Puente de Finario en http://127.0.0.1:1430 sobre {}", dir.display());

    for stream in listener.incoming() {
        let Ok(mut stream) = stream else { continue };
        let mut reader = BufReader::new(stream.try_clone().unwrap());
        let mut first = String::new();
        if reader.read_line(&mut first).is_err() {
            continue;
        }
        let mut length = 0usize;
        let mut origin = None;
        loop {
            let mut line = String::new();
            if reader.read_line(&mut line).unwrap_or(0) == 0 || line == "\r\n" {
                break;
            }
            let lower = line.to_ascii_lowercase();
            if let Some(v) = lower.strip_prefix("content-length:") {
                length = v.trim().parse().unwrap_or(0);
            } else if let Some(v) = lower.strip_prefix("origin:") {
                origin = Some(v.trim().to_string());
            }
        }
        let mut body = vec![0; length];
        let _ = reader.read_exact(&mut body);

        let mut parts = first.split_whitespace();
        let method = parts.next().unwrap_or("");
        let cmd = parts.next().unwrap_or("/").trim_start_matches('/').to_string();
        // Solo responde al Vite de desarrollo: otra web abierta en el navegador no puede
        // llamar a los comandos (exportar o restaurar copias, por ejemplo).
        let (status, payload) = if origin.as_deref().is_some_and(|o| o != ALLOWED_ORIGIN) {
            ("403 Forbidden", String::new())
        } else if method == "OPTIONS" {
            ("204 No Content", String::new())
        } else {
            let args: Value = serde_json::from_slice(&body).unwrap_or(Value::Null);
            let response = get_ipc_response(
                &webview,
                tauri::webview::InvokeRequest {
                    cmd,
                    callback: CallbackFn(0),
                    error: CallbackFn(1),
                    url: "tauri://localhost".parse().unwrap(),
                    body: InvokeBody::Json(if args.is_null() { Value::Object(Default::default()) } else { args }),
                    headers: Default::default(),
                    invoke_key: INVOKE_KEY.to_string(),
                },
            );
            match response {
                Ok(b) => ("200 OK", b.deserialize::<Value>().unwrap_or(Value::Null).to_string()),
                Err(e) => ("400 Bad Request", e.to_string()),
            }
        };
        let _ = write!(
            stream,
            "HTTP/1.1 {status}\r\nAccess-Control-Allow-Origin: {ALLOWED_ORIGIN}\r\nVary: Origin\r\nAccess-Control-Allow-Headers: content-type\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
            payload.len()
        );
    }
}

fn dirs_data() -> PathBuf {
    PathBuf::from(std::env::var("HOME").unwrap_or_default()).join("Library/Application Support")
}
