import type { GridDimensions, LetratoConfig } from './types';

export class ImageProcessor {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    const context = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      throw new Error('No se pudo inicializar el contexto 2D de procesamiento de imagen');
    }
    this.ctx = context;
  }

  /**
   * Carga una imagen a partir de una URL, Data URL o File/Blob.
   */
  public async loadImage(source: string | File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => resolve(img);
      img.onerror = (err) => reject(new Error('Fallo al cargar la imagen: ' + err));

      if (typeof source === 'string') {
        img.src = source;
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          img.src = e.target?.result as string;
        };
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(source);
      }
    });
  }

  /**
   * Extrae la matriz de luminancias por celda de acuerdo a la cuadrícula y configuración.
   * Retorna un Float32Array de longitud (rows * columns) con valores normalizados entre 0 (negro) y 1 (blanco).
   */
  public extractLuminanceMatrix(
    image: HTMLImageElement,
    grid: GridDimensions,
    config: LetratoConfig
  ): { luminanceMatrix: Float32Array; edgeMatrix: Float32Array } {
    const { columns, rows } = grid;
    const width = grid.totalWidth;
    const height = grid.totalHeight;

    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(image, 0, 0, width, height);

    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const cellW = width / columns;
    const cellH = height / rows;

    const totalCells = columns * rows;
    const rawLuminance = new Float32Array(totalCells);
    const edgeMatrix = new Float32Array(totalCells);

    // 1. Muestreo de luminancia promedio por cada celda
    for (let r = 0; r < rows; r++) {
      const startY = Math.floor(r * cellH);
      const endY = Math.min(height, Math.floor((r + 1) * cellH));

      for (let c = 0; c < columns; c++) {
        const startX = Math.floor(c * cellW);
        const endX = Math.min(width, Math.floor((c + 1) * cellW));

        let sumLum = 0;
        let count = 0;

        // Muestrear píxeles dentro de la celda (con paso para mantener alto rendimiento)
        const stepX = Math.max(1, Math.floor((endX - startX) / 8));
        const stepY = Math.max(1, Math.floor((endY - startY) / 8));

        for (let y = startY; y < endY; y += stepY) {
          const rowOffset = y * width * 4;
          for (let x = startX; x < endX; x += stepX) {
            const idx = rowOffset + x * 4;
            const red = data[idx];
            const green = data[idx + 1];
            const blue = data[idx + 2];

            // Fórmula de luminancia perceptual ITU-R BT.601
            const lum = 0.299 * red + 0.587 * green + 0.114 * blue;
            sumLum += lum;
            count++;
          }
        }

        const avgLum255 = count > 0 ? sumLum / count : 255;
        let normLum = avgLum255 / 255; // 0 (negro) a 1 (blanco)

        // 2. Aplicar Ajustes de Tono (Brillo, Contraste, Gamma)
        normLum = this.applyToneCurves(normLum, config.brightness, config.contrast, config.gamma);

        if (config.invert) {
          normLum = 1.0 - normLum;
        }

        rawLuminance[r * columns + c] = Math.max(0, Math.min(1, normLum));
      }
    }

    // 3. Detección de bordes Sobel opcional para acento facial
    if (config.edgeEnhancement > 0) {
      const factor = config.edgeEnhancement / 100;
      for (let r = 1; r < rows - 1; r++) {
        for (let c = 1; c < columns - 1; c++) {
          const tl = rawLuminance[(r - 1) * columns + (c - 1)];
          const tc = rawLuminance[(r - 1) * columns + c];
          const tr = rawLuminance[(r - 1) * columns + (c + 1)];
          const ml = rawLuminance[r * columns + (c - 1)];
          const mr = rawLuminance[r * columns + (c + 1)];
          const bl = rawLuminance[(r + 1) * columns + (c - 1)];
          const bc = rawLuminance[(r + 1) * columns + c];
          const br = rawLuminance[(r + 1) * columns + (c + 1)];

          const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
          const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
          const mag = Math.min(1, Math.sqrt(gx * gx + gy * gy));

          edgeMatrix[r * columns + c] = mag * factor;
        }
      }
    }

    return {
      luminanceMatrix: rawLuminance,
      edgeMatrix
    };
  }

  /**
   * Curvas de calibración tonal:
   * - Brillo [-100, 100]
   * - Contraste [-100, 100]
   * - Gamma [0.2, 3.0]
   */
  private applyToneCurves(l: number, brightness: number, contrast: number, gamma: number): number {
    let result = l;

    // Brillo
    if (brightness !== 0) {
      result += brightness / 100;
    }

    // Contraste
    if (contrast !== 0) {
      const c = Math.max(-100, Math.min(100, contrast));
      const factor = (259 * (c + 255)) / (255 * (259 - c));
      result = factor * (result - 0.5) + 0.5;
    }

    // Clamping intermedio
    result = Math.max(0, Math.min(1, result));

    // Gamma
    if (gamma > 0 && gamma !== 1.0) {
      result = Math.pow(result, 1 / gamma);
    }

    return Math.max(0, Math.min(1, result));
  }
}
