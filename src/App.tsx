import { useState } from "react";
import Portada from "./screens/Portada";
import Interior, { type Tab } from "./screens/Interior";

/** Solo en desarrollo: `#apuntar` o `#analisis` abre directamente esa pestaña (revisión visual). */
const devTab = (): Tab | null =>
  import.meta.env.DEV && (location.hash === "#apuntar" || location.hash === "#analisis") ? (location.hash.slice(1) as Tab) : null;

export default function App() {
  const [tab, setTab] = useState<Tab | null>(devTab);
  const [cameFrom, setCameFrom] = useState<Tab | null>(null);

  return tab === null ? (
    <Portada
      focusTab={cameFrom}
      onOpen={(next) => {
        setCameFrom(next);
        setTab(next);
      }}
    />
  ) : (
    <Interior initialTab={tab} onHome={() => setTab(null)} />
  );
}
