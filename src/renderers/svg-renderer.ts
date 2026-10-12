import type { ProcessedMatrix } from '../core/types';

export class SvgRenderer {
  /**
   * Genera el código XML del SVG vectorial puro a partir de la matriz procesada.
   */
  public generateSvg(matrix: ProcessedMatrix): string {
    const { grid, cells, config } = matrix;
    const { totalWidth, totalHeight, cellWidth, cellHeight, columns, rows } = grid;

    const isDark = config.paperTheme === 'dark';
    const bgFill =
      config.paperTheme === 'white'
        ? '#ffffff'
        : config.paperTheme === 'sepia'
        ? '#f4ede2'
        : config.paperTheme === 'cream'
        ? '#fdfbf7'
        : '#0f1115';

    const inkColor = isDark ? '#ffffff' : '#111111';
    const fontSize = (cellHeight * 0.95).toFixed(2);
    const halfCellW = (cellWidth / 2);
    const halfCellH = (cellHeight / 2);

    let textElements = '';

    for (let r = 0; r < rows; r++) {
      const row = cells[r];
      for (let c = 0; c < columns; c++) {
        const cell = row[c];
        if (!cell.char || cell.char === ' ' || cell.opacity <= 0.01) {
          continue;
        }

        const posX = (cell.x + halfCellW).toFixed(2);
        const posY = (cell.y + halfCellH).toFixed(2);
        const op = cell.opacity.toFixed(3);
        const escapedChar = this.escapeXml(cell.char);

        // Elemento principal
        textElements += `<text x="${posX}" y="${posY}" fill="${inkColor}" fill-opacity="${op}">${escapedChar}</text>\n`;

        // Sobreimpresión mecánica
        if (cell.overprintCount > 0) {
          const offX1 = (cell.x + halfCellW + 0.35).toFixed(2);
          const offY1 = (cell.y + halfCellH + 0.2).toFixed(2);
          const opOver = (cell.opacity * 0.8).toFixed(3);
          textElements += `<text x="${offX1}" y="${offY1}" fill="${inkColor}" fill-opacity="${opOver}">${escapedChar}</text>\n`;

          if (cell.overprintCount > 1) {
            const offX2 = (cell.x + halfCellW - 0.25).toFixed(2);
            const offY2 = (cell.y + halfCellH + 0.35).toFixed(2);
            textElements += `<text x="${offX2}" y="${offY2}" fill="${inkColor}" fill-opacity="${opOver}">${escapedChar}</text>\n`;
          }
        }
      }
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${totalHeight}" width="${totalWidth}" height="${totalHeight}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&amp;family=JetBrains+Mono:wght@400;700&amp;family=Roboto+Mono:wght@400;700&amp;display=swap');
      text {
        font-family: '${config.fontFamily}', 'Courier Prime', monospace;
        font-size: ${fontSize}px;
        text-anchor: middle;
        dominant-baseline: central;
      }
    </style>
  </defs>
  <!-- Fondo de Papel -->
  <rect width="100%" height="100%" fill="${bgFill}"/>
  
  <!-- Letrato: Retrato hecho con texto -->
  <g id="letrato-glyphs">
${textElements}  </g>
</svg>`;

    return svg;
  }

  /**
   * Descarga el SVG directamente en el navegador del usuario.
   */
  public downloadSvg(matrix: ProcessedMatrix, filename: string = 'letrato.svg'): void {
    const svgCode = this.generateSvg(matrix);
    const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  private escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
