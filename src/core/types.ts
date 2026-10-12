export type LetratoMode = 'tosco' | 'letrato' | 'typewriter' | 'contorno';

export type PaperTheme = 'white' | 'sepia' | 'dark' | 'cream';

export type ExportResolution = '1x' | '2x' | '4x';

export interface Point2D {
  x: number;
  y: number;
}

export interface ContourPath {
  id: string;
  points: Point2D[];
  length: number;
  darkness: number; // 0 (claro) a 1 (oscuro)
  isHatching?: boolean;
}

export interface PlacedGlyph {
  char: string;
  x: number;
  y: number;
  angle: number; // Radianes
  opacity: number;
  fontSize: number;
}

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
  // Parámetros específicos para Modo Contorno / Caligrama
  contourThreshold: number; // 10 a 80 (sensibilidad de detección de bordes, default 35)
  contourMinLength: number; // 15 a 150 px (elimina trazos ruidosos, default 30)
  contourFontSize: number; // 7 a 20 px (tamaño de letra sobre la curva, default 11)
  contourDensity: number; // 1 a 5 (densidad de muestreo de bordes, default 2)
  contourHatching: boolean; // Si true, añade líneas de texto en zonas de sombra profunda
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
  cells: CellRenderData[][]; // [row][col] (para modos matriciales)
  luminanceMap: Float32Array; // Array lineal para cálculos rápidos
  config: LetratoConfig;
  // Para Modo Contorno / Caligrama
  contourPaths?: ContourPath[];
  contourGlyphs?: PlacedGlyph[];
}

export interface PresetStory {
  id: string;
  title: string;
  author: string;
  summary: string;
  text: string;
  sampleImageUrl?: string;
}
