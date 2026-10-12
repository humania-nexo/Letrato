import type {
  CellRenderData,
  GridDimensions,
  LetratoConfig,
  ProcessedMatrix
} from './types';

export class LetratoGenerator {
  /**
   * Genera la matriz bidimensional de celdas procesadas a partir de la luminancia y la configuración.
   */
  public generateMatrix(
    grid: GridDimensions,
    luminanceMatrix: Float32Array,
    edgeMatrix: Float32Array,
    config: LetratoConfig
  ): ProcessedMatrix {
    const { columns, rows } = grid;
    const cells: CellRenderData[][] = [];

    // Normalizar texto para el flujo
    const streamChars = this.prepareTextStream(config.customText, config.caseTransform, config.ignoreWhitespace);
    let textPointer = 0;
    const textLength = streamChars.length;

    const ramp = config.asciiRamp && config.asciiRamp.length > 0 ? config.asciiRamp : ' .:-=+*#%@';
    const rampLength = ramp.length;

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

        switch (config.mode) {
          case 'tosco': {
            // Mapeo ASCII clásico de rampa de densidad
            // lum = 0 -> más oscuro (último carácter de la rampa)
            // lum = 1 -> más claro (primer carácter de la rampa)
            const darkness = 1.0 - lum;
            const rampIndex = Math.min(
              rampLength - 1,
              Math.max(0, Math.floor(darkness * rampLength))
            );
            char = ramp[rampIndex];
            opacity = 1.0;
            break;
          }

          case 'letrato': {
            // El texto recorre la cuadrícula en orden de lectura
            char = textLength > 0 ? streamChars[textPointer % textLength] : ' ';
            textPointer++;

            // El tono modula la opacidad de la tinta (en papel blanco, oscuro = mayor opacidad)
            // Invertimos lum porque lum=0 es sombra y lum=1 es luz
            const darkness = Math.min(1.0, (1.0 - lum) + edge * 0.5);

            // Piso de legibilidad: garantiza que en zonas claras la letra no desaparezca por completo
            const minFloor = config.minLegibility;
            opacity = minFloor + (1.0 - minFloor) * darkness;
            opacity = Math.max(minFloor, Math.min(1.0, opacity));
            break;
          }

          case 'typewriter': {
            // Modo Flora Stacey: tinta pura sin niveles de gris, tono logrado por sobreimpresión
            char = textLength > 0 ? streamChars[textPointer % textLength] : ' ';
            textPointer++;

            const darkness = Math.min(1.0, (1.0 - lum) + edge * 0.4);

            if (darkness < 0.15) {
              // Zona de luz absoluta: espacio en blanco
              char = ' ';
              opacity = 0;
              overprintCount = 0;
            } else if (darkness < 0.45) {
              // Zona clara: 1 pasada ligera
              opacity = 0.55;
              overprintCount = 0;
            } else if (darkness < 0.75) {
              // Zona media: 1 pasada plena
              opacity = 0.95;
              overprintCount = 1;
            } else {
              // Sombra profunda: sobreimpresión mecánica doble o triple
              opacity = 1.0;
              overprintCount = Math.min(3, config.overprintStrength || 2);
            }
            break;
          }
        }

        rowCells.push({
          char,
          x: c * grid.cellWidth,
          y: r * grid.cellHeight,
          luminance: lum,
          opacity,
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
      clean = 'LETRATO ';
    }

    // Normalizar saltos de línea y tabuladores a espacios simples
    clean = clean.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');

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
