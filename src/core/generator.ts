import type {
  CellRenderData,
  GridDimensions,
  LetratoConfig,
  ProcessedMatrix
} from './types';
import { ContourTracer } from './contour-tracer';
import { SuperpositionEngine } from './superposition-engine';

export class LetratoGenerator {
  private contourTracer: ContourTracer;
  private superpositionEngine: SuperpositionEngine;

  constructor() {
    this.contourTracer = new ContourTracer();
    this.superpositionEngine = new SuperpositionEngine();
  }

  /**
   * Genera la matriz bidimensional de celdas procesadas o el trazado de contornos/superposición tipográfica.
   */
  public generateMatrix(
    grid: GridDimensions,
    luminanceMatrix: Float32Array,
    edgeMatrix: Float32Array,
    config: LetratoConfig,
    rawImageData?: ImageData,
    centroidXMatrix?: Float32Array,
    centroidYMatrix?: Float32Array
  ): ProcessedMatrix {
    // Si el modo es Contorno / Caligrama y disponemos de la imagen en bruto
    if (config.mode === 'contorno' && rawImageData) {
      const { paths, glyphs } = this.contourTracer.traceAndPlaceGlyphs(
        grid.totalWidth,
        grid.totalHeight,
        rawImageData,
        config
      );

      return {
        grid,
        cells: [],
        luminanceMap: luminanceMatrix,
        config,
        contourPaths: paths,
        contourGlyphs: glyphs
      };
    }

    // Normalizar texto para el flujo
    const streamChars = this.prepareTextStream(config.customText, config.caseTransform, config.ignoreWhitespace);

    // Si el modo es Superposición (Estilo Leslie Nichols)
    if (config.mode === 'superposicion') {
      const glyphs = this.superpositionEngine.generateSuperpositionGlyphs(
        grid,
        luminanceMatrix,
        edgeMatrix,
        config,
        streamChars,
        centroidXMatrix,
        centroidYMatrix
      );

      return {
        grid,
        cells: [],
        luminanceMap: luminanceMatrix,
        config,
        contourGlyphs: glyphs
      };
    }

    const { columns, rows } = grid;
    const cells: CellRenderData[][] = [];

    let textPointer = 0;
    const textLength = streamChars.length;

    const ramp = config.asciiRamp && config.asciiRamp.length > 0 ? config.asciiRamp : ' .:-=+*#%@';
    const rampLength = ramp.length;

    const cutoff = (config.backgroundCutoff ?? 16) / 100;

    for (let r = 0; r < rows; r++) {
      const rowCells: CellRenderData[] = [];
      const rowOffset = r * columns;

      for (let c = 0; c < columns; c++) {
        const idx = rowOffset + c;
        const lum = luminanceMatrix[idx]; // 0 (negro) a 1 (blanco)
        const edge = edgeMatrix[idx] || 0;

        let char = ' ';
        let opacity = 1.0;
        let overprintCount = 0;
        let fontWeight: string | number = '400';
        let fontScale = 1.0;

        // Calcular oscuridad tonal efectiva
        let darkness = 1.0 - lum;
        if (edge > 0) {
          darkness = Math.min(1.0, darkness + edge * 0.45);
        }

        // Peso y escala tipográfica dinámica según profundidad de sombra y micro-rasgo
        if (config.variableWeight) {
          if (darkness > 0.62) {
            fontWeight = '700'; // Bold para cejas, armazones de lentes, pupilas y cabello
          } else if (darkness > 0.35) {
            fontWeight = '600'; // SemiBold para rasgos medios
          } else {
            fontWeight = '400'; // Regular para sombreados suaves de piel
          }
          fontScale = 0.86 + Math.min(0.24, darkness * 0.24);
        }

        switch (config.mode) {
          case 'tosco': {
            if (darkness < cutoff) {
              char = ' ';
              opacity = 0;
            } else {
              const relDark = (darkness - cutoff) / Math.max(0.01, 1.0 - cutoff);
              const rampIndex = Math.min(
                rampLength - 1,
                Math.max(1, Math.floor(relDark * rampLength))
              );
              char = ramp[rampIndex];
              opacity = 1.0;
            }
            break;
          }

          case 'letrato': {
            if (darkness < cutoff) {
              // Zona de papel limpio / fondo claro: dejar espacio en blanco para recortar la silueta
              char = ' ';
              opacity = 0;
            } else {
              char = textLength > 0 ? streamChars[textPointer % textLength] : ' ';
              if (config.pauseTextOnWhitespace) {
                textPointer++; // El texto avanza solo sobre la figura para mantener lectura continua
              }

              const relDark = (darkness - cutoff) / Math.max(0.01, 1.0 - cutoff);
              const minFloor = Math.max(0.12, config.minLegibility || 0.18);
              opacity = minFloor + (1.0 - minFloor) * Math.pow(relDark, 0.72);
              opacity = Math.max(0, Math.min(1.0, opacity));
            }

            if (!config.pauseTextOnWhitespace) {
              textPointer++;
            }
            break;
          }

          case 'typewriter': {
            if (darkness < cutoff) {
              char = ' ';
              opacity = 0;
              overprintCount = 0;
            } else {
              char = textLength > 0 ? streamChars[textPointer % textLength] : ' ';
              if (config.pauseTextOnWhitespace) {
                textPointer++;
              }

              opacity = 0.95;
              const relDark = (darkness - cutoff) / Math.max(0.01, 1.0 - cutoff);
              if (relDark > 0.65) {
                overprintCount = Math.min(3, config.overprintStrength || 2);
              } else if (relDark > 0.35) {
                overprintCount = 1;
              } else {
                overprintCount = 0;
              }
            }

            if (!config.pauseTextOnWhitespace) {
              textPointer++;
            }
            break;
          }
        }

        // Alineación Sub-Celda: desplaza ligeramente la letra hacia el centro exacto del trazo oscuro
        // (elimina el efecto escalera en monturas de lentes, cejas y párpados)
        let subOffsetX = 0;
        let subOffsetY = 0;
        if (config.subCellSnap && centroidXMatrix && centroidYMatrix && darkness >= cutoff) {
          subOffsetX = centroidXMatrix[idx] * grid.cellWidth * 0.68;
          subOffsetY = centroidYMatrix[idx] * grid.cellHeight * 0.68;
        }

        rowCells.push({
          char,
          x: c * grid.cellWidth + subOffsetX,
          y: r * grid.cellHeight + subOffsetY,
          luminance: lum,
          opacity,
          fontWeight,
          fontScale,
          overprintCount,
          edgeStrength: edge
        });
      }

      cells.push(rowCells);
    }

    return {
      grid,
      cells,
      luminanceMap: luminanceMatrix,
      config
    };
  }

  /**
   * Prepara la cadena de texto para flujo continuo sin saltos abruptos.
   */
  private prepareTextStream(text: string, caseTransform: 'original' | 'uppercase' | 'lowercase', ignoreWhitespace: boolean): string[] {
    let clean = (text || '').trim();
    if (!clean) {
      clean = 'LETRATO · ';
    }

    // Normalizar saltos de línea y tabuladores a espacios simples
    clean = clean.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

    // Manejo de símbolo ™: reemplazar automáticamente por (TM) para evitar glifos mutilados en fuentes monoespaciadas
    clean = clean.replace(/™/g, '(TM)');
    clean = clean.replace(/DinastIAT\b/g, 'DinastIA(TM)');

    // Agregar separador al final para que el final de una vuelta no se pegue al inicio de la siguiente
    if (!clean.endsWith(' ') && !clean.endsWith('·')) {
      clean += ' · ';
    }

    if (ignoreWhitespace) {
      clean = clean.replace(/\s+/g, '');
    }

    if (caseTransform === 'uppercase') {
      clean = clean.toUpperCase();
    } else if (caseTransform === 'lowercase') {
      clean = clean.toLowerCase();
    }

    return Array.from(clean);
  }
}
