import * as THREE from "three";

/**
 * Teksturer tegnes i canvas ved oppstart. Ingen bildefiler å laste ned,
 * og fargene følger nettstedets tema.
 */

/**
 * Tegner i høy oppløsning (scale × logiske piksler) så tekst og kanter er
 * skarpe også på Retina-skjermer og når kameraet zoomer inn.
 */
function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void, scale = 4) {
  const c = document.createElement("canvas");
  c.width = w * scale;
  c.height = h * scale;
  const ctx = c.getContext("2d")!;
  ctx.scale(scale, scale);
  draw(ctx);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  return t;
}

/** Bølgeblikk: lyse og mørke ribber. Gjentas langs veggen. */
export function wallTexture(base: string, rib: string) {
  const t = canvasTexture(64, 8, (ctx) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 64, 8);
    for (let x = 0; x < 64; x += 16) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, base);
      g.addColorStop(0.45, rib);
      g.addColorStop(0.55, rib);
      g.addColorStop(1, base);
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, 8);
    }
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

/** Solcellepanel: mørkeblå celler, lyse skiller og en svak refleks. */
export function panelTexture() {
  return canvasTexture(96, 160, (ctx) => {
    ctx.fillStyle = "#e9eef7";
    ctx.fillRect(0, 0, 96, 160);
    const cols = 6;
    const rows = 10;
    const pad = 4;
    const cw = (96 - pad * 2) / cols;
    const ch = (160 - pad * 2) / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = pad + c * cw;
        const y = pad + r * ch;
        const g = ctx.createLinearGradient(x, y, x + cw, y + ch);
        g.addColorStop(0, "#1b3a78");
        g.addColorStop(1, "#122a5c");
        ctx.fillStyle = g;
        ctx.fillRect(x + 0.6, y + 0.6, cw - 1.2, ch - 1.2);
      }
    }
    const shine = ctx.createLinearGradient(0, 0, 96, 160);
    shine.addColorStop(0, "rgba(255,255,255,0.28)");
    shine.addColorStop(0.35, "rgba(255,255,255,0)");
    shine.addColorStop(0.7, "rgba(255,255,255,0.08)");
    shine.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shine;
    ctx.fillRect(0, 0, 96, 160);
  });
}

/** Siden på kassen/traileren: hvit med stripe og «100 % elektrisk». */
export function brandTexture(accent: string, energy: string, label: string) {
  return canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = "#fbfcff";
    ctx.fillRect(0, 0, 512, 128);
    // Stripe nederst
    ctx.fillStyle = accent;
    ctx.fillRect(0, 100, 512, 28);
    ctx.fillStyle = energy;
    ctx.beginPath();
    ctx.moveTo(300, 128);
    ctx.lineTo(360, 100);
    ctx.lineTo(512, 100);
    ctx.lineTo(512, 128);
    ctx.closePath();
    ctx.fill();
    // Lyn
    ctx.fillStyle = energy;
    ctx.beginPath();
    ctx.moveTo(52, 18);
    ctx.lineTo(30, 56);
    ctx.lineTo(46, 56);
    ctx.lineTo(36, 88);
    ctx.lineTo(66, 44);
    ctx.lineTo(50, 44);
    ctx.lineTo(60, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = accent;
    ctx.font = "700 40px Archivo, system-ui, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillText(label, 84, 54);
  });
}

/** Malt ladeplass: grønn flate med hvitt lyn. */
export function bayTexture(green: string) {
  return canvasTexture(128, 256, (ctx) => {
    ctx.fillStyle = green;
    ctx.fillRect(0, 0, 128, 256);
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, 122, 250);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.moveTo(72, 40);
    ctx.lineTo(44, 100);
    ctx.lineTo(62, 100);
    ctx.lineTo(52, 150);
    ctx.lineTo(88, 84);
    ctx.lineTo(68, 84);
    ctx.lineTo(80, 40);
    ctx.closePath();
    ctx.fill();
  });
}

/** Skilt på fasaden. */
export function signTexture(text: string, accent: string) {
  return canvasTexture(512, 112, (ctx) => {
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, 512, 112);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 58px Archivo, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 60);
  });
}
