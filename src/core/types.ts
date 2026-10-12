export type LetratoMode = 'tosco' | 'letrato' | 'typewriter';

export type PaperTheme = 'white' | 'sepia' | 'dark' | 'cream';

export type ExportResolution = '1x' | '2x' | '4x';

export interface LetratoConfig {
  mode: LetratoMode;
  columns: number; // 40 - 260
  brightness: number; // -100 a 100 (0 por defecto)
  contrast: number; // -100 a 100 (20 por defecto)
  gamma: number; // 0.2 a 3.0 (1.0 por defecto)
  edgeEnhancement: number; // 0 a 100 (realce de bordes con Sobel)
  invert: boolean; // Invierte luminancia
  minLegibility: number; // 0.05 a 0.5 (opacidad mínima en zonas claras, default 0.18)
  charAspectRatio: number; // Ancho / Alto del carácter monoespaciado (default 0.6)
  fontFamily: string; // 'Courier Prime', 'Roboto Mono', 'JetBrains Mono'
  customText: string; // Historia para el Letrato
  asciiRamp: string; // Rampa para el modo Tosco
  paperTheme: PaperTheme; // Color de fondo del lienzo
  overprintStrength: number; // Para modo Máquina de escribir (1 a 4 pasadas)
  caseTransform: 'original' | 'uppercase' | 'lowercase';
  ignoreWhitespace: boolean; // Si true, solo usa letras visibles en el flujo
}

export interface GridDimensions {
  columns: number;
  rows: number;
  cellWidth: number;
  cellHeight: number;
  totalWidth: number;
  totalHeight: number;
}

export interface CellRenderData {
  char: string;
  x: number;
  y: number;
  luminance: number; // 0 (negro) a 1 (blanco)
  opacity: number; // 0 a 1
  overprintCount: number; // 0 para normal, 1-3 para sobreimpresión
  edgeStrength?: number;
}

export interface ProcessedMatrix {
  grid: GridDimensions;
  cells: CellRenderData[][]; // [row][col]
  luminanceMap: Float32Array; // Array lineal para cálculos rápidos
  config: LetratoConfig;
}

export interface PresetStory {
  id: string;
  title: string;
  author: string;
  summary: string;
  text: string;
  sampleImageUrl?: string;
}
