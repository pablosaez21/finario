/**
 * WebKit (WKWebView en macOS) solo recorre con Tab los campos de texto salvo que el usuario
 * active una preferencia del sistema. Los elementos con `tabindex` explícito sí entran en el
 * orden de tabulación, así que se lo asignamos a todos los controles interactivos.
 */
const SELECTOR = "button:not([tabindex]), summary:not([tabindex]), a[href]:not([tabindex])";

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
