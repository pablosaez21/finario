"""Genera el fondo limpio de la portada a partir de la referencia aprobada.

La referencia 01 contiene textos y botones incrustados. Este script:
1. Recorta el borde para eliminar las esquinas redondeadas blancas.
2. Borra la UI incrustada (antiguo título, frase y botones) sustituyéndola por
   textura de cielo limpio mediante clonado Poisson (cv2.seamlessClone), que
   conserva el grano y adapta el color al cielo circundante.

La referencia original no se modifica. El resultado se escribe en
src/assets/portada-madrid.jpg.

Uso: python scripts/prepare-portada.py  (requiere opencv-python-headless y numpy)
"""

from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs/references/01-portada-madrid-aprobada.png"
OUT = ROOT / "src/assets/portada-madrid.jpg"

CROP = 9

# (x0, y0, x1, y1) de la zona a borrar y origen (x, y) del parche de cielo limpio,
# en coordenadas de la imagen original.
PATCHES = [
    ((742, 34, 934, 92), (1215, 34)),
    ((596, 160, 1076, 234), (1082, 150)),
    ((652, 232, 1022, 394), (1100, 60)),
]


def main() -> None:
    img = cv2.imread(str(SRC), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"No se pudo leer {SRC}")
    out = img.copy()
    for (x0, y0, x1, y1), (sx, sy) in PATCHES:
        w, h = x1 - x0, y1 - y0
        pad = 6
        src = img[sy - pad : sy + h + pad, sx - pad : sx + w + pad]
        mask = np.zeros(src.shape[:2], np.uint8)
        mask[pad:-pad, pad:-pad] = 255
        center = (x0 + w // 2, y0 + h // 2)
        out = cv2.seamlessClone(src, out, mask, center, cv2.NORMAL_CLONE)
    out = out[CROP:-CROP, CROP:-CROP]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(OUT), out, [cv2.IMWRITE_JPEG_QUALITY, 93])
    print(f"Escrito {OUT.relative_to(ROOT)} ({out.shape[1]}x{out.shape[0]})")


if __name__ == "__main__":
    main()
