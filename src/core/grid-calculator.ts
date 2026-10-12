import type { GridDimensions } from './types';

/**
 * Calcula las dimensiones y la cuadrícula de caracteres respetando
 * la relación de aspecto del glifo tipográfico monoespaciado.
 *
 * En fuentes monoespaciadas clásicas (como Courier Prime), un carácter
 * tiene un ancho aproximado de 0.6 veces su altura (relación 3:5 o 0.6:1).
 * Para que la imagen no se estire ni se aplaste verticalmente:
 * Filas = Columnas * (alto_imagen / ancho_imagen) * charAspectRatio.
 */
export function calculateGridDimensions(
  imageWidth: number,
  imageHeight: number,
  columns: number,
  charAspectRatio: number = 0.6
): GridDimensions {
  const safeColumns = Math.max(20, Math.min(300, Math.round(columns)));
  const imageAspect = imageHeight / imageWidth;

  // Filas requeridas para compensar la altura del glifo
  const rows = Math.max(10, Math.round(safeColumns * imageAspect * charAspectRatio));

  // Dimensiones lógicas de cada celda
  const cellWidth = imageWidth / safeColumns;
  const cellHeight = imageHeight / rows;

  return {
    columns: safeColumns,
    rows,
    cellWidth,
    cellHeight,
    totalWidth: imageWidth,
    totalHeight: imageHeight
  };
}
