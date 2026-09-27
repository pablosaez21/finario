import { useEffect, useState } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { DatabaseBackup, Download, FolderOpen, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import Dialog from "./Dialog";
import { api, toAppError, type BackupFile, type BackupInfo, type BackupSummary } from "../lib/api";
import { formatBytes, formatDateTime, formatLongDate, todayISO } from "../lib/format";

interface Props {
  onClose: () => void;
  onRestored: (safety: BackupFile) => void;
  onBackupCreated: () => void;
}

const KIND_LABEL: Record<string, string> = {
  auto: "Automática",
  manual: "Manual",
  "antes-de-restaurar": "Antes de restaurar",
};

export default function BackupsDialog({ onClose, onRestored, onBackupCreated }: Props) {
  const [info, setInfo] = useState<BackupInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<BackupSummary | null>(null);

  const load = async () => setInfo(await api.backupInfo());

  useEffect(() => {
    load().catch((e) => setError(toAppError(e).message));
  }, []);

  const run = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const prepareRestore = (path: string) =>
    run(async () => {
      setPending(await api.inspectBackup(path));
    });

  return (
    <Dialog
      title="Copias de seguridad"
      description={
        info
          ? `Finario crea una copia automática al abrirse cada día y conserva las ${info.autoKeep} últimas.`
          : "Copias locales de tus datos."
      }
      onClose={onClose}
      wide
    >
      {pending ? (
        <div className="restore-confirm" role="alertdialog" aria-labelledby="restore-title" aria-describedby="restore-desc">
          <span className="restore-confirm__icon" aria-hidden="true">
            <TriangleAlert size={20} strokeWidth={1.8} />
          </span>
          <div>
            <h3 id="restore-title">¿Sustituir los datos actuales?</h3>
            <p id="restore-desc">
              La copia contiene <strong>{pending.movements}</strong> {pending.movements === 1 ? "movimiento" : "movimientos"}
              {pending.lastMovementDate ? `, el último del ${formatLongDate(pending.lastMovementDate)}` : ""}. Antes de restaurar se guardará
              una copia del estado actual por si necesitas volver atrás.
            </p>
            <p className="restore-confirm__path">{pending.path}</p>
            <div className="actions">
              <button
                type="button"
                className="btn-danger"
                disabled={busy}
                autoFocus
                onClick={() =>
                  run(async () => {
                    const safety = await api.restoreBackup(pending.path);
                    setPending(null);
                    await load();
                    onRestored(safety);
                  })
                }
              >
                <RotateCcw size={16} strokeWidth={1.9} aria-hidden="true" />
                {busy ? "Restaurando…" : "Restaurar copia"}
              </button>
              <button type="button" className="btn-ghost" onClick={() => setPending(null)} disabled={busy}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="backup-actions">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const b = await api.createBackup();
                  await load();
                  onBackupCreated();
                  setNotice(`Copia creada: ${b.fileName}`);
                })
              }
            >
              <DatabaseBackup size={16} strokeWidth={1.7} aria-hidden="true" />
              Crear copia ahora
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  const path = await save({
                    title: "Exportar copia de Finario",
                    defaultPath: `finario-copia-${todayISO()}.sqlite3`,
                    filters: [{ name: "Copia de Finario", extensions: ["sqlite3"] }],
                  });
                  if (!path) return;
                  const b = await api.exportBackup(path);
                  setNotice(`Copia exportada en ${b.path}`);
                })
              }
            >
              <Download size={16} strokeWidth={1.7} aria-hidden="true" />
              Exportar copia…
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={async () => {
                const path = await open({
                  title: "Restaurar copia de Finario",
                  multiple: false,
                  directory: false,
                  filters: [{ name: "Copia de Finario", extensions: ["sqlite3", "sqlite", "db"] }],
                });
                if (typeof path === "string") prepareRestore(path);
              }}
            >
              <Upload size={16} strokeWidth={1.7} aria-hidden="true" />
              Restaurar desde archivo…
            </button>
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="notice" role="status">
              {notice}
            </p>
          )}

          <h3 className="cat-section">Copias recientes</h3>
          {info && info.backups.length === 0 ? (
            <p className="muted-text">Aún no hay copias.</p>
          ) : (
            <ul className="backup-list">
              {info?.backups.slice(0, 8).map((b) => (
                <li key={b.path} className="backup-item">
                  <div>
                    <p className="backup-item__date tabular">{formatDateTime(b.created)}</p>
                    <small>
                      {KIND_LABEL[b.kind] ?? b.kind} · {formatBytes(b.sizeBytes)}
                    </small>
                  </div>
                  <button type="button" className="btn-ghost btn-ghost--small" disabled={busy} onClick={() => prepareRestore(b.path)}>
                    <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}

          {info && (
            <div className="backup-where">
              <div>
                <span className="label">Carpeta de copias</span>
                <code>{info.backupsDir}</code>
                <span className="label">Base de datos</span>
                <code>{info.dbPath}</code>
              </div>
              <button type="button" className="btn-ghost btn-ghost--small" onClick={() => run(api.openBackupsFolder)}>
                <FolderOpen size={15} strokeWidth={1.7} aria-hidden="true" />
                Abrir carpeta
              </button>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
