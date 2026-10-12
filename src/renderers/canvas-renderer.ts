import type { PaperTheme, ProcessedMatrix } from '../core/types';

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
   * Renderiza la matriz en el canvas principal aplicando el tema de papel y el estado del viewport.
   */
  public render(
    matrix: ProcessedMatrix,
    viewport: ViewportState,
    containerWidth: number,
    containerHeight: number
  ): void {
    const { config } = matrix;
    const dpr = window.devicePixelRatio || 1;

    // Ajustar resolución física del canvas para nitidez HiDPI
    const width = containerWidth;
    const height = containerHeight;

    if (this.canvas.width !== width * dpr || this.canvas.height !== height * dpr) {
      this.canvas.width = width * dpr;
      this.canvas.height = height * dpr;
    }

    this.ctx.save();
    this.ctx.scale(dpr, dpr);

    // Fondo según tema
    this.drawBackground(width, height, config.paperTheme);

    // Aplicar transformación de Pan & Zoom
    this.ctx.save();
    this.ctx.translate(viewport.panX, viewport.panY);
    this.ctx.scale(viewport.zoom, viewport.zoom);

    // Dibujar el Letrato
    this.drawMatrixContent(this.ctx, matrix);

    this.ctx.restore();

    // Dibujar Lupa flotante interactiva si está activa
    if (viewport.showMagnifier) {
      this.drawMagnifier(matrix, viewport);
    }

    this.ctx.restore();
  }

  /**
   * Dibuja los caracteres en el contexto dado.
   */
  public drawMatrixContent(
    targetCtx: CanvasRenderingContext2D,
    matrix: ProcessedMatrix,
    clipBounds?: { x: number; y: number; width: number; height: number }
  ): void {
    const { grid, cells, config } = matrix;
    const isDarkTheme = config.paperTheme === 'dark';

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
      return;
    }

    // Configuración tipográfica para modos matriciales
    const fontSize = grid.cellHeight * 0.95;
    targetCtx.font = `${fontSize}px ${config.fontFamily}, monospace`;
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
  }

  /**
   * Dibuja una lupa circular flotante para leer el texto en detalle en tiempo real.
   */
  private drawMagnifier(matrix: ProcessedMatrix, viewport: ViewportState): void {
    const { magnifierX, magnifierY, magnifierRadius, magnifierZoom } = viewport;
    const ctx = this.ctx;

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
    // Posición en el canvas original
    const originX = (magnifierX - viewport.panX) / viewport.zoom;
    const originY = (magnifierY - viewport.panY) / viewport.zoom;

    ctx.save();
    ctx.translate(magnifierX, magnifierY);
    ctx.scale(magnifierZoom, magnifierZoom);
    ctx.translate(-originX, -originY);

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
   * Dibuja el color y la textura del papel según el tema seleccionado.
   */
  public drawBackground(width: number, height: number, theme: PaperTheme): void {
    const ctx = this.ctx;
    switch (theme) {
      case 'white':
        ctx.fillStyle = '#ffffff';
        break;
      case 'sepia':
        ctx.fillStyle = '#f4ede2';
        break;
      case 'cream':
        ctx.fillStyle = '#fdfbf7';
        break;
      case 'dark':
        ctx.fillStyle = '#0f1115';
        break;
    }
    ctx.fillRect(0, 0, width, height);
  }
}
