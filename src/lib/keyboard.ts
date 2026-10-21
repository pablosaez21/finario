/**
 * WebKit (WKWebView en macOS) solo recorre con Tab los campos de texto salvo que el usuario
 * active una preferencia del sistema. Los elementos con `tabindex` explícito sí entran en el
 * orden de tabulación, así que se lo asignamos a todos los controles interactivos.
 */
const SELECTOR = "button:not([tabindex]), summary:not([tabindex]), a[href]:not([tabindex])";

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex]:not([tabindex="-1"]):not(:disabled)';

/** Mantiene Tab / Mayús+Tab dentro de un diálogo modal (WebKit puede salir al documento). */
export function trapTab(e: { key: string; shiftKey: boolean; preventDefault: () => void }, container: HTMLElement | null): void {
  if (e.key !== "Tab" || !container) return;
  const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const current = document.activeElement;
  if (e.shiftKey && (current === first || !container.contains(current))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (current === last || !container.contains(current))) {
    e.preventDefault();
    first.focus();
  }
}

export function enableTabNavigation(root: HTMLElement = document.body): void {
  const apply = (scope: ParentNode) => scope.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => (el.tabIndex = 0));
  apply(root);
  new MutationObserver((records) => {
    for (const r of records) {
      r.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        if (node.matches(SELECTOR)) node.tabIndex = 0;
        apply(node);
      });
    }
  }).observe(root, { childList: true, subtree: true });
}
