import type { CropFormat, ProcessedMatrix } from './types';

export interface CropRegion {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  targetWidth: number;
  targetHeight: number;
}

export interface CardLayoutMetrics {
  enabled: boolean;
  totalDocWidth: number;
  totalDocHeight: number;
  cardStartY: number;
  cardHeight: number;
  paddingX: number;
  dividerY: number;
  headerY: number;
  headerFontSize: number;
  subjectLabel: string;
  dateLabel: string;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  textStartX: number;
  textStartY: number;
  bodyFontSize: number;
  lineHeight: number;
  wrappedLines: string[];
  footerSignatureY: number;
}

/**
 * Calcula la región de recorte (crop) en función del formato elegido:
 * - 'square': Cuadrada 1:1
 * - 'vertical': Vertical Retrato 3:4
 * - 'original': Proporción nativa de la imagen
 */
export function getCropRegion(
  imgWidth: number,
  imgHeight: number,
  cropFormat: CropFormat
): CropRegion {
  const w = Math.max(1, imgWidth);
  const h = Math.max(1, imgHeight);

  if (cropFormat === 'square') {
    const side = Math.min(w, h);
    const sx = Math.round((w - side) / 2);
    // En fotos verticales priorizamos ligeramente el tercio superior donde se ubica el rostro
    const sy = Math.round((h - side) * 0.35);
    return {
      sx,
      sy,
      sw: side,
      sh: side,
      targetWidth: 800,
      targetHeight: 800
    };
  }

  if (cropFormat === 'vertical') {
    const targetAspect = 3 / 4; // 0.75 (Formato retrato vertical clásico)
    const currentAspect = w / h;

    if (currentAspect > targetAspect) {
      // Imagen más ancha que 3:4 -> recortar laterales
      const sw = Math.round(h * targetAspect);
      const sh = h;
      const sx = Math.round((w - sw) / 2);
      return {
        sx,
        sy: 0,
        sw,
        sh,
        targetWidth: 750,
        targetHeight: 1000
      };
    } else {
      // Imagen más alta que 3:4 -> recortar arriba/abajo priorizando rostro
      const sw = w;
      const sh = Math.round(w / targetAspect);
      const sy = Math.round((h - sh) * 0.35);
      return {
        sx: 0,
        sy,
        sw,
        sh,
        targetWidth: 750,
        targetHeight: 1000
      };
    }
  }

  const maxDim = 850;
  let targetWidth = w;
  let targetHeight = h;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    targetWidth = Math.round(w * scale);
    targetHeight = Math.round(h * scale);
  }

  return {
    sx: 0,
    sy: 0,
    sw: w,
    sh: h,
    targetWidth,
    targetHeight
  };
}

/**
 * Normaliza caracteres especiales para fuentes monoespaciadas.
 */
function sanitizeMonospaceText(str: string): string {
  return (str || '')
    .replace(/™/g, '(TM)')
    .replace(/\bDinastIAT\b/g, 'DinastIA(TM)')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Divide un texto en líneas que caben en maxCharsPerLine respetando palabras completas.
 */
function wrapMonospaceText(text: string, maxCharsPerLine: number, maxLines: number = 14): string[] {
  const clean = sanitizeMonospaceText(text);
  if (!clean) {
    return ['—'];
  }

  const words = clean.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + 1 + word.length <= maxCharsPerLine) {
      currentLine += ' ' + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
      if (lines.length >= maxLines) {
        break;
      }
    }
  }

  if (currentLine && lines.length < maxLines) {
    lines.push(currentLine);
  } else if (lines.length === maxLines && currentLine) {
    // Indicar continuación con puntos suspensivos si el texto era muy extenso
    const lastIdx = lines.length - 1;
    if (lines[lastIdx].length > maxCharsPerLine - 3) {
      lines[lastIdx] = lines[lastIdx].slice(0, maxCharsPerLine - 3) + '...';
    } else {
      lines[lastIdx] += '...';
    }
  }

  return lines;
}

/**
 * Calcula las dimensiones y coordenadas exactas de la Ficha inferior (Fecha + Campo con texto legible).
 */
export function computeCardLayout(matrix: ProcessedMatrix): CardLayoutMetrics {
  const { grid, config } = matrix;
  const W = grid.totalWidth;
  const H = grid.totalHeight;

  if (!config.showReadableText) {
    return {
      enabled: false,
      totalDocWidth: W,
      totalDocHeight: H,
      cardStartY: H,
      cardHeight: 0,
      paddingX: 0,
      dividerY: H,
      headerY: H,
      headerFontSize: 12,
      subjectLabel: '',
      dateLabel: '',
      boxX: 0,
      boxY: H,
      boxWidth: 0,
      boxHeight: 0,
      textStartX: 0,
      textStartY: H,
      bodyFontSize: 11,
      lineHeight: 16,
      wrappedLines: [],
      footerSignatureY: H
    };
  }

  const paddingX = Math.max(20, Math.round(W * 0.055));
  const innerWidth = W - paddingX * 2;

  const dividerY = H + Math.max(12, Math.round(W * 0.02));
  const headerFontSize = Math.max(11, Math.round(W * 0.021));
  const headerY = dividerY + Math.max(22, Math.round(W * 0.036));

  const subjectClean = sanitizeMonospaceText(config.subjectName || 'ARCHIVO LETRATO').toUpperCase();
  const dateClean = sanitizeMonospaceText(config.subjectDate || new Date().toLocaleDateString('es-ES'));

  const subjectLabel = subjectClean;
  const dateLabel = dateClean ? `FECHA: ${dateClean}` : '';

  const boxX = paddingX;
  const boxY = headerY + Math.max(12, Math.round(W * 0.018));
  const boxWidth = innerWidth;

  const boxPadX = Math.max(12, Math.round(W * 0.025));
  const boxPadY = Math.max(12, Math.round(W * 0.022));

  const bodyFontSize = Math.max(9.5, Math.round(W * 0.0155 * 10) / 10);
  const lineHeight = Math.round(bodyFontSize * 1.55);

  // En fuente monoespaciada el ancho promedio por carácter es ~0.602 * fontSize
  const usableTextWidth = boxWidth - boxPadX * 2;
  const maxCharsPerLine = Math.max(28, Math.floor(usableTextWidth / (bodyFontSize * 0.605)));

  const wrappedLines = wrapMonospaceText(config.customText, maxCharsPerLine, 12);

  const boxHeight = wrappedLines.length * lineHeight + boxPadY * 2;
  const textStartX = boxX + boxPadX;
  const textStartY = boxY + boxPadY + bodyFontSize * 0.82;

  const footerSignatureY = boxY + boxHeight + Math.max(16, Math.round(W * 0.024));
  const bottomMargin = Math.max(16, Math.round(W * 0.026));

  const totalDocHeight = footerSignatureY + bottomMargin;
  const cardHeight = totalDocHeight - H;

  return {
    enabled: true,
    totalDocWidth: W,
    totalDocHeight,
    cardStartY: H,
    cardHeight,
    paddingX,
    dividerY,
    headerY,
    headerFontSize,
    subjectLabel,
    dateLabel,
    boxX,
    boxY,
    boxWidth,
    boxHeight,
    textStartX,
    textStartY,
    bodyFontSize,
    lineHeight,
    wrappedLines,
    footerSignatureY
  };
}
