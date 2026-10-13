import type { PaperTheme, ProcessedMatrix } from '../core/types';
import { computeCardLayout } from '../core/card-layout';

export class SvgRenderer {
  /**
   * Genera el código XML del SVG vectorial puro a partir de la matriz procesada.
   */
  public generateSvg(matrix: ProcessedMatrix): string {
    const { grid, cells, config } = matrix;
    const { cellWidth, cellHeight, columns, rows } = grid;
    const layout = computeCardLayout(matrix);

    const bgFill =
      config.paperTheme === 'white'
        ? '#ffffff'
        : config.paperTheme === 'sepia'
        ? '#f4ede2'
        : config.paperTheme === 'cream'
        ? '#fdfbf7'
        : '#0f1115';

    const defaultFontSize = (cellHeight * 0.95).toFixed(2);
    let textElements = '';

    // RENDERIZADO VECTORIAL PARA MODO CONTORNO CON GRIS REAL
    if (config.mode === 'contorno' && matrix.contourGlyphs) {
      for (const g of matrix.contourGlyphs) {
        const deg = ((g.angle * 180) / Math.PI).toFixed(1);
        const posX = g.x.toFixed(2);
        const posY = g.y.toFixed(2);
        const solidColor = this.getSolidGrayscaleColor(g.opacity, config.paperTheme);
        const escapedChar = this.escapeXml(g.char);

        textElements += `<text transform="translate(${posX}, ${posY}) rotate(${deg})" font-size="${g.fontSize}px" fill="${solidColor}">${escapedChar}</text>\n`;
      }
    } else {
      const baseFontSize = cellHeight * 0.95;
      const halfCellW = cellWidth / 2;
      const halfCellH = cellHeight / 2;

      for (let r = 0; r < rows; r++) {
        const row = cells[r];
        if (!row) continue;
        for (let c = 0; c < columns; c++) {
          const cell = row[c];
          if (!cell || !cell.char || cell.char === ' ' || cell.opacity <= 0.01) {
            continue;
          }

          const fontSize = (baseFontSize * (cell.fontScale || 1.0)).toFixed(2);
          const posX = (cell.x + halfCellW).toFixed(2);
          const posY = (cell.y + halfCellH).toFixed(2);
          const solidColor = this.getSolidGrayscaleColor(cell.opacity, config.paperTheme);
          const escapedChar = this.escapeXml(cell.char);

          // Elemento principal con tono de gris directo (sin transparencias para imprenta perfecta)
          const weight = cell.fontWeight || 400;
          textElements += `<text x="${posX}" y="${posY}" font-size="${fontSize}px" font-weight="${weight}" fill="${solidColor}">${escapedChar}</text>\n`;

          // Sobreimpresión mecánica
          if (cell.overprintCount > 0) {
            const offX1 = (cell.x + halfCellW + 0.35).toFixed(2);
            const offY1 = (cell.y + halfCellH + 0.2).toFixed(2);
            const solidOver1 = this.getSolidGrayscaleColor(cell.opacity * 0.85, config.paperTheme);
            textElements += `<text x="${offX1}" y="${offY1}" font-size="${fontSize}px" font-weight="${weight}" fill="${solidOver1}">${escapedChar}</text>\n`;

            if (cell.overprintCount > 1) {
              const offX2 = (cell.x + halfCellW - 0.25).toFixed(2);
              const offY2 = (cell.y + halfCellH + 0.35).toFixed(2);
              textElements += `<text x="${offX2}" y="${offY2}" font-size="${fontSize}px" font-weight="${weight}" fill="${solidOver1}">${escapedChar}</text>\n`;
            }
          }
        }
      }
    }

    // FICHA DOCUMENTAL INFERIOR (FECHA + CAMPO DE TEXTO LEGIBLE)
    let cardElements = '';
    if (layout.enabled) {
      const W = layout.totalDocWidth;
      const ruleColor = this.getSolidGrayscaleColor(0.28, config.paperTheme);
      const boxFillColor = this.getSolidGrayscaleColor(0.03, config.paperTheme);
      const titleColor = this.getSolidGrayscaleColor(0.92, config.paperTheme);
      const dateColor = this.getSolidGrayscaleColor(0.75, config.paperTheme);
      const bodyColor = this.getSolidGrayscaleColor(0.88, config.paperTheme);
      const sigColor = this.getSolidGrayscaleColor(0.5, config.paperTheme);

      cardElements += `  <!-- Ficha Documental con Fecha y Campo de Texto Legible -->\n`;
      cardElements += `  <g id="letrato-ficha">\n`;
      cardElements += `    <line x1="${layout.paddingX}" y1="${layout.dividerY}" x2="${W - layout.paddingX}" y2="${layout.dividerY}" stroke="${ruleColor}" stroke-width="1"/>\n`;
      cardElements += `    <text x="${layout.paddingX}" y="${layout.headerY}" font-size="${layout.headerFontSize}px" font-weight="700" text-anchor="start" dominant-baseline="alphabetic" fill="${titleColor}">${this.escapeXml(layout.subjectLabel)}</text>\n`;

      if (layout.dateLabel) {
        const dateFontSize = Math.round(layout.headerFontSize * 0.86);
        cardElements += `    <text x="${W - layout.paddingX}" y="${layout.headerY}" font-size="${dateFontSize}px" font-weight="400" text-anchor="end" dominant-baseline="alphabetic" fill="${dateColor}">${this.escapeXml(layout.dateLabel)}</text>\n`;
      }

      cardElements += `    <rect x="${layout.boxX}" y="${layout.boxY}" width="${layout.boxWidth}" height="${layout.boxHeight}" fill="${boxFillColor}" stroke="${ruleColor}" stroke-width="1"/>\n`;

      for (let i = 0; i < layout.wrappedLines.length; i++) {
        const lineY = (layout.textStartY + i * layout.lineHeight).toFixed(2);
        cardElements += `    <text x="${layout.textStartX}" y="${lineY}" font-size="${layout.bodyFontSize}px" font-weight="400" text-anchor="start" dominant-baseline="alphabetic" fill="${bodyColor}">${this.escapeXml(layout.wrappedLines[i])}</text>\n`;
      }

      const sigFontSize = Math.max(8, Math.round(layout.bodyFontSize * 0.72));
      cardElements += `    <text x="${layout.paddingX}" y="${layout.footerSignatureY}" font-size="${sigFontSize}px" font-weight="400" text-anchor="start" dominant-baseline="alphabetic" fill="${sigColor}">LETRATO · EL MANUSCRITO DE CENIZA</text>\n`;
      cardElements += `    <text x="${W - layout.paddingX}" y="${layout.footerSignatureY}" font-size="${sigFontSize}px" font-weight="400" text-anchor="end" dominant-baseline="alphabetic" fill="${sigColor}">DINASTIA(TM) · SAPIENSIA CLAN</text>\n`;
      cardElements += `  </g>\n`;
    }

    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<!-- LETRATO · SAPIENSIA Clan · https://sapiensiaclan.com -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${layout.totalDocWidth} ${layout.totalDocHeight}" width="${layout.totalDocWidth}" height="${layout.totalDocHeight}">
  <defs>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&amp;family=JetBrains+Mono:wght@400;700&amp;family=Roboto+Mono:wght@400;700&amp;display=swap');
      text {
        font-family: '${config.fontFamily}', 'Courier Prime', 'Roboto Mono', monospace, sans-serif;
        font-size: ${defaultFontSize}px;
        text-anchor: middle;
        dominant-baseline: central;
      }
    </style>
  </defs>
  <!-- Fondo de Papel -->
  <rect width="100%" height="100%" fill="${bgFill}"/>
  
  <!-- Letrato: Retrato tipográfico en escala de grises real (DeviceGray) -->
  <g id="letrato-glyphs">
${textElements}  </g>
${cardElements}</svg>`;

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

  /**
   * Calcula el color opaco equivalente en escala de grises para reproducción perfecta en imprenta monocromática.
   */
  private getSolidGrayscaleColor(opacity: number, paperTheme: PaperTheme): string {
    const clamped = Math.max(0, Math.min(1, opacity));
    if (paperTheme === 'white') {
      const gray = Math.round(255 * (1.0 - clamped));
      return `rgb(${gray}, ${gray}, ${gray})`;
    } else if (paperTheme === 'dark') {
      const gray = Math.round(15 + clamped * 240);
      return `rgb(${gray}, ${gray}, ${gray})`;
    } else if (paperTheme === 'sepia') {
      const r = Math.round(244 * (1 - clamped) + 44 * clamped);
      const g = Math.round(237 * (1 - clamped) + 34 * clamped);
      const b = Math.round(226 * (1 - clamped) + 24 * clamped);
      return `rgb(${r}, ${g}, ${b})`;
    } else {
      const r = Math.round(253 * (1 - clamped) + 26 * clamped);
      const g = Math.round(251 * (1 - clamped) + 24 * clamped);
      const b = Math.round(247 * (1 - clamped) + 21 * clamped);
      return `rgb(${r}, ${g}, ${b})`;
    }
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
