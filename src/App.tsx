import { useState } from "react";
import Portada from "./screens/Portada";
import Registro from "./screens/Registro";

type Screen = "portada" | "registro";

export default function App() {
  const [screen, setScreen] = useState<Screen>("portada");
  const [visitedRegistro, setVisitedRegistro] = useState(false);

  return screen === "portada" ? (
    <Portada
      focusPrimary={visitedRegistro}
      onOpenRegistro={() => {
        setVisitedRegistro(true);
        setScreen("registro");
      }}
    />
  ) : (
    <Registro onHome={() => setScreen("portada")} />
  );
}
