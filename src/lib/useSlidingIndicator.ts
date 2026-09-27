import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

/**
 * Posición de un indicador que se desliza bajo el elemento activo (`[data-key]`) de un
 * contenedor. Inspirado en Magnet Tabs de ObsidianUI, sin efecto magnético: las etiquetas y
 * zonas de clic no se mueven. La transición la define el CSS (y se anula con movimiento
 * reducido). No anima en el primer posicionamiento.
 */
export function useSlidingIndicator(container: RefObject<HTMLElement | null>, activeKey: string): {
  style: CSSProperties;
  ready: boolean;
} {
  const [box, setBox] = useState<{ left: number; width: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const root = container.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>(`[data-key="${activeKey}"]`);
      if (el) setBox({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    document.fonts?.ready.then(measure);
    const t = requestAnimationFrame(() => setReady(true));
    return () => {
      ro.disconnect();
      cancelAnimationFrame(t);
    };
  }, [container, activeKey]);

  return {
    style: box ? { transform: `translateX(${box.left}px)`, width: box.width } : { opacity: 0 },
    ready,
  };
}
