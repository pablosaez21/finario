import { useState } from "react";
import Portada from "./screens/Portada";
import Interior, { type Tab } from "./screens/Interior";

export default function App() {
  const [tab, setTab] = useState<Tab | null>(null);
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
