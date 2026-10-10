/**
 * preprocessImage.ts
 * ──────────────────
 * Browser-native image preprocessing pipeline.
 * Takes a raw base64 image string and returns two processed versions:
 *   • enhanced  – contrast-boosted grayscale, ≥ 2000 px long side (for Gemini)
 *   • binarized – adaptive-threshold black-and-white image    (for Tesseract)
 *
 * No native OpenCV dependency required – uses Canvas 2D + ImageData APIs.
 */

export interface PreprocessResult {
  /** Contrast-enhanced grayscale base64 PNG (no data-URL prefix) – send to Gemini */
  enhanced: string;
  /** Adaptively binarized base64 PNG (no data-URL prefix) – send to Tesseract */
  binarized: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const MIN_LONG_SIDE = 2000;   // upscale target (≈300 DPI for A4)
const CLAHE_CLIP    = 3;      // CLAHE contrast clip limit (1 = no enhancement)
const TILE_SIZE     = 32;     // CLAHE tile size in pixels
const BINARIZE_RADIUS = 15;   // local neighbourhood radius for adaptive threshold
const BINARIZE_C      = 10;   // constant subtracted from local mean (controls threshold)

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Preprocess a base64-encoded image (no data-URL prefix required).
 * Returns { enhanced, binarized } as pure base64 PNG strings.
 */
export async function preprocessImage(base64: string): Promise<PreprocessResult> {
  const img   = await loadImage(base64);
  const { w, h } = resolvedSize(img.naturalWidth, img.naturalHeight);

  // 1. Draw + upscale onto an RGBA canvas
  const rgbaCanvas = createCanvas(w, h);
  const rgbaCtx    = rgbaCanvas.getContext('2d')!;
  rgbaCtx.drawImage(img, 0, 0, w, h);
  const rgbaData = rgbaCtx.getImageData(0, 0, w, h);

  // 2. Convert to grayscale
  const gray = toGrayscale(rgbaData.data, w, h);

  // 3. Deskew (lightweight row-variance heuristic)
  const { data: deskewed, angle } = deskewGray(gray, w, h);
  if (Math.abs(angle) > 0.3) {
    console.debug(`[preprocessImage] Deskew applied: ${angle.toFixed(2)}°`);
  }

  // 4. Denoise (3×3 median-like box blur)
  const denoised = boxBlur(deskewed, w, h, 1);

  // 5. CLAHE contrast enhancement
  const clahed = applyClahe(denoised, w, h, TILE_SIZE, CLAHE_CLIP);

  // 6. Build "enhanced" output (grayscale, high-contrast)
  const enhancedCanvas = grayToCanvas(clahed, w, h);
  const enhanced = stripPrefix(enhancedCanvas.toDataURL('image/png'));

  // 7. Build "binarized" output (adaptive threshold)
  const binData   = adaptiveThreshold(clahed, w, h, BINARIZE_RADIUS, BINARIZE_C);
  const binCanvas = grayToCanvas(binData, w, h);
  const binarized = stripPrefix(binCanvas.toDataURL('image/png'));

  console.debug(`[preprocessImage] Done – canvas: ${w}×${h}, deskew: ${angle.toFixed(2)}°`);
  return { enhanced, binarized };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function createCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width  = w;
  c.height = h;
  return c;
}

async function loadImage(base64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const src = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src     = src;
  });
}

/** Compute upscaled dimensions so the longer side is at least MIN_LONG_SIDE. */
function resolvedSize(origW: number, origH: number) {
  const longSide = Math.max(origW, origH);
  if (longSide >= MIN_LONG_SIDE) return { w: origW, h: origH };
  const scale = MIN_LONG_SIDE / longSide;
  return { w: Math.round(origW * scale), h: Math.round(origH * scale) };
}

function stripPrefix(dataUrl: string): string {
  return dataUrl.includes(';base64,') ? dataUrl.split(';base64,')[1] : dataUrl;
}

/** Convert RGBA Uint8ClampedArray → Float32Array grayscale (0–255). */
function toGrayscale(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i * 4];
    const g = rgba[i * 4 + 1];
    const b = rgba[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/** Render a Float32Array grayscale buffer back to an HTMLCanvasElement. */
function grayToCanvas(gray: Float32Array, w: number, h: number): HTMLCanvasElement {
  const canvas = createCanvas(w, h);
  const ctx    = canvas.getContext('2d')!;
  const img    = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = Math.max(0, Math.min(255, Math.round(gray[i])));
    img.data[i * 4]     = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Deskew: estimate skew angle on a DOWNSAMPLED thumbnail (20% of original)
 * then apply the rotation to the full-resolution image.
 * FIX 8: Reduces pixel operations from ~117M to ~4.7M — no more UI freeze.
 */
function deskewGray(
  gray: Float32Array,
  w: number,
  h: number
): { data: Float32Array; angle: number } {
  const RANGE        = 5;
  const STEP         = 0.5;
  const DESKEW_SCALE = 0.2;   // FIX 8: work on 20% thumbnail for angle detection

  // Downsample to thumbnail
  const sw = Math.max(1, Math.round(w * DESKEW_SCALE));
  const sh = Math.max(1, Math.round(h * DESKEW_SCALE));
  const small = new Float32Array(sw * sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const sx = Math.round(x / DESKEW_SCALE);
      const sy = Math.round(y / DESKEW_SCALE);
      small[y * sw + x] = gray[Math.min(sy, h - 1) * w + Math.min(sx, w - 1)];
    }
  }

  let bestAngle = 0;
  let bestScore = -Infinity;
  const scx = sw / 2, scy = sh / 2;

  for (let deg = -RANGE; deg <= RANGE; deg += STEP) {
    const rad     = (deg * Math.PI) / 180;
    const cosA    = Math.cos(rad);
    const sinA    = Math.sin(rad);
    const rowSums = new Float32Array(sh);

    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const nx = Math.round((x - scx) * cosA - (y - scy) * sinA + scx);
        const ny = Math.round((x - scx) * sinA + (y - scy) * cosA + scy);
        if (nx >= 0 && nx < sw && ny >= 0 && ny < sh) {
          rowSums[y] += small[ny * sw + nx];
        }
      }
    }

    const mean     = rowSums.reduce((a, b) => a + b, 0) / sh;
    const variance = rowSums.reduce((acc, v) => acc + (v - mean) ** 2, 0) / sh;
    if (variance > bestScore) { bestScore = variance; bestAngle = deg; }
  }

  if (Math.abs(bestAngle) < 0.3) return { data: gray, angle: 0 };

  // Apply best angle to FULL-resolution image
  const rad  = (bestAngle * Math.PI) / 180;
  const cosA = Math.cos(-rad);
  const sinA = Math.sin(-rad);
  const cx   = w / 2;
  const cy   = h / 2;
  const out  = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.round((x - cx) * cosA - (y - cy) * sinA + cx);
      const sy = Math.round((x - cx) * sinA + (y - cy) * cosA + cy);
      out[y * w + x] = (sx >= 0 && sx < w && sy >= 0 && sy < h)
        ? gray[sy * w + sx]
        : 255;
    }
  }

  return { data: out, angle: bestAngle };
}


/** Simple box blur of radius r (acts as a mild denoiser). */
function boxBlur(gray: Float32Array, w: number, h: number, r: number): Float32Array {
  const out  = new Float32Array(w * h);
  const diam = 2 * r + 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const ny = y + dy;
          const nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            sum += gray[ny * w + nx];
            count++;
          }
        }
      }
      out[y * w + x] = sum / count;
    }
    _ = diam; // silence unused warning
  }
  return out;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let _ = 0;

/**
 * CLAHE – Contrast-Limited Adaptive Histogram Equalization.
 * Divides the image into tiles, equalises each tile's histogram,
 * clips at `clipLimit`, then bilinearly interpolates between tiles.
 */
function applyClahe(
  gray: Float32Array,
  w: number,
  h: number,
  tileSize: number,
  clipLimit: number
): Float32Array {
  const out     = new Float32Array(w * h);
  const tilesX  = Math.ceil(w / tileSize);
  const tilesY  = Math.ceil(h / tileSize);

  // Build LUT per tile
  const luts: Uint8Array[][] = [];
  for (let ty = 0; ty < tilesY; ty++) {
    luts[ty] = [];
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileSize;
      const y0 = ty * tileSize;
      const x1 = Math.min(x0 + tileSize, w);
      const y1 = Math.min(y0 + tileSize, h);

      const hist = new Float32Array(256);
      let count  = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          hist[Math.round(gray[y * w + x])]++;
          count++;
        }
      }

      // Clip histogram
      const limit = clipLimit * count / 256;
      let excess  = 0;
      for (let b = 0; b < 256; b++) {
        if (hist[b] > limit) { excess += hist[b] - limit; hist[b] = limit; }
      }
      const redistrib = excess / 256;
      for (let b = 0; b < 256; b++) hist[b] += redistrib;

      // CDF → LUT
      const lut = new Uint8Array(256);
      let cdf   = 0;
      for (let b = 0; b < 256; b++) {
        cdf    += hist[b];
        lut[b]  = Math.min(255, Math.round((cdf / count) * 255));
      }
      luts[ty][tx] = lut;
    }
  }

  // Interpolate
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const val  = Math.round(gray[y * w + x]);
      const tx   = x / tileSize - 0.5;
      const ty   = y / tileSize - 0.5;
      const tx0  = Math.max(0, Math.floor(tx));
      const ty0  = Math.max(0, Math.floor(ty));
      const tx1  = Math.min(tilesX - 1, tx0 + 1);
      const ty1  = Math.min(tilesY - 1, ty0 + 1);
      const fx   = tx - tx0;
      const fy   = ty - ty0;

      const v00 = luts[ty0][tx0][val];
      const v10 = luts[ty0][tx1][val];
      const v01 = luts[ty1][tx0][val];
      const v11 = luts[ty1][tx1][val];

      out[y * w + x] =
        v00 * (1 - fx) * (1 - fy) +
        v10 * fx       * (1 - fy) +
        v01 * (1 - fx) * fy       +
        v11 * fx       * fy;
    }
  }

  return out;
}

/**
 * Adaptive threshold (like OpenCV's ADAPTIVE_THRESH_MEAN_C / THRESH_BINARY).
 * For each pixel, threshold = local mean over (2*radius+1)² neighbourhood − C.
 */
function adaptiveThreshold(
  gray: Float32Array,
  w: number,
  h: number,
  radius: number,
  C: number
): Float32Array {
  const out  = new Float32Array(w * h);

  // Build integral image for fast local mean
  const intg = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      intg[(y + 1) * (w + 1) + (x + 1)] =
        gray[y * w + x] +
        intg[y * (w + 1) + (x + 1)] +
        intg[(y + 1) * (w + 1) + x] -
        intg[y * (w + 1) + x];
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0   = Math.max(0, x - radius);
      const y0   = Math.max(0, y - radius);
      const x1   = Math.min(w - 1, x + radius);
      const y1   = Math.min(h - 1, y + radius);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);
      const sum  =
        intg[(y1 + 1) * (w + 1) + (x1 + 1)] -
        intg[y0 * (w + 1) + (x1 + 1)] -
        intg[(y1 + 1) * (w + 1) + x0] +
        intg[y0 * (w + 1) + x0];
      const threshold = sum / area - C;
      out[y * w + x]  = gray[y * w + x] < threshold ? 0 : 255;
    }
  }

  return out;
}
