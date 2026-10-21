"""Genera las capas de la portada animada a partir de src/assets/portada-madrid.jpg.

1. src/assets/portada-cielo.png: máscara del cielo (alfa), para teñirlo según la hora sin tocar
   edificios, torres ni árboles: azul o bruma clara conectada con el borde superior, menos las
   torres.
2. src/assets/portada-torres.png: silueta de las Cuatro Torres y las KIO (alfa), trazada a mano,
   para los destellos en los cristales.
3. src/assets/portada-ventanas.json: rectángulos [x, y, ancho, alto] de ventanas en coordenadas
   de la imagen, para encenderlas al anochecer.
4. src/assets/portada-mahou.png y portada-farola.png: máscaras recortadas de las letras del
   cartel de Mahou y de la pantalla encendida de la farola (cajas MAHOU_BOX y LAMP_BOX), para que
   brillen por encima del oscurecimiento nocturno.

El paisaje no se modifica. Uso (requiere opencv-python-headless y numpy):
  python scripts/prepare-portada-capas.py
"""

import json
from pathlib import Path

import cv2
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src/assets/portada-madrid.jpg"
OUT = ROOT / "src/assets"

# Siluetas de las Cuatro Torres y las KIO en la imagen de 1654 × 923, trazadas a mano: su
# cristal refleja el cielo y por color se confundiría con él.
TOWERS = [
    [(1118, 394), (1158, 388), (1160, 560), (1108, 560)],
    [(1187, 347), (1245, 347), (1246, 556), (1189, 556)],
    [(1289, 306), (1340, 300), (1350, 312), (1352, 556), (1288, 556)],
    [(1414, 322), (1468, 302), (1480, 546), (1415, 546)],
    [(1527, 262), (1563, 258), (1566, 300), (1576, 305), (1577, 541), (1512, 541), (1513, 305), (1525, 300)],
    [(827, 475), (876, 470), (858, 550), (817, 550)],
    [(943, 476), (990, 472), (1015, 562), (968, 562)],
]
# Ventanas de la fachada principal (junto a Estrecho), trazadas a mano: el poste del metro
# y las barandillas engañan a la detección automática. [x, y, ancho, alto].
MAIN_FACADE = [
    [398, 424, 16, 35], [444, 435, 16, 33], [481, 446, 10, 29], [513, 456, 8, 24],
    [541, 460, 9, 31], [564, 467, 9, 31], [585, 474, 6, 28],
    [397, 528, 17, 47], [441, 535, 16, 45], [481, 542, 10, 42],
    [541, 551, 11, 44], [564, 556, 9, 44], [585, 558, 8, 44],
    [397, 633, 18, 53], [443, 633, 17, 58], [482, 637, 9, 54],
    [541, 642, 12, 58], [564, 644, 11, 58], [585, 646, 9, 56],
    [398, 735, 17, 33], [444, 735, 17, 38], [484, 737, 7, 36],
    [543, 735, 11, 42], [566, 735, 9, 42], [587, 735, 8, 42],
]
# Cajas (x, y, ancho, alto) de las luces; deben coincidir con src/components/PortadaEscena.tsx.
MAHOU_BOX = (1500, 720, 140, 100)
LAMP_BOX = (305, 254, 106, 36)
# Otras fachadas con ventanas visibles (x0, y0, x1, y1), donde sí vale la detección.
FACADES = [(95, 250, 300, 400), (700, 540, 900, 720), (1020, 540, 1100, 600),
           (1140, 650, 1300, 790), (1380, 600, 1490, 790)]


def towers_mask(shape: tuple[int, int]) -> np.ndarray:
    mask = np.zeros(shape, np.uint8)
    for poly in TOWERS:
        cv2.fillPoly(mask, [np.array(poly, np.int32)], 255, lineType=cv2.LINE_AA)
    return mask


def sky_mask(img: np.ndarray, towers: np.ndarray) -> np.ndarray:
    """Cielo = píxeles azules o de bruma clara conectados con el borde superior, sin torres."""
    hsv = cv2.cvtColor(cv2.GaussianBlur(img, (7, 7), 0), cv2.COLOR_BGR2HSV)
    b, g, r = cv2.split(cv2.GaussianBlur(img, (7, 7), 0).astype(np.int16))
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    blue = (h >= 95) & (h <= 130) & (s >= 70) & (v >= 70)
    haze = (v >= 150) & (b >= r - 8) & (s < 110)
    # Junto al horizonte la bruma es casi blanca y algo cálida: cuenta como cielo si está arriba.
    rows = np.arange(img.shape[0])[:, None]
    horizon_haze = (v >= 135) & (s < 95) & (rows < 525)
    cand = ((blue | haze | horizon_haze) & (towers < 128)).astype(np.uint8)
    n, labels = cv2.connectedComponents(cand, connectivity=4)
    top = set(np.unique(labels[0])) - {0}
    mask = np.isin(labels, list(top)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    mask[towers >= 128] = 0
    return cv2.GaussianBlur(mask, (5, 5), 0)


def windows(img: np.ndarray) -> list[list[int]]:
    """Cristales: más oscuros que la fachada que los rodea, con forma de ventana."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2].astype(np.float32)
    local = cv2.blur(v, (31, 31))
    green = (h >= 28) & (h <= 95) & (s > 70)
    dark = ((v < local * 0.62) & ~green).astype(np.uint8) * 255
    roi = np.zeros_like(dark)
    for x0, y0, x1, y1 in FACADES:
        roi[y0:y1, x0:x1] = 255
    dark = cv2.bitwise_and(dark, roi)
    dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    n, labels, stats, _ = cv2.connectedComponentsWithStats(dark, 8)
    rects = []
    for i in range(1, n):
        x, y, w, hh, area = stats[i]
        if not (30 <= area <= 700 and 5 <= w <= 26 and 9 <= hh <= 48):
            continue
        if not (0.25 <= w / hh <= 1.1):
            continue
        # Las ventanas no son verdes ni del todo negras (postes y barandillas de hierro).
        patch = green[y : y + hh, x : x + w]
        if patch.mean() > 0.25:
            continue
        rects.append([int(x), int(y), int(w), int(hh)])
    return rects


def light_mask(img: np.ndarray, box: tuple[int, int, int, int], kind: str) -> np.ndarray:
    x, y, w, h = box
    crop = img[y : y + h, x : x + w]
    hsv = cv2.cvtColor(cv2.GaussianBlur(crop, (3, 3), 0), cv2.COLOR_BGR2HSV)
    hh, ss, vv = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    if kind == "letters":
        # Letras crema sobre fondo rojo: el verde separa bien ambos (el rojo apenas tiene).
        green = cv2.GaussianBlur(crop, (5, 5), 0)[..., 1]
        mask = (green > 118).astype(np.uint8) * 255
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
    else:
        # Pantalla naranja de la farola, limitada a su elipse.
        mask = ((hh >= 5) & (hh <= 32) & (ss > 90) & (vv > 150)).astype(np.uint8) * 255
        ellipse = np.zeros_like(mask)
        cv2.ellipse(ellipse, (w // 2, h // 2), (w // 2 - 2, h // 2 - 4), 0, 0, 360, 255, -1)
        mask = cv2.bitwise_and(mask, ellipse)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    return cv2.GaussianBlur(mask, (3, 3), 0)


def main() -> None:
    img = cv2.imread(str(SRC), cv2.IMREAD_COLOR)
    if img is None:
        raise SystemExit(f"No se pudo leer {SRC}")
    towers = towers_mask(img.shape[:2])
    sky = sky_mask(img, towers)

    def write_alpha(name: str, alpha: np.ndarray) -> None:
        rgba = np.zeros((*alpha.shape, 4), np.uint8)
        rgba[..., 3] = alpha
        cv2.imwrite(str(OUT / name), rgba, [cv2.IMWRITE_PNG_COMPRESSION, 9])

    write_alpha("portada-cielo.png", sky)
    write_alpha("portada-mahou.png", light_mask(img, MAHOU_BOX, "letters"))
    write_alpha("portada-farola.png", light_mask(img, LAMP_BOX, "lamp"))
    write_alpha("portada-torres.png", towers)
    rects = MAIN_FACADE + windows(img)
    (OUT / "portada-ventanas.json").write_text(json.dumps(rects, separators=(",", ":")))
    print(f"Cielo y torres escritos; {len(rects)} ventanas.")


if __name__ == "__main__":
    main()
