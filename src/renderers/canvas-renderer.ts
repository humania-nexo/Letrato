import type { PaperTheme, ProcessedMatrix } from '../core/types';
import { computeCardLayout } from '../core/card-layout';
import type { CardLayoutMetrics } from '../core/card-layout';

export interface ViewportState {
  zoom: number;
  panX: number;
  panY: number;
  showMagnifier: boolean;
  magnifierX: number;
  magnifierY: number;
  magnifierRadius: number;
  magnifierZoom: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('No se pudo obtener el contexto 2D para CanvasRenderer');
    }
    this.ctx = context;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Renderiza la matriz en el canvas principal aplicando el tema de papel, encuadre y ficha legible.
   */
  public render(
    matrix: ProcessedMatrix,
    viewport: ViewportState,
    containerWidth: number,
    containerHeight: number
  ): void {
    const { config } = matrix;
    const dpr = window.devicePixelRatio || 1;
    const layout = computeCardLayout(matrix);

    // Ajustar resolución física del canvas para nitidez HiDPI
    const width = containerWidth;
    const height = containerHeight;

    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    // Mesa de trabajo oscura alrededor de la hoja de papel para distinguir formato Cuadrado vs Vertical
    this.ctx.fillStyle = '#0d0f14';
    this.ctx.fillRect(0, 0, width, height);

    // Aplicar transformación de Pan & Zoom
    this.ctx.save();
    this.ctx.translate(viewport.panX, viewport.panY);
    this.ctx.scale(viewport.zoom, viewport.zoom);

    // Sombra de la hoja de papel sobre la mesa
    this.ctx.save();
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    this.ctx.shadowBlur = 24;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 8;
    this.drawBackground(layout.totalDocWidth, layout.totalDocHeight, config.paperTheme, this.ctx);
    this.ctx.restore();

    // Dibujar el Letrato y, si está activa, la Ficha con Fecha y Texto Legible
    this.drawMatrixContent(this.ctx, matrix);

    this.ctx.restore();

    // Dibujar Lupa flotante interactiva si está activa
    if (viewport.showMagnifier) {
      this.drawMagnifier(matrix, viewport);
    }

    this.ctx.restore();
  }

  /**
   * Dibuja los caracteres del Letrato y la Ficha inferior (si showReadableText está activo) en el contexto dado.
   */
  public drawMatrixContent(
    targetCtx: CanvasRenderingContext2D,
    matrix: ProcessedMatrix,
    clipBounds?: { x: number; y: number; width: number; height: number }
  ): void {
    const { grid, cells, config } = matrix;
    const isDarkTheme = config.paperTheme === 'dark';
    const layout = computeCardLayout(matrix);

    // Color base de tinta
    const inkBase = isDarkTheme ? '255, 255, 255' : '17, 17, 17';

    // RENDERIZADO PARA MODO CONTORNO / CALIGRAMA
    if (config.mode === 'contorno' && matrix.contourGlyphs) {
      targetCtx.textAlign = 'center';
      targetCtx.textBaseline = 'middle';

      for (const g of matrix.contourGlyphs) {
        if (clipBounds) {
          if (
            g.x < clipBounds.x - 20 ||
            g.x > clipBounds.x + clipBounds.width + 20 ||
            g.y < clipBounds.y - 20 ||
            g.y > clipBounds.y + clipBounds.height + 20
          ) {
            continue;
          }
        }

        targetCtx.save();
        targetCtx.translate(g.x, g.y);
        targetCtx.rotate(g.angle);
        targetCtx.font = `${g.fontSize}px ${config.fontFamily}, monospace`;
        targetCtx.fillStyle = `rgba(${inkBase}, ${g.opacity})`;
        targetCtx.fillText(g.char, 0, 0);
        targetCtx.restore();
      }

      if (layout.enabled) {
        this.drawReadableCard(targetCtx, matrix, layout, inkBase, isDarkTheme);
      }
      return;
    }

    // Configuración tipográfica para modos matriciales
    const baseFontSize = grid.cellHeight * 0.95;
    let currentFontSpec = '';
    targetCtx.textAlign = 'center';
    targetCtx.textBaseline = 'middle';

    const halfCellW = grid.cellWidth / 2;
    const halfCellH = grid.cellHeight / 2;

    const startRow = clipBounds ? Math.max(0, Math.floor(clipBounds.y / grid.cellHeight)) : 0;
    const endRow = clipBounds
      ? Math.min(grid.rows, Math.ceil((clipBounds.y + clipBounds.height) / grid.cellHeight))
      : grid.rows;

    const startCol = clipBounds ? Math.max(0, Math.floor(clipBounds.x / grid.cellWidth)) : 0;
    const endCol = clipBounds
      ? Math.min(grid.columns, Math.ceil((clipBounds.x + clipBounds.width) / grid.cellWidth))
      : grid.columns;

    for (let r = startRow; r < endRow; r++) {
      const row = cells[r];
      for (let c = startCol; c < endCol; c++) {
        const cell = row[c];
        if (!cell.char || cell.char === ' ' || cell.opacity <= 0.01) {
          continue;
        }

        const posX = cell.x + halfCellW;
        const posY = cell.y + halfCellH;

        // Modulación de grosor y escala de fuente para micro-rasgos y sombras densas
        const weight = String(cell.fontWeight || '400');
        const scaledSize = (baseFontSize * (cell.fontScale || 1.0)).toFixed(1);
        const fontSpec = `${weight} ${scaledSize}px ${config.fontFamily}, monospace`;
        if (fontSpec !== currentFontSpec) {
          currentFontSpec = fontSpec;
          targetCtx.font = fontSpec;
        }

        targetCtx.fillStyle = `rgba(${inkBase}, ${cell.opacity})`;
        targetCtx.fillText(cell.char, posX, posY);

        // Sobreimpresión mecánica analógica (Modo máquina de escribir o énfasis)
        if (cell.overprintCount > 0) {
          targetCtx.fillStyle = `rgba(${inkBase}, ${cell.opacity * 0.8})`;
          // Micro-desplazamiento subpíxel para efecto cinta de tinta
          targetCtx.fillText(cell.char, posX + 0.35, posY + 0.2);
          if (cell.overprintCount > 1) {
            targetCtx.fillText(cell.char, posX - 0.25, posY + 0.35);
          }
          if (cell.overprintCount > 2) {
            targetCtx.fillText(cell.char, posX + 0.1, posY - 0.25);
          }
        }
      }
    }

    // Dibujar la Ficha inferior con Fecha y Campo de Texto Legible si está habilitada
    if (layout.enabled) {
      this.drawReadableCard(targetCtx, matrix, layout, inkBase, isDarkTheme);
    }
  }

  /**
   * Dibuja la Ficha documental al pie del Letrato: Línea divisoria, Nombre, Fecha y Campo de Texto Legible.
   */
  private drawReadableCard(
    targetCtx: CanvasRenderingContext2D,
    matrix: ProcessedMatrix,
    layout: CardLayoutMetrics,
    inkBase: string,
    isDarkTheme: boolean
  ): void {
    const { config } = matrix;
    const W = layout.totalDocWidth;

    targetCtx.save();

    // 1. Línea divisoria superior
    targetCtx.strokeStyle = `rgba(${inkBase}, 0.28)`;
    targetCtx.lineWidth = 1;
    targetCtx.beginPath();
    targetCtx.moveTo(layout.paddingX, layout.dividerY);
    targetCtx.lineTo(W - layout.paddingX, layout.dividerY);
    targetCtx.stroke();

    // 2. Cabecera: Nombre / Sujeto a la izquierda y Fecha a la derecha
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.textAlign = 'left';
    targetCtx.font = `700 ${layout.headerFontSize}px ${config.fontFamily}, monospace`;
    targetCtx.fillStyle = `rgba(${inkBase}, 0.92)`;
    targetCtx.fillText(layout.subjectLabel, layout.paddingX, layout.headerY);

    if (layout.dateLabel) {
      targetCtx.textAlign = 'right';
      targetCtx.font = `400 ${Math.round(layout.headerFontSize * 0.86)}px ${config.fontFamily}, monospace`;
      targetCtx.fillStyle = `rgba(${inkBase}, 0.75)`;
      targetCtx.fillText(layout.dateLabel, W - layout.paddingX, layout.headerY);
    }

    // 3. Campo recuadrado para el texto legible
    targetCtx.fillStyle = isDarkTheme ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.022)';
    targetCtx.fillRect(layout.boxX, layout.boxY, layout.boxWidth, layout.boxHeight);

    targetCtx.strokeStyle = `rgba(${inkBase}, 0.24)`;
    targetCtx.lineWidth = 1;
    targetCtx.strokeRect(layout.boxX, layout.boxY, layout.boxWidth, layout.boxHeight);

    // 4. Párrafo del texto legible línea por línea
    targetCtx.textAlign = 'left';
    targetCtx.textBaseline = 'alphabetic';
    targetCtx.font = `400 ${layout.bodyFontSize}px ${config.fontFamily}, monospace`;
    targetCtx.fillStyle = `rgba(${inkBase}, 0.88)`;

    for (let i = 0; i < layout.wrappedLines.length; i++) {
      const lineY = layout.textStartY + i * layout.lineHeight;
      targetCtx.fillText(layout.wrappedLines[i], layout.textStartX, lineY);
    }

    // 5. Pie de ficha (registro DinastIA)
    const sigFontSize = Math.max(8, Math.round(layout.bodyFontSize * 0.72));
    targetCtx.font = `400 ${sigFontSize}px ${config.fontFamily}, monospace`;
    targetCtx.fillStyle = `rgba(${inkBase}, 0.5)`;
    targetCtx.textAlign = 'left';
    targetCtx.fillText('LETRATO · EL MANUSCRITO DE CENIZA', layout.paddingX, layout.footerSignatureY);
    targetCtx.textAlign = 'right';
    targetCtx.fillText('DINASTIA(TM) · SAPIENSIA CLAN', W - layout.paddingX, layout.footerSignatureY);

    targetCtx.restore();
  }

  /**
   * Dibuja una lupa circular flotante para leer el texto en detalle en tiempo real.
   */
  private drawMagnifier(matrix: ProcessedMatrix, viewport: ViewportState): void {
    const { magnifierX, magnifierY, magnifierRadius, magnifierZoom } = viewport;
    const ctx = this.ctx;
    const layout = computeCardLayout(matrix);

    ctx.save();

    // Área circular recortada
    ctx.beginPath();
    ctx.arc(magnifierX, magnifierY, magnifierRadius, 0, Math.PI * 2);
    ctx.clip();

    // Fondo de la lupa (ligeramente resaltado)
    ctx.fillStyle = matrix.config.paperTheme === 'dark' ? '#141414' : '#faf8f5';
    ctx.fillRect(
      magnifierX - magnifierRadius,
      magnifierY - magnifierRadius,
      magnifierRadius * 2,
      magnifierRadius * 2
    );

    // Calcular coordenadas centradas en el punto de inspección
    const originX = (magnifierX - viewport.panX) / viewport.zoom;
    const originY = (magnifierY - viewport.panY) / viewport.zoom;

    ctx.save();
    ctx.translate(magnifierX, magnifierY);
    ctx.scale(magnifierZoom, magnifierZoom);
    ctx.translate(-originX, -originY);

    // Fondo de la hoja dentro de la lupa
    this.drawBackground(layout.totalDocWidth, layout.totalDocHeight, matrix.config.paperTheme, ctx);

    // Dibujar el contenido magnificado
    this.drawMatrixContent(ctx, matrix);

    ctx.restore();

    // Restaurar clip y dibujar el aro metálico/editorial de la lupa
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.arc(magnifierX, magnifierY, magnifierRadius, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#c5a059'; // Acento dorado/latón
    ctx.stroke();

    // Sombra del borde
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.stroke();

    // Pequeño indicador central sutil
    ctx.fillStyle = 'rgba(197, 160, 89, 0.7)';
    ctx.beginPath();
    ctx.arc(magnifierX, magnifierY, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Dibuja el color del papel según el tema seleccionado en el contexto indicado.
   */
  public drawBackground(
    width: number,
    height: number,
    theme: PaperTheme,
    targetCtx: CanvasRenderingContext2D = this.ctx
  ): void {
    switch (theme) {
      case 'white':
        targetCtx.fillStyle = '#ffffff';
        break;
      case 'sepia':
        targetCtx.fillStyle = '#f4ede2';
        break;
      case 'cream':
        targetCtx.fillStyle = '#fdfbf7';
        break;
      case 'dark':
        targetCtx.fillStyle = '#0f1115';
        break;
    }
    targetCtx.fillRect(0, 0, width, height);
  }
}
