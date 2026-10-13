export type LetratoMode = 'tosco' | 'letrato' | 'typewriter' | 'contorno';

export type PaperTheme = 'white' | 'sepia' | 'dark' | 'cream';

export type ExportResolution = '1x' | '2x' | '4x';

export type CropFormat = 'original' | 'square' | 'vertical';

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
  cropFormat: CropFormat; // 'original' | 'square' (1:1) | 'vertical' (3:4)
  showReadableText: boolean; // Si true, añade al pie la ficha con la fecha y el campo de texto legible
  subjectName: string; // Nombre o título en la ficha (ej. Flora Stacey)
  subjectDate: string; // Fecha en la ficha (ej. 1898)
  columns: number; // 40 - 260
  brightness: number; // -100 a 100 (0 por defecto)
  contrast: number; // -100 a 100 (20 por defecto)
  gamma: number; // 0.2 a 3.0 (1.0 por defecto)
  edgeEnhancement: number; // 0 a 100 (realce de bordes con Sobel)
  invert: boolean; // Invierte luminancia
  minLegibility: number; // 0.0 a 0.5 (opacidad base en sombras suaves)
  charAspectRatio: number; // Ancho / Alto del carácter monoespaciado (default 0.6)
  fontFamily: string; // 'Courier Prime', 'Roboto Mono', 'JetBrains Mono'
  customText: string; // Historia para el Letrato
  asciiRamp: string; // Rampa para el modo Tosco
  paperTheme: PaperTheme; // Color de fondo del lienzo
  overprintStrength: number; // Para modo Máquina de escribir (1 a 4 pasadas)
  caseTransform: 'original' | 'uppercase' | 'lowercase';
  ignoreWhitespace: boolean; // Si true, solo usa letras visibles en el flujo

  // PARÁMETROS CRÍTICOS PARA RECONOCIMIENTO FACIAL Y DIBUJOS A LÁPIZ
  autoLevels: boolean; // Normalización adaptativa de histograma (evita quemar/oscurecer bocetos)
  lineSensitivity: number; // 0 a 100 (Min-pooling para preservar ojos, labios y trazos de 1px)
  backgroundCutoff: number; // 0 a 50 (Umbral de corte de papel limpio: recorta la silueta)
  variableWeight: boolean; // Modulación de grosor (Regular / Bold / Black en sombras)
  pauseTextOnWhitespace: boolean; // El texto fluye de forma continua sin fracturarse por espacios

  // Parámetros específicos para Modo Contorno / Caligrama
  contourThreshold: number; // 5 a 60 (sensibilidad de detección de bordes, default 18)
  contourMinLength: number; // 10 a 150 px (elimina trazos ruidosos, default 20)
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
  fontWeight?: string | number; // '400', '700', '900'
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
  subjectName: string;
  subjectDate: string;
  author: string;
  summary: string;
  text: string;
  sampleImageUrl?: string;
}
