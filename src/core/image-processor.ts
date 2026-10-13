import type { CropFormat, GridDimensions, LetratoConfig } from './types';
import { getCropRegion } from './card-layout';

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
   * Obtiene la estructura ImageData para procesamiento a resolución completa aplicando el encuadre seleccionado.
   */
  public getImageData(
    image: HTMLImageElement,
    width: number,
    height: number,
    cropFormat: CropFormat = 'original'
  ): ImageData {
    const crop = getCropRegion(
      image.naturalWidth || width,
      image.naturalHeight || height,
      cropFormat
    );
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);
    return this.ctx.getImageData(0, 0, width, height);
  }

  /**
   * Extrae la matriz de luminancias por celda de acuerdo a la cuadrícula y configuración.
   * Retorna un Float32Array de longitud (rows * columns) con valores normalizados entre 0 (negro) y 1 (blanco).
   */
  public extractLuminanceMatrix(
    image: HTMLImageElement,
    grid: GridDimensions,
    config: LetratoConfig
  ): {
    luminanceMatrix: Float32Array;
    edgeMatrix: Float32Array;
    centroidXMatrix: Float32Array;
    centroidYMatrix: Float32Array;
  } {
    const { columns, rows } = grid;
    const width = grid.totalWidth;
    const height = grid.totalHeight;

    const crop = getCropRegion(
      image.naturalWidth || width,
      image.naturalHeight || height,
      config.cropFormat || 'original'
    );

    this.canvas.width = width;
    this.canvas.height = height;

    this.ctx.clearRect(0, 0, width, height);
    this.ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height);

    const imageData = this.ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const cellW = width / columns;
    const cellH = height / rows;

    const totalCells = columns * rows;
    const rawLuminance = new Float32Array(totalCells);
    const edgeMatrix = new Float32Array(totalCells);
    const centroidXMatrix = new Float32Array(totalCells);
    const centroidYMatrix = new Float32Array(totalCells);

    // 1. Pre-análisis de histograma global para Auto-Niveles adaptativos
    let pMin = 0;
    let pMax = 1;
    let medianLum = 0.5;

    if (config.autoLevels) {
      const hist = new Uint32Array(256);
      let totalSamples = 0;
      const sampleStep = Math.max(1, Math.floor((width * height) / 40000));
      for (let i = 0; i < data.length; i += sampleStep * 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        hist[l]++;
        totalSamples++;
      }

      const p2Count = totalSamples * 0.02;
      const p50Count = totalSamples * 0.50;
      const p98Count = totalSamples * 0.98;

      let cum = 0;
      let p2Found = false;
      let p50Found = false;

      for (let b = 0; b < 256; b++) {
        cum += hist[b];
        if (!p2Found && cum >= p2Count) {
          pMin = b / 255;
          p2Found = true;
        }
        if (!p50Found && cum >= p50Count) {
          medianLum = b / 255;
          p50Found = true;
        }
        if (cum >= p98Count) {
          pMax = b / 255;
          break;
        }
      }

      // Si el rango es muy comprimido (como en un boceto a lápiz), estirar con seguridad
      if (pMax - pMin < 0.12) {
        pMin = 0;
        pMax = 1;
      }
    }

    // 2. Muestreo de alta precisión por celda (Min-Pooling + Centroide Sub-Celda para Lentes/Cejas/Ojos)
    const lineWeight = Math.max(0, Math.min(1, (config.lineSensitivity ?? 65) / 100));

    for (let r = 0; r < rows; r++) {
      const startY = Math.floor(r * cellH);
      const endY = Math.min(height, Math.max(startY + 1, Math.floor((r + 1) * cellH)));
      const spanY = Math.max(1, endY - startY);

      for (let c = 0; c < columns; c++) {
        const startX = Math.floor(c * cellW);
        const endX = Math.min(width, Math.max(startX + 1, Math.floor((c + 1) * cellW)));
        const spanX = Math.max(1, endX - startX);

        let sumLum = 0;
        let minLum = 255;
        let maxLum = 0;
        let count = 0;

        let sumWX = 0;
        let sumWY = 0;
        let sumW = 0;

        // Muestreo fino (paso 1 o 2 px máximo para nunca perder armazones de lentes o pestañas de 1px)
        const stepX = Math.max(1, Math.floor(spanX / 12));
        const stepY = Math.max(1, Math.floor(spanY / 12));

        for (let y = startY; y < endY; y += stepY) {
          const rowOffset = y * width * 4;
          const relY = (y - startY) / spanY - 0.5;
          for (let x = startX; x < endX; x += stepX) {
            const idx = rowOffset + x * 4;
            const red = data[idx];
            const green = data[idx + 1];
            const blue = data[idx + 2];

            // Luminancia perceptual ITU-R BT.601
            const lum = 0.299 * red + 0.587 * green + 0.114 * blue;
            sumLum += lum;
            if (lum < minLum) minLum = lum;
            if (lum > maxLum) maxLum = lum;
            count++;

            // Peso cúbico de oscuridad para atraer la letra hacia el trazo fino dentro de la celda
            const darkNorm = (255 - lum) / 255;
            const w = darkNorm * darkNorm * darkNorm;
            if (w > 0.001) {
              const relX = (x - startX) / spanX - 0.5;
              sumWX += w * relX;
              sumWY += w * relY;
              sumW += w;
            }
          }
        }

        const cellIndex = r * columns + c;
        const avgLum255 = count > 0 ? sumLum / count : 255;
        const intraCellContrast = (maxLum - minLum) / 255;

        // Si dentro de la celda pasa un rasgo fino (ej. montura de lentes o ceja sobre piel clara),
        // reforzamos el peso del píxel más oscuro para que el trazo no se diluya
        const dynamicLineWeight = Math.min(0.92, lineWeight + intraCellContrast * 0.25);
        const combinedLum255 = avgLum255 * (1 - dynamicLineWeight) + minLum * dynamicLineWeight;
        let normLum = combinedLum255 / 255;

        // Guardar centroide sub-celda si existe variación interna de trazo
        if (sumW > 0.01 && intraCellContrast > 0.08) {
          centroidXMatrix[cellIndex] = Math.max(-0.45, Math.min(0.45, sumWX / sumW));
          centroidYMatrix[cellIndex] = Math.max(-0.45, Math.min(0.45, sumWY / sumW));
        }

        // Auto-Niveles: expandir rango dinámico a [0, 1]
        if (config.autoLevels && pMax > pMin) {
          normLum = (normLum - pMin) / (pMax - pMin);
          normLum = Math.max(0, Math.min(1, normLum));
        }

        // Aplicar curvas de tono con pivote adaptativo
        normLum = this.applyToneCurves(
          normLum,
          config.brightness,
          config.contrast,
          config.gamma,
          medianLum
        );

        if (config.invert) {
          normLum = 1.0 - normLum;
        }

        rawLuminance[cellIndex] = Math.max(0, Math.min(1, normLum));
      }
    }

    // 2.5 Realce Local de Micro-Rasgos (DoG / CLAHE local para cejas, lentes, pupilas, nariz y labios)
    const microStrength = (config.microDetail ?? 75) / 100;
    if (microStrength > 0) {
      const baseLum = new Float32Array(rawLuminance);
      const radius = 3; // Ventana local 7x7 celdas

      for (let r = 0; r < rows; r++) {
        const rMin = Math.max(0, r - radius);
        const rMax = Math.min(rows - 1, r + radius);

        for (let c = 0; c < columns; c++) {
          const cMin = Math.max(0, c - radius);
          const cMax = Math.min(columns - 1, c + radius);

          let localSum = 0;
          let localCount = 0;

          for (let nr = rMin; nr <= rMax; nr++) {
            const rowOff = nr * columns;
            for (let nc = cMin; nc <= cMax; nc++) {
              localSum += baseLum[rowOff + nc];
              localCount++;
            }
          }

          const idx = r * columns + c;
          const localMean = localSum / localCount;
          const current = baseLum[idx];
          // localDiff > 0 significa que esta celda es más oscura que la piel/entorno inmediato
          const localDiff = localMean - current;

          if (localDiff > 0.008) {
            // Rasgo oscuro local (ceja, armazón de lente, pestaña, pliegue labial): oscurecer con precisión
            const boost = localDiff * microStrength * 1.55;
            rawLuminance[idx] = Math.max(0, current - boost);
          } else if (localDiff < -0.015) {
            // Brillo local (reflejo pupilar, cristal de lente, tabique nasal): aclarar sutilmente
            const highlight = (-localDiff) * microStrength * 0.45;
            rawLuminance[idx] = Math.min(1, current + highlight);
          }
        }
      }
    }

    // 3. Detección de bordes Sobel para realce facial y de monturas/ojos
    const edgeFactor = Math.max((config.edgeEnhancement || 0) / 100, microStrength * 0.35);
    if (edgeFactor > 0) {
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

          edgeMatrix[r * columns + c] = mag * edgeFactor;
        }
      }
    }

    return {
      luminanceMatrix: rawLuminance,
      edgeMatrix,
      centroidXMatrix,
      centroidYMatrix
    };
  }

  /**
   * Curvas de calibración tonal con pivote adaptativo
   */
  private applyToneCurves(
    l: number,
    brightness: number,
    contrast: number,
    gamma: number,
    pivot: number = 0.5
  ): number {
    let result = l;

    // Brillo
    if (brightness !== 0) {
      result += brightness / 100;
    }

    // Contraste centrado en el tono medio real del dibujo
    if (contrast !== 0) {
      const c = Math.max(-100, Math.min(100, contrast));
      const factor = (259 * (c + 255)) / (255 * (259 - c));
      result = factor * (result - pivot) + pivot;
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
