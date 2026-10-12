import type { ContourPath, LetratoConfig, PlacedGlyph, Point2D } from './types';

export class ContourTracer {
  /**
   * Extrae los trazos de contorno y coloca los glifos tipográficos a lo largo de las curvas del rostro.
   */
  public traceAndPlaceGlyphs(
    width: number,
    height: number,
    imageData: ImageData,
    config: LetratoConfig
  ): { paths: ContourPath[]; glyphs: PlacedGlyph[] } {
    const data = imageData.data;
    const totalPixels = width * height;

    // 1. Convertir a luminancia en escala de grises con Auto-Niveles adaptativos
    const gray = new Float32Array(totalPixels);
    let minGray = 1.0;
    let maxGray = 0.0;

    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      gray[i] = lum;
      if (lum < minGray) minGray = lum;
      if (lum > maxGray) maxGray = lum;
    }

    // Auto-estiramiento de histograma si el dibujo tiene poco contraste
    if (config.autoLevels && maxGray - minGray > 0.1) {
      const range = maxGray - minGray;
      for (let i = 0; i < totalPixels; i++) {
        gray[i] = Math.max(0, Math.min(1, (gray[i] - minGray) / range));
      }
    }

    // 2. Gradientes de Sobel y Detección de Bordes
    const magnitude = new Float32Array(totalPixels);
    const angle = new Float32Array(totalPixels);

    // Umbral calibrado (default 18% para captar trazos de grafito)
    const threshold = (config.contourThreshold ?? 18) / 100;

    for (let y = 1; y < height - 1; y++) {
      const rowOffset = y * width;
      for (let x = 1; x < width - 1; x++) {
        const idx = rowOffset + x;

        const tl = gray[(y - 1) * width + (x - 1)];
        const tc = gray[(y - 1) * width + x];
        const tr = gray[(y - 1) * width + (x + 1)];
        const ml = gray[y * width + (x - 1)];
        const mr = gray[y * width + (x + 1)];
        const bl = gray[(y + 1) * width + (x - 1)];
        const bc = gray[(y + 1) * width + x];
        const br = gray[(y + 1) * width + (x + 1)];

        const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
        const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;

        const mag = Math.sqrt(gx * gx + gy * gy);
        magnitude[idx] = mag;
        angle[idx] = Math.atan2(gy, gx);
      }
    }

    // 3. Encadenamiento de píxeles de borde en polilíneas continuas
    const visited = new Uint8Array(totalPixels);
    const rawPaths: Point2D[][] = [];
    const minLength = config.contourMinLength ?? 18;

    // Recorrer con paso dinámico según densidad
    const step = Math.max(1, 4 - (config.contourDensity || 2));

    for (let y = 2; y < height - 2; y += step) {
      for (let x = 2; x < width - 2; x += step) {
        const idx = y * width + x;
        if (visited[idx] || magnitude[idx] < threshold) continue;

        // Iniciar un nuevo trazo
        const path = this.followContour(x, y, width, height, magnitude, visited, threshold);
        if (path.length >= 3) {
          rawPaths.push(path);
        }
      }
    }

    // 4. Simplificación RDP y Suavizado de Chaikin
    const contourPaths: ContourPath[] = [];
    let pathIdCounter = 0;

    for (const raw of rawPaths) {
      const simplified = this.ramerDouglasPeucker(raw, 1.8);
      if (simplified.length < 2) continue;

      const smoothed = this.chaikinSmooth(simplified, 2);
      const len = this.calculatePathLength(smoothed);

      if (len >= minLength) {
        // Calcular oscuridad promedio a lo largo del trazo
        const darkness = this.sampleAverageDarkness(smoothed, width, gray);
        contourPaths.push({
          id: `contour_${pathIdCounter++}`,
          points: smoothed,
          length: len,
          darkness
        });
      }
    }

    // 5. Opcional: Tramado tipográfico en zonas de sombra profunda (Cross-Hatching)
    if (config.contourHatching) {
      const hatchingPaths = this.generateShadowHatching(width, height, gray);
      contourPaths.push(...hatchingPaths);
    }

    // 6. Colocar Glifos Tipográficos a lo largo de cada curva
    const placedGlyphs = this.placeTextAlongPaths(contourPaths, config);

    return {
      paths: contourPaths,
      glyphs: placedGlyphs
    };
  }

  /**
   * Rastrea un borde 8-conexo en la dirección tangencial del gradiente.
   */
  private followContour(
    startX: number,
    startY: number,
    width: number,
    height: number,
    magnitude: Float32Array,
    visited: Uint8Array,
    threshold: number
  ): Point2D[] {
    const path: Point2D[] = [{ x: startX, y: startY }];
    visited[startY * width + startX] = 1;

    let currX = startX;
    let currY = startY;
    const maxSteps = 400; // Evita bucles infinitos

    for (let step = 0; step < maxSteps; step++) {
      let nextX = -1;
      let nextY = -1;
      let maxMag = -1;

      // Explorar 8 vecinos
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = currX + dx;
          const ny = currY + dy;

          if (nx < 1 || nx >= width - 1 || ny < 1 || ny >= height - 1) continue;

          const nIdx = ny * width + nx;
          if (visited[nIdx]) continue;

          const mag = magnitude[nIdx];
          if (mag > threshold && mag > maxMag) {
            maxMag = mag;
            nextX = nx;
            nextY = ny;
          }
        }
      }

      if (nextX !== -1 && nextY !== -1) {
        visited[nextY * width + nextX] = 1;
        path.push({ x: nextX, y: nextY });
        currX = nextX;
        currY = nextY;
      } else {
        break;
      }
    }

    return path;
  }

  /**
   * Simplificación Ramer-Douglas-Peucker (RDP) para aligerar la polilínea.
   */
  private ramerDouglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
    if (points.length <= 2) return points;
    let dmax = 0;
    let index = 0;
    const start = points[0];
    const end = points[points.length - 1];

    for (let i = 1; i < points.length - 1; i++) {
      const d = this.perpendicularDistance(points[i], start, end);
      if (d > dmax) {
        index = i;
        dmax = d;
      }
    }

    if (dmax > epsilon) {
      const rec1 = this.ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
      const rec2 = this.ramerDouglasPeucker(points.slice(index), epsilon);
      return rec1.slice(0, -1).concat(rec2);
    }
    return [start, end];
  }

  private perpendicularDistance(p: Point2D, a: Point2D, b: Point2D): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const mag = Math.hypot(dx, dy);
    if (mag === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / mag;
  }

  /**
   * Suavizado de Chaikin para curvas continuas C1.
   */
  private chaikinSmooth(points: Point2D[], iterations = 2): Point2D[] {
    let curr = points;
    for (let it = 0; it < iterations; it++) {
      if (curr.length < 3) break;
      const next: Point2D[] = [curr[0]];
      for (let i = 0; i < curr.length - 1; i++) {
        const p0 = curr[i];
        const p1 = curr[i + 1];
        next.push({ x: 0.75 * p0.x + 0.25 * p1.x, y: 0.75 * p0.y + 0.25 * p1.y });
        next.push({ x: 0.25 * p0.x + 0.75 * p1.x, y: 0.25 * p0.y + 0.75 * p1.y });
      }
      next.push(curr[curr.length - 1]);
      curr = next;
    }
    return curr;
  }

  private calculatePathLength(points: Point2D[]): number {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      len += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    return len;
  }

  private sampleAverageDarkness(points: Point2D[], width: number, gray: Float32Array): number {
    let sumDark = 0;
    for (const p of points) {
      const ix = Math.floor(p.x);
      const iy = Math.floor(p.y);
      const lum = gray[iy * width + ix] || 1;
      sumDark += 1.0 - lum;
    }
    return points.length > 0 ? sumDark / points.length : 0.5;
  }

  /**
   * Genera líneas de tramado (hatching) para las sombras más profundas (pupilas, cuencas, sombras).
   */
  private generateShadowHatching(width: number, height: number, gray: Float32Array): ContourPath[] {
    const hatchingPaths: ContourPath[] = [];
    const spacing = 14;
    let hatchId = 0;

    for (let y = 10; y < height - 10; y += spacing) {
      let inShadow = false;
      let currentSeg: Point2D[] = [];

      for (let x = 10; x < width - 10; x += 4) {
        const lum = gray[y * width + x];
        // Umbral de sombra profunda
        if (lum < 0.42) {
          if (!inShadow) {
            inShadow = true;
            currentSeg = [];
          }
          currentSeg.push({ x, y });
        } else {
          if (inShadow) {
            inShadow = false;
            if (currentSeg.length >= 6) {
              hatchingPaths.push({
                id: `hatch_${hatchId++}`,
                points: currentSeg,
                length: currentSeg.length * 4,
                darkness: 0.85,
                isHatching: true
              });
            }
          }
        }
      }

      if (inShadow && currentSeg.length >= 6) {
        hatchingPaths.push({
          id: `hatch_${hatchId++}`,
          points: currentSeg,
          length: currentSeg.length * 4,
          darkness: 0.85,
          isHatching: true
        });
      }
    }

    return hatchingPaths;
  }

  /**
   * Coloca los glifos secuenciales del texto a lo largo de cada curva de contorno.
   */
  private placeTextAlongPaths(paths: ContourPath[], config: LetratoConfig): PlacedGlyph[] {
    const glyphs: PlacedGlyph[] = [];

    // Limpiar y preparar texto cíclico (loop infinito)
    let cleanText = (config.customText || '').trim();
    if (!cleanText) {
      cleanText = 'LETRATO · DE LEJOS UN ROSTRO DE CERCA UNA HISTORIA · ';
    }
    cleanText = cleanText.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

    if (config.ignoreWhitespace) {
      cleanText = cleanText.replace(/\s+/g, '');
    }

    if (config.caseTransform === 'uppercase') {
      cleanText = cleanText.toUpperCase();
    } else if (config.caseTransform === 'lowercase') {
      cleanText = cleanText.toLowerCase();
    }

    const textChars = Array.from(cleanText);
    const textLength = textChars.length;
    let charPointer = 0;

    const baseFontSize = config.contourFontSize || 11;
    const charSpacing = baseFontSize * 0.72; // Paso entre caracteres sucesivos

    for (const path of paths) {
      const points = path.points;
      if (points.length < 2) continue;

      // Precalcular distancias acumuladas a lo largo de la curva
      const cumulativeDist = [0];
      for (let i = 1; i < points.length; i++) {
        const d = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
        cumulativeDist.push(cumulativeDist[i - 1] + d);
      }

      const totalDist = cumulativeDist[cumulativeDist.length - 1];
      if (totalDist < charSpacing) continue;

      // Desplazamiento inicial sutil
      let currentDist = charSpacing * 0.5;

      while (currentDist < totalDist - charSpacing * 0.5) {
        // Encontrar segmento que contiene currentDist
        let segIdx = 0;
        while (segIdx < cumulativeDist.length - 1 && cumulativeDist[segIdx + 1] < currentDist) {
          segIdx++;
        }

        const p0 = points[segIdx];
        const p1 = points[Math.min(points.length - 1, segIdx + 1)];

        const segStartDist = cumulativeDist[segIdx];
        const segEndDist = cumulativeDist[Math.min(cumulativeDist.length - 1, segIdx + 1)];
        const segLen = segEndDist - segStartDist;

        const t = segLen > 0 ? (currentDist - segStartDist) / segLen : 0;

        // Posición interpolada del glifo
        const gx = p0.x + (p1.x - p0.x) * t;
        const gy = p0.y + (p1.y - p0.y) * t;

        // Ángulo tangente a la curva
        const angle = Math.atan2(p1.y - p0.y, p1.x - p0.x);

        // Carácter cíclico del texto
        const char = textChars[charPointer % textLength];
        charPointer++;

        // Opacidad según la sombra del trazo
        const opacity = Math.max(0.4, Math.min(1.0, 0.4 + path.darkness * 0.6));

        glyphs.push({
          char,
          x: gx,
          y: gy,
          angle,
          opacity,
          fontSize: baseFontSize
        });

        currentDist += charSpacing;
      }
    }

    return glyphs;
  }
}
