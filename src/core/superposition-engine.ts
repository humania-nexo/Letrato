import type { GridDimensions, LetratoConfig, PlacedGlyph } from './types';

/**
 * Motor de Superposición Tipográfica Multicapa (Inspirado en la técnica de Leslie Nichols).
 *
 * A diferencia de una cuadrícula rígida donde una sola letra cambia de gris a negro,
 * este motor simula una máquina de escribir manual donde cada golpe de tecla tiene una
 * densidad de cinta constante y las sombras se construyen superponiendo múltiples pasadas
 * de palabras distintas con desplazamientos de medio renglón y giros del rodillo siguiendo
 * la dirección natural del cabello, las cejas, los ojos y los pliegues del rostro.
 */
export class SuperpositionEngine {
  public generateSuperpositionGlyphs(
    grid: GridDimensions,
    luminanceMatrix: Float32Array,
    edgeMatrix: Float32Array,
    config: LetratoConfig,
    streamChars: string[],
    centroidXMatrix?: Float32Array,
    centroidYMatrix?: Float32Array
  ): PlacedGlyph[] {
    const { columns, rows, cellWidth, cellHeight } = grid;
    const glyphs: PlacedGlyph[] = [];

    if (streamChars.length === 0) {
      return glyphs;
    }

    // Crear también un flujo de solo caracteres visibles (sin espacios) para las capas de sombra
    // de modo que cada golpe de sobreimpresión en zonas oscuras deposite tinta real.
    const inkChars = streamChars.filter((ch) => ch.trim().length > 0);
    if (inkChars.length === 0) {
      inkChars.push('a', 'e', 'o', 's', 'r', 'n', 'i', 'l', 't');
    }

    let baseTextPtr = 0;
    let shadowTextPtr = Math.floor(inkChars.length / 3);

    const cutoff = (config.backgroundCutoff ?? 16) / 100;
    const maxLayers = Math.max(2, Math.min(7, config.superpositionMaxLayers ?? 5));
    const angleSpread = Math.max(0, Math.min(1, (config.superpositionAngleSpread ?? 65) / 100));
    const baseInkOpacity = Math.max(0.22, Math.min(0.88, (config.superpositionInkDensity ?? 52) / 100));
    const airyLight = config.superpositionAiryLight ?? true;

    // 1. Calcular el Campo de Orientación Coherente (Tensor de Estructura 5x5)
    // Esto nos da el ángulo tangente suave de cada rasgo (dirección de mechones de pelo, cejas, mandíbula, lentes)
    const tangentAngles = this.computeCoherentTangentField(luminanceMatrix, columns, rows);

    // Tamaño tipográfico base de máquina de escribir
    const baseFontSize = Number((cellHeight * 0.96).toFixed(2));
    const halfW = cellWidth * 0.5;
    const halfH = cellHeight * 0.5;

    // =========================================================================
    // CAPA 0 (BASE): Renglones horizontales de máquina de escribir
    // En luces altas (piel iluminada): papel limpio.
    // En tonos suaves / fondo: espaciado aéreo ("w h e n   i   s a t").
    // En tonos medios y oscuros: renglón continuo ("i h a d n e v e r s e e n").
    // =========================================================================
    for (let r = 0; r < rows; r++) {
      const rowOffset = r * columns;
      let skipCounter = 0;

      for (let c = 0; c < columns; c++) {
        const idx = rowOffset + c;
        const lum = luminanceMatrix[idx];
        const edge = edgeMatrix[idx] || 0;
        const darkness = Math.min(1.0, 1.0 - lum + edge * 0.35);

        if (darkness < cutoff) {
          if (!config.pauseTextOnWhitespace) {
            baseTextPtr++;
          }
          continue;
        }

        const relDark = (darkness - cutoff) / Math.max(0.01, 1.0 - cutoff);

        // Espaciado aéreo en tonos suaves (estilo fondo derecho de "Barbara 1999")
        if (airyLight && relDark < 0.24 && edge < 0.16) {
          const stride = relDark < 0.10 ? 3 : 2;
          skipCounter++;
          if (skipCounter % stride !== 0) {
            continue;
          }
        }

        const ch = streamChars[baseTextPtr % streamChars.length];
        baseTextPtr++;

        if (!ch || ch === ' ') {
          continue;
        }

        // Micro-vibración mecánica de barra de tipos real
        const jitterX = this.pseudoNoise(r, c, 1) * cellWidth * 0.06;
        const jitterY = this.pseudoNoise(r, c, 2) * cellHeight * 0.05;

        // Opacidad de cinta en la primera pasada
        const layer0Opacity = Math.min(
          0.85,
          baseInkOpacity * (0.68 + 0.38 * Math.min(1.0, relDark * 1.4))
        );

        glyphs.push({
          char: ch,
          x: c * cellWidth + halfW + jitterX,
          y: r * cellHeight + halfH + jitterY,
          angle: 0,
          opacity: Number(layer0Opacity.toFixed(3)),
          fontSize: baseFontSize,
          layer: 0
        });
      }
    }

    // =========================================================================
    // CAPAS 1 A (maxLayers - 1): Superposición progresiva en sombras y rasgos
    // Donde hay más sombra, se apilan nuevas pasadas de texto con desplazamientos
    // sub-celda y rotaciones del papel siguiendo los contornos del retrato.
    // =========================================================================
    // Definición de desplazamientos y factores angulares por capa de sobreimpresión
    const layerSpecs = [
      // Capa 1: Entrelazado de medio renglón (sombras medias, cuello, ropa, pómulos)
      { minRelDark: 0.22, offsetX: 0.44, offsetY: 0.42, angleMult: 0.32, angleBias: 0.0, scale: 0.96, opMult: 0.92 },
      // Capa 2: Flujo direccional principal (sigue la curva de cejas, cabello, ojos y lentes)
      { minRelDark: 0.38, offsetX: -0.26, offsetY: 0.28, angleMult: 0.95, angleBias: 0.0, scale: 0.95, opMult: 1.0 },
      // Capa 3: Cruce tonal denso (sombras profundas de cabello, iris, labios, fosas nasales)
      { minRelDark: 0.52, offsetX: 0.22, offsetY: -0.34, angleMult: 0.75, angleBias: -0.38, scale: 0.94, opMult: 1.06 },
      // Capa 4: Saturación de carbón (cejas espesas, línea de pestañas, monturas oscuras, pliegues)
      { minRelDark: 0.66, offsetX: -0.18, offsetY: -0.22, angleMult: -0.65, angleBias: 0.45, scale: 0.92, opMult: 1.12 },
      // Capa 5: Núcleo de sombra abisal (pupilas, comisuras, mechones más negros)
      { minRelDark: 0.78, offsetX: 0.12, offsetY: 0.16, angleMult: 0.50, angleBias: 0.72, scale: 0.90, opMult: 1.18 },
      // Capa 6: Golpe extra de densidad máxima
      { minRelDark: 0.88, offsetX: -0.09, offsetY: 0.11, angleMult: -0.40, angleBias: -0.65, scale: 0.88, opMult: 1.24 }
    ];

    const activeExtraLayers = Math.min(layerSpecs.length, maxLayers - 1);

    for (let layerIdx = 0; layerIdx < activeExtraLayers; layerIdx++) {
      const spec = layerSpecs[layerIdx];
      const layerNumber = layerIdx + 1;

      for (let r = 0; r < rows; r++) {
        const rowOffset = r * columns;

        for (let c = 0; c < columns; c++) {
          const idx = rowOffset + c;
          const lum = luminanceMatrix[idx];
          const edge = edgeMatrix[idx] || 0;

          // Los bordes anatómicos (cejas, lentes, pestañas, labios) reciben refuerzo de sombra
          // para asegurar que las letras se superpongan con precisión sobre los rasgos finos
          const effectiveDarkness = Math.min(1.0, 1.0 - lum + edge * 0.48);
          if (effectiveDarkness < cutoff) {
            continue;
          }

          const relDark = (effectiveDarkness - cutoff) / Math.max(0.01, 1.0 - cutoff);
          if (relDark < spec.minRelDark) {
            continue;
          }

          const ch = inkChars[shadowTextPtr % inkChars.length];
          shadowTextPtr++;

          // Atracción hacia el centro de gravedad del trazo oscuro dentro de la celda (Sub-Cell Snap)
          let snapX = 0;
          let snapY = 0;
          if (config.subCellSnap && centroidXMatrix && centroidYMatrix) {
            snapX = centroidXMatrix[idx] * cellWidth * 0.75;
            snapY = centroidYMatrix[idx] * cellHeight * 0.75;
          }

          // Desplazamiento propio de la capa + micro-variación orgánica
          const jitterX = this.pseudoNoise(r, c, layerNumber * 7 + 3) * cellWidth * 0.14;
          const jitterY = this.pseudoNoise(r, c, layerNumber * 11 + 5) * cellHeight * 0.14;

          const posX =
            c * cellWidth +
            halfW +
            snapX +
            spec.offsetX * cellWidth * (1 - edge * 0.45) +
            jitterX;
          const posY =
            r * cellHeight +
            halfH +
            snapY +
            spec.offsetY * cellHeight * (1 - edge * 0.45) +
            jitterY;

          // Ángulo de rotación del papel en el rodillo siguiendo el flujo del rasgo
          const localTangent = tangentAngles[idx];
          const rawAngle =
            localTangent * spec.angleMult +
            spec.angleBias * (0.5 + 0.5 * this.pseudoNoise(r, c, layerNumber * 13));
          const finalAngle = rawAngle * angleSpread;

          // Opacidad progresiva para que la superposición alcance negros intensos de carbón
          const layerOpacity = Math.min(
            0.94,
            baseInkOpacity * spec.opMult * (0.78 + 0.32 * relDark)
          );

          glyphs.push({
            char: ch,
            x: Number(posX.toFixed(2)),
            y: Number(posY.toFixed(2)),
            angle: Number(finalAngle.toFixed(3)),
            opacity: Number(layerOpacity.toFixed(3)),
            fontSize: Number((baseFontSize * spec.scale).toFixed(2)),
            layer: layerNumber
          });
        }
      }
    }

    return glyphs;
  }

  /**
   * Calcula un campo de orientación tangente coherente mediante un Tensor de Estructura suavizado.
   * Devuelve para cada celda un ángulo en radianes en el rango [-PI/3, PI/3] para que las
   * palabras inclinadas sigan las curvas del cabello, cejas y mandíbula sin quedar invertidas.
   */
  private computeCoherentTangentField(
    lum: Float32Array,
    cols: number,
    rows: number
  ): Float32Array {
    const size = cols * rows;
    const jxx = new Float32Array(size);
    const jxy = new Float32Array(size);
    const jyy = new Float32Array(size);

    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        const idx = r * cols + c;
        const gx =
          -lum[(r - 1) * cols + (c - 1)] +
          lum[(r - 1) * cols + (c + 1)] -
          2 * lum[r * cols + (c - 1)] +
          2 * lum[r * cols + (c + 1)] -
          lum[(r + 1) * cols + (c - 1)] +
          lum[(r + 1) * cols + (c + 1)];

        const gy =
          -lum[(r - 1) * cols + (c - 1)] -
          2 * lum[(r - 1) * cols + c] -
          lum[(r - 1) * cols + (c + 1)] +
          lum[(r + 1) * cols + (c - 1)] +
          2 * lum[(r + 1) * cols + c] +
          lum[(r + 1) * cols + (c + 1)];

        jxx[idx] = gx * gx;
        jxy[idx] = gx * gy;
        jyy[idx] = gy * gy;
      }
    }

    const angles = new Float32Array(size);
    const radius = 2;

    for (let r = 0; r < rows; r++) {
      const rMin = Math.max(0, r - radius);
      const rMax = Math.min(rows - 1, r + radius);
      for (let c = 0; c < cols; c++) {
        const cMin = Math.max(0, c - radius);
        const cMax = Math.min(cols - 1, c + radius);

        let sumXX = 0;
        let sumXY = 0;
        let sumYY = 0;

        for (let nr = rMin; nr <= rMax; nr++) {
          const rowOff = nr * cols;
          for (let nc = cMin; nc <= cMax; nc++) {
            const nIdx = rowOff + nc;
            sumXX += jxx[nIdx];
            sumXY += jxy[nIdx];
            sumYY += jyy[nIdx];
          }
        }

        // Vector tangente a las isófonas (perpendicular al gradiente)
        let theta = 0.5 * Math.atan2(2 * sumXY, sumXX - sumYY) + Math.PI * 0.5;

        // Mantener orientación legible de izquierda a derecha en [-PI/2, PI/2]
        while (theta > Math.PI * 0.5) theta -= Math.PI;
        while (theta < -Math.PI * 0.5) theta += Math.PI;

        // Acotar giro máximo a ~52 grados para imitar el giro natural del papel en máquina de escribir
        const maxTilt = 0.92;
        angles[r * cols + c] = Math.max(-maxTilt, Math.min(maxTilt, theta));
      }
    }

    return angles;
  }

  /**
   * Generador determinista de ruido pseudoaleatorio en [-1, 1] para que el retrato
   * no parpadee al mover un control pero conserve textura orgánica analógica.
   */
  private pseudoNoise(r: number, c: number, seed: number): number {
    const n = Math.sin(r * 127.1 + c * 311.7 + seed * 74.7) * 43758.5453123;
    return (n - Math.floor(n)) * 2.0 - 1.0;
  }
}
