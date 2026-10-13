import { calculateGridDimensions } from './core/grid-calculator';
import { computeCardLayout, getCropRegion } from './core/card-layout';
import { ImageProcessor } from './core/image-processor';
import { LetratoGenerator } from './core/generator';
import { ASCII_RAMPS, getSamplePortraitDataUrl, PRESET_STORIES } from './core/presets';
import type { CropFormat, LetratoConfig, LetratoMode, PaperTheme, ProcessedMatrix } from './core/types';
import { CanvasRenderer } from './renderers/canvas-renderer';
import type { ViewportState } from './renderers/canvas-renderer';
import { SvgRenderer } from './renderers/svg-renderer';
import { PdfRenderer } from './renderers/pdf-renderer';
import { ProjectStorage } from './storage/project-storage';

class LetratoApp {
  private config: LetratoConfig;
  private currentImage: HTMLImageElement | null = null;
  private currentMatrix: ProcessedMatrix | null = null;

  private imageProcessor: ImageProcessor;
  private generator: LetratoGenerator;
  private canvasRenderer: CanvasRenderer;
  private svgRenderer: SvgRenderer;
  private pdfRenderer: PdfRenderer;

  private viewport: ViewportState = {
    zoom: 1.0,
    panX: 0,
    panY: 0,
    showMagnifier: false,
    magnifierX: 0,
    magnifierY: 0,
    magnifierRadius: 90,
    magnifierZoom: 3.5
  };

  private isPanning: boolean = false;
  private startPanX: number = 0;
  private startPanY: number = 0;

  // Elementos del DOM
  private canvasEl!: HTMLCanvasElement;
  private viewportContainerEl!: HTMLElement;

  constructor() {
    this.config = {
      mode: 'letrato',
      cropFormat: 'vertical',
      showReadableText: true,
      subjectName: PRESET_STORIES[0].subjectName,
      subjectDate: PRESET_STORIES[0].subjectDate,
      columns: 125,
      brightness: 0,
      contrast: 25,
      gamma: 1.0,
      edgeEnhancement: 0,
      invert: false,
      minLegibility: 0.18,
      charAspectRatio: 0.6,
      fontFamily: 'Courier Prime',
      customText: PRESET_STORIES[0].text,
      asciiRamp: ASCII_RAMPS.clasica,
      paperTheme: 'white',
      overprintStrength: 2,
      caseTransform: 'original',
      ignoreWhitespace: false,

      // Parámetros de alta fidelidad para retratos y dibujos
      autoLevels: true,
      lineSensitivity: 65,
      microDetail: 75,
      subCellSnap: true,
      backgroundCutoff: 16,
      variableWeight: true,
      pauseTextOnWhitespace: true,

      // Modo Superposición (Estilo Leslie Nichols)
      superpositionMaxLayers: 5,
      superpositionAngleSpread: 65,
      superpositionInkDensity: 52,
      superpositionAiryLight: true,

      contourThreshold: 18,
      contourMinLength: 20,
      contourFontSize: 11,
      contourDensity: 2,
      contourHatching: true
    };

    this.imageProcessor = new ImageProcessor();
    this.generator = new LetratoGenerator();
    this.svgRenderer = new SvgRenderer();
    this.pdfRenderer = new PdfRenderer();

    // Referencias DOM
    this.canvasEl = document.getElementById('main-canvas') as HTMLCanvasElement;
    this.viewportContainerEl = document.getElementById('viewport-container') as HTMLElement;
    this.canvasRenderer = new CanvasRenderer(this.canvasEl);

    this.initUI();
    this.initCanvasInteractions();
    this.loadInitialData();
  }

  private initUI(): void {
    // 0. Selector de formato de encuadre (Cuadrada 1:1 / Vertical 3:4 / Original)
    const cropButtons = document.querySelectorAll<HTMLButtonElement>('.crop-format-btn');
    cropButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const crop = btn.dataset.crop as CropFormat;
        if (!crop) return;

        cropButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.config.cropFormat = crop;
        this.recompute(true);
      });
    });

    // 1. Selector de modo
    const modeButtons = document.querySelectorAll<HTMLButtonElement>('.mode-btn');
    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode as LetratoMode;
        if (!mode) return;

        modeButtons.forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        this.config.mode = mode;
        this.updateModeControlsVisibility();
        this.recompute();
      });
    });

    // 2. Sliders de ajuste de tono y resolución
    this.bindRangeInput('input-columns', 'val-columns', (val) => {
      this.config.columns = parseInt(val, 10);
      this.recompute();
    });

    this.bindRangeInput('input-contrast', 'val-contrast', (val) => {
      const num = parseInt(val, 10);
      this.config.contrast = num;
      this.recompute();
      return num > 0 ? `+${num}` : `${num}`;
    });

    this.bindRangeInput('input-brightness', 'val-brightness', (val) => {
      const num = parseInt(val, 10);
      this.config.brightness = num;
      this.recompute();
      return num > 0 ? `+${num}` : `${num}`;
    });

    this.bindRangeInput('input-gamma', 'val-gamma', (val) => {
      this.config.gamma = parseFloat(val);
      this.recompute();
    });

    this.bindRangeInput('input-edges', 'val-edges', (val) => {
      this.config.edgeEnhancement = parseInt(val, 10);
      this.recompute();
      return `${val}%`;
    });

    // Controles de fidelidad facial y micro-rasgos
    this.bindRangeInput('input-line-sens', 'val-line-sens', (val) => {
      this.config.lineSensitivity = parseInt(val, 10);
      this.recompute();
      return `${val}%`;
    });

    this.bindRangeInput('input-micro-detail', 'val-micro-detail', (val) => {
      this.config.microDetail = parseInt(val, 10);
      this.recompute();
      return `${val}%`;
    });

    this.bindRangeInput('input-bg-cutoff', 'val-bg-cutoff', (val) => {
      this.config.backgroundCutoff = parseInt(val, 10);
      this.recompute();
      return `${val}%`;
    });

    const autolevelsCheck = document.getElementById('check-autolevels') as HTMLInputElement;
    autolevelsCheck?.addEventListener('change', () => {
      this.config.autoLevels = autolevelsCheck.checked;
      this.recompute();
    });

    const subcellSnapCheck = document.getElementById('check-subcell-snap') as HTMLInputElement;
    subcellSnapCheck?.addEventListener('change', () => {
      this.config.subCellSnap = subcellSnapCheck.checked;
      this.recompute();
    });

    const varWeightCheck = document.getElementById('check-variable-weight') as HTMLInputElement;
    varWeightCheck?.addEventListener('change', () => {
      this.config.variableWeight = varWeightCheck.checked;
      this.recompute();
    });

    const pauseWhiteCheck = document.getElementById('check-pause-whitespace') as HTMLInputElement;
    pauseWhiteCheck?.addEventListener('change', () => {
      this.config.pauseTextOnWhitespace = pauseWhiteCheck.checked;
      this.recompute();
    });

    this.bindRangeInput('input-legibility', 'val-legibility', (val) => {
      this.config.minLegibility = parseFloat(val);
      this.recompute();
      return `${Math.round(this.config.minLegibility * 100)}%`;
    });

    this.bindRangeInput('input-overprint', 'val-overprint', (val) => {
      this.config.overprintStrength = parseInt(val, 10);
      this.recompute();
      return `${val} pasadas`;
    });

    // Controles específicos de Modo Superposición (Leslie Nichols)
    this.bindRangeInput('input-super-layers', 'val-super-layers', (val) => {
      this.config.superpositionMaxLayers = parseInt(val, 10);
      this.recompute();
      return `${val} capas`;
    });

    this.bindRangeInput('input-super-angle', 'val-super-angle', (val) => {
      this.config.superpositionAngleSpread = parseInt(val, 10);
      this.recompute();
      return `${val}%`;
    });

    this.bindRangeInput('input-super-ink', 'val-super-ink', (val) => {
      this.config.superpositionInkDensity = parseInt(val, 10);
      this.recompute();
      return `${val}%`;
    });

    const superAiryCheck = document.getElementById('check-super-airy') as HTMLInputElement;
    superAiryCheck?.addEventListener('change', () => {
      this.config.superpositionAiryLight = superAiryCheck.checked;
      this.recompute();
    });

    this.bindRangeInput('input-aspect', 'val-aspect', (val) => {
      this.config.charAspectRatio = parseFloat(val);
      this.recompute();
    });

    // Controles específicos de Modo Contorno
    this.bindRangeInput('input-contour-thresh', 'val-contour-thresh', (val) => {
      this.config.contourThreshold = parseInt(val, 10);
      this.recompute();
      return `${val}%`;
    });

    this.bindRangeInput('input-contour-size', 'val-contour-size', (val) => {
      this.config.contourFontSize = parseInt(val, 10);
      this.recompute();
      return `${val} px`;
    });

    this.bindRangeInput('input-contour-density', 'val-contour-density', (val) => {
      const num = parseInt(val, 10);
      this.config.contourDensity = num;
      this.recompute();
      return num === 1 ? 'Baja (1)' : num === 2 ? 'Media (2)' : 'Alta (3)';
    });

    const hatchingCheck = document.getElementById('check-contour-hatching') as HTMLInputElement;
    hatchingCheck?.addEventListener('change', () => {
      this.config.contourHatching = hatchingCheck.checked;
      this.recompute();
    });

    // Checkbox invert
    const invertCheck = document.getElementById('check-invert') as HTMLInputElement;
    invertCheck.addEventListener('change', () => {
      this.config.invert = invertCheck.checked;
      this.recompute();
    });

    // Tipografía
    const fontSelect = document.getElementById('select-font') as HTMLSelectElement;
    fontSelect.addEventListener('change', () => {
      this.config.fontFamily = fontSelect.value;
      this.recompute();
    });

    // Rampa ASCII
    const rampSelect = document.getElementById('select-ramp') as HTMLSelectElement;
    rampSelect.addEventListener('change', () => {
      const key = rampSelect.value as keyof typeof ASCII_RAMPS;
      this.config.asciiRamp = ASCII_RAMPS[key] || ASCII_RAMPS.clasica;
      this.recompute();
    });

    // Editor de historia y Ficha Legible
    const storyTextarea = document.getElementById('story-text') as HTMLTextAreaElement;
    const subjectNameInput = document.getElementById('input-subject-name') as HTMLInputElement;
    const subjectDateInput = document.getElementById('input-subject-date') as HTMLInputElement;
    const dateTodayBtn = document.getElementById('btn-date-today') as HTMLButtonElement;
    const readableCardCheck = document.getElementById('check-readable-card') as HTMLInputElement;
    const fichaFieldsRow = document.getElementById('ficha-fields-row') as HTMLElement;
    const toggleFichaToolbarBtn = document.getElementById('btn-toggle-ficha-toolbar') as HTMLButtonElement;
    const labelToggleFicha = document.getElementById('label-toggle-ficha') as HTMLElement;

    const syncReadableCardUI = (show: boolean) => {
      this.config.showReadableText = show;
      if (readableCardCheck) readableCardCheck.checked = show;
      if (fichaFieldsRow) fichaFieldsRow.style.display = show ? 'grid' : 'none';
      if (toggleFichaToolbarBtn) toggleFichaToolbarBtn.classList.toggle('active', show);
      if (labelToggleFicha) labelToggleFicha.textContent = show ? 'Con Texto Legible' : 'Solo Letrato';
      if (this.currentMatrix) {
        this.currentMatrix.config = { ...this.config };
        this.fitCanvasToContainer();
        this.renderCanvas();
      }
    };

    readableCardCheck?.addEventListener('change', () => {
      syncReadableCardUI(readableCardCheck.checked);
    });

    toggleFichaToolbarBtn?.addEventListener('click', () => {
      syncReadableCardUI(!this.config.showReadableText);
    });

    subjectNameInput?.addEventListener('input', () => {
      this.config.subjectName = subjectNameInput.value;
      if (this.currentMatrix) {
        this.currentMatrix.config = { ...this.config };
        this.renderCanvas();
      }
    });

    subjectDateInput?.addEventListener('input', () => {
      this.config.subjectDate = subjectDateInput.value;
      if (this.currentMatrix) {
        this.currentMatrix.config = { ...this.config };
        this.renderCanvas();
      }
    });

    dateTodayBtn?.addEventListener('click', () => {
      const todayStr = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      }).toUpperCase();
      this.config.subjectDate = todayStr;
      if (subjectDateInput) subjectDateInput.value = todayStr;
      if (this.currentMatrix) {
        this.currentMatrix.config = { ...this.config };
        this.renderCanvas();
      }
    });

    storyTextarea.value = this.config.customText;
    this.updateCounters(this.config.customText);

    storyTextarea.addEventListener('input', () => {
      this.config.customText = storyTextarea.value;
      this.updateCounters(storyTextarea.value);
      this.recompute();
    });

    // Presets de historia
    const presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
    presetSelect.addEventListener('change', () => {
      const selected = PRESET_STORIES.find((p) => p.id === presetSelect.value);
      if (selected) {
        this.config.customText = selected.text;
        this.config.subjectName = selected.subjectName;
        this.config.subjectDate = selected.subjectDate;
        storyTextarea.value = selected.text;
        if (subjectNameInput) subjectNameInput.value = selected.subjectName;
        if (subjectDateInput) subjectDateInput.value = selected.subjectDate;
        this.updateCounters(selected.text);
        this.recompute();
      }
    });

    // Transformación de mayúsculas/minúsculas
    const caseSelect = document.getElementById('case-select') as HTMLSelectElement;
    caseSelect.addEventListener('change', () => {
      this.config.caseTransform = caseSelect.value as any;
      this.recompute();
    });

    // Sin espacios
    const noSpaceCheck = document.getElementById('check-ignore-whitespace') as HTMLInputElement;
    noSpaceCheck.addEventListener('change', () => {
      this.config.ignoreWhitespace = noSpaceCheck.checked;
      this.recompute();
    });

    // Temas de papel
    const themePills = document.querySelectorAll<HTMLElement>('.theme-pill');
    themePills.forEach((pill) => {
      pill.addEventListener('click', () => {
        const theme = pill.dataset.theme as PaperTheme;
        if (!theme) return;
        themePills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        this.config.paperTheme = theme;
        this.renderCanvas();
      });
    });

    // Carga de archivo
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const dropzone = document.getElementById('dropzone') as HTMLElement;

    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) this.loadImageFromFile(file);
    });

    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      const file = e.dataTransfer?.files?.[0];
      if (file) this.loadImageFromFile(file);
    });

    // Cargar muestra
    const sampleBtn = document.getElementById('btn-sample-photo') as HTMLButtonElement;
    sampleBtn.addEventListener('click', () => {
      this.loadImageFromUrl(getSamplePortraitDataUrl());
    });

    // Barra de exportación
    document.getElementById('btn-export-svg')?.addEventListener('click', () => this.exportSvg());
    document.getElementById('btn-export-png')?.addEventListener('click', () => this.exportPng());
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => this.exportPdf());
    document.getElementById('btn-copy-text')?.addEventListener('click', () => this.copyText());
    document.getElementById('btn-save-project')?.addEventListener('click', () => this.saveCurrentProject());
    document.getElementById('btn-print-test')?.addEventListener('click', () => window.print());

    // Modales
    this.initModals();
  }

  private initCanvasInteractions(): void {
    // Zoom Buttons
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      this.viewport.zoom = Math.min(8.0, this.viewport.zoom * 1.25);
      this.renderCanvas();
    });

    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      this.viewport.zoom = Math.max(0.2, this.viewport.zoom / 1.25);
      this.renderCanvas();
    });

    document.getElementById('btn-zoom-reset')?.addEventListener('click', () => {
      this.fitCanvasToContainer();
      this.renderCanvas();
    });

    // Lupa Toggle
    const magnifierBtn = document.getElementById('btn-toggle-magnifier') as HTMLButtonElement;
    magnifierBtn?.addEventListener('click', () => {
      this.viewport.showMagnifier = !this.viewport.showMagnifier;
      magnifierBtn.classList.toggle('active', this.viewport.showMagnifier);
      this.viewportContainerEl.classList.toggle('magnifier-active', this.viewport.showMagnifier);
      this.renderCanvas();
    });

    // Mouse Pan & Zoom
    this.viewportContainerEl.addEventListener('mousedown', (e) => {
      if (this.viewport.showMagnifier) return;
      this.isPanning = true;
      this.startPanX = e.clientX - this.viewport.panX;
      this.startPanY = e.clientY - this.viewport.panY;
      this.viewportContainerEl.classList.add('panning');
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.viewport.panX = e.clientX - this.startPanX;
        this.viewport.panY = e.clientY - this.startPanY;
        this.renderCanvas();
      } else if (this.viewport.showMagnifier) {
        const rect = this.canvasEl.getBoundingClientRect();
        this.viewport.magnifierX = e.clientX - rect.left;
        this.viewport.magnifierY = e.clientY - rect.top;
        this.renderCanvas();
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewportContainerEl.classList.remove('panning');
      }
    });

    // Wheel Zoom
    this.viewportContainerEl.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
        const newZoom = Math.max(0.2, Math.min(8.0, this.viewport.zoom * zoomFactor));

        const rect = this.viewportContainerEl.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Zoom centrado en el cursor
        this.viewport.panX = mouseX - (mouseX - this.viewport.panX) * (newZoom / this.viewport.zoom);
        this.viewport.panY = mouseY - (mouseY - this.viewport.panY) * (newZoom / this.viewport.zoom);
        this.viewport.zoom = newZoom;

        this.renderCanvas();
      },
      { passive: false }
    );

    // Resize observer
    window.addEventListener('resize', () => {
      this.renderCanvas();
    });
  }

  private async loadInitialData(): Promise<void> {
    const sampleUrl = getSamplePortraitDataUrl();
    await this.loadImageFromUrl(sampleUrl);
  }

  private async loadImageFromUrl(url: string): Promise<void> {
    try {
      this.currentImage = await this.imageProcessor.loadImage(url);
      this.recompute(true);
    } catch (e) {
      console.error('Error al cargar imagen de muestra:', e);
    }
  }

  private async loadImageFromFile(file: File): Promise<void> {
    try {
      this.currentImage = await this.imageProcessor.loadImage(file);
      this.recompute(true);
    } catch (e) {
      alert('No se pudo procesar la imagen seleccionada.');
    }
  }

  private fitCanvasToContainer(): void {
    if (!this.currentImage) return;

    const containerW = this.viewportContainerEl.clientWidth || 600;
    const containerH = this.viewportContainerEl.clientHeight || 600;

    let docW = 750;
    let docH = 1000;

    if (this.currentMatrix) {
      const layout = computeCardLayout(this.currentMatrix);
      docW = layout.totalDocWidth;
      docH = layout.totalDocHeight;
    } else {
      const crop = getCropRegion(
        this.currentImage.naturalWidth || 600,
        this.currentImage.naturalHeight || 750,
        this.config.cropFormat
      );
      docW = crop.targetWidth;
      docH = crop.targetHeight;
    }

    const scaleX = (containerW * 0.88) / docW;
    const scaleY = (containerH * 0.88) / docH;
    const fitScale = Math.min(scaleX, scaleY, 1.15);

    this.viewport.zoom = fitScale;
    this.viewport.panX = (containerW - docW * fitScale) / 2;
    this.viewport.panY = (containerH - docH * fitScale) / 2;
  }

  private showDinastiaIndicator(show: boolean): void {
    const el = document.getElementById('dinastia-indicator');
    if (el) {
      el.style.display = show ? 'inline-flex' : 'none';
    }
  }

  private recompute(resetFit: boolean = false): void {
    if (!this.currentImage) return;

    this.showDinastiaIndicator(true);

    setTimeout(() => {
      if (!this.currentImage) {
        this.showDinastiaIndicator(false);
        return;
      }

      const t0 = performance.now();

      const rawW = this.currentImage.naturalWidth || 600;
      const rawH = this.currentImage.naturalHeight || 750;
      const crop = getCropRegion(rawW, rawH, this.config.cropFormat);
      const imgW = crop.targetWidth;
      const imgH = crop.targetHeight;

      // 1. Calcular Cuadrícula según proporción seleccionada (Cuadrada 1:1 / Vertical 3:4 / Original)
      const effectiveCols =
        this.config.mode === 'superposicion'
          ? Math.max(40, Math.round(this.config.columns * 0.72))
          : this.config.columns;
      const grid = calculateGridDimensions(
        imgW,
        imgH,
        effectiveCols,
        this.config.charAspectRatio
      );

      // 2. Extraer Matriz de Luminancia, Bordes y Centroides Sub-Celda
      const { luminanceMatrix, edgeMatrix, centroidXMatrix, centroidYMatrix } =
        this.imageProcessor.extractLuminanceMatrix(
          this.currentImage,
          grid,
          this.config
        );

      // 3. Generar Celdas o Trazos según Modo
      const rawImageData = this.imageProcessor.getImageData(
        this.currentImage,
        imgW,
        imgH,
        this.config.cropFormat
      );
      this.currentMatrix = this.generator.generateMatrix(
        grid,
        luminanceMatrix,
        edgeMatrix,
        this.config,
        rawImageData,
        centroidXMatrix,
        centroidYMatrix
      );

      const t1 = performance.now();

      if (resetFit) {
        this.fitCanvasToContainer();
      }

      // Actualizar Telemetría
      this.updateTelemetry(grid, Math.round(t1 - t0));

      // Renderizar
      this.renderCanvas();

      this.showDinastiaIndicator(false);
    }, 20);
  }

  private renderCanvas(): void {
    if (!this.currentMatrix) return;

    const containerW = this.viewportContainerEl.clientWidth || 600;
    const containerH = this.viewportContainerEl.clientHeight || 600;

    this.canvasRenderer.render(
      this.currentMatrix,
      this.viewport,
      containerW,
      containerH
    );
  }

  private updateModeControlsVisibility(): void {
    const toscoDiv = document.getElementById('controls-mode-tosco') as HTMLElement;
    const letratoDiv = document.getElementById('controls-mode-letrato') as HTMLElement;
    const superDiv = document.getElementById('controls-mode-superposicion') as HTMLElement;
    const typewriterDiv = document.getElementById('controls-mode-typewriter') as HTMLElement;
    const contornoDiv = document.getElementById('controls-mode-contorno') as HTMLElement;

    if (toscoDiv) toscoDiv.style.display = this.config.mode === 'tosco' ? 'flex' : 'none';
    if (letratoDiv) letratoDiv.style.display = this.config.mode === 'letrato' ? 'flex' : 'none';
    if (superDiv) superDiv.style.display = this.config.mode === 'superposicion' ? 'flex' : 'none';
    if (typewriterDiv) typewriterDiv.style.display = this.config.mode === 'typewriter' ? 'flex' : 'none';
    if (contornoDiv) contornoDiv.style.display = this.config.mode === 'contorno' ? 'flex' : 'none';
  }

  private bindRangeInput(
    inputId: string,
    valId: string,
    callback: (val: string) => string | void
  ): void {
    const input = document.getElementById(inputId) as HTMLInputElement;
    const label = document.getElementById(valId) as HTMLElement;
    if (!input || !label) return;

    input.addEventListener('input', () => {
      const customFormatted = callback(input.value);
      label.textContent = customFormatted !== undefined ? (customFormatted as string) : input.value;
    });
  }

  private updateCounters(text: string): void {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const charEl = document.getElementById('char-counter');
    const wordEl = document.getElementById('word-counter');
    if (charEl) charEl.textContent = `${chars.toLocaleString()} caracteres`;
    if (wordEl) wordEl.textContent = `${words.toLocaleString()} palabras`;
  }

  private updateTelemetry(grid: any, durationMs: number): void {
    const gridEl = document.getElementById('telemetry-grid');
    const cellsEl = document.getElementById('telemetry-cells');
    const aspectEl = document.getElementById('telemetry-aspect');
    const fpsEl = document.getElementById('telemetry-fps');

    const formatName =
      this.config.cropFormat === 'square'
        ? '1:1 Cuadrada'
        : this.config.cropFormat === 'vertical'
        ? '3:4 Vertical'
        : 'Original';

    if (this.config.mode === 'contorno' && this.currentMatrix?.contourGlyphs) {
      const pathsCount = this.currentMatrix.contourPaths?.length || 0;
      const glyphsCount = this.currentMatrix.contourGlyphs.length;
      if (gridEl) gridEl.textContent = `${pathsCount} trazos (${formatName})`;
      if (cellsEl) cellsEl.textContent = `${glyphsCount.toLocaleString()} letras en curva`;
      if (aspectEl) aspectEl.textContent = this.config.showReadableText ? 'Con Ficha Legible' : 'Solo Letrato';
    } else if (this.config.mode === 'superposicion' && this.currentMatrix?.contourGlyphs) {
      const glyphsCount = this.currentMatrix.contourGlyphs.length;
      if (gridEl) gridEl.textContent = `${this.config.superpositionMaxLayers} capas (${formatName})`;
      if (cellsEl) cellsEl.textContent = `${glyphsCount.toLocaleString()} letras superpuestas`;
      if (aspectEl) aspectEl.textContent = this.config.showReadableText ? 'Con Ficha Legible' : 'Solo Letrato';
    } else {
      if (gridEl) gridEl.textContent = `${grid.columns}×${grid.rows} (${formatName})`;
      if (cellsEl) cellsEl.textContent = `${(grid.columns * grid.rows).toLocaleString()} letras`;
      if (aspectEl) aspectEl.textContent = this.config.showReadableText ? 'Con Ficha Legible' : 'Solo Letrato';
    }
    if (fpsEl) fpsEl.textContent = `Render: ${durationMs} ms`;
  }

  // --- EXPORTACIONES ---

  private exportSvg(): void {
    if (!this.currentMatrix) return;
    const filename = `letrato_${Date.now()}.svg`;
    this.svgRenderer.downloadSvg(this.currentMatrix, filename);
  }

  private exportPng(): void {
    if (!this.currentMatrix) return;

    const scaleSelect = document.getElementById('select-png-scale') as HTMLSelectElement;
    const scale = scaleSelect.value === '4x' ? 4 : scaleSelect.value === '2x' ? 2 : 1;

    const layout = computeCardLayout(this.currentMatrix);
    const totalWidth = layout.totalDocWidth;
    const totalHeight = layout.totalDocHeight;

    const offCanvas = document.createElement('canvas');
    offCanvas.width = totalWidth * scale;
    offCanvas.height = totalHeight * scale;

    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(scale, scale);
    this.canvasRenderer.drawBackground(totalWidth, totalHeight, this.config.paperTheme, ctx);
    this.canvasRenderer.drawMatrixContent(ctx, this.currentMatrix);

    const a = document.createElement('a');
    a.download = `letrato_${scale}x_${Date.now()}.png`;
    a.href = offCanvas.toDataURL('image/png');
    a.click();
  }

  private async exportPdf(): Promise<void> {
    if (!this.currentMatrix) return;
    const filename = `letrato_impresion_${Date.now()}.pdf`;
    await this.pdfRenderer.exportPdf(this.currentMatrix, 'letter', filename);
  }

  private copyText(): void {
    if (!this.currentMatrix) return;

    if (
      (this.config.mode === 'contorno' || this.config.mode === 'superposicion') &&
      this.currentMatrix.contourGlyphs
    ) {
      const text = this.currentMatrix.contourGlyphs.map((g) => g.char).join('');
      navigator.clipboard.writeText(text).then(() => {
        alert('¡El texto de las capas del Letrato fue copiado al portapapeles!');
      });
      return;
    }

    const lines = this.currentMatrix.cells.map((row) => row.map((cell) => cell.char).join(''));
    const fullText = lines.join('\n');
    navigator.clipboard.writeText(fullText).then(() => {
      alert('¡El texto formateado del Letrato fue copiado al portapapeles!');
    });
  }

  private saveCurrentProject(): void {
    if (!this.currentMatrix || !this.currentImage) return;

    const name = prompt('Nombre para este Letrato:', 'Retrato ' + new Date().toLocaleDateString());
    if (!name) return;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.currentImage.naturalWidth;
    tempCanvas.height = this.currentImage.naturalHeight;
    const tCtx = tempCanvas.getContext('2d');
    tCtx?.drawImage(this.currentImage, 0, 0);
    const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.8);

    ProjectStorage.saveProject(name, this.config, dataUrl);
    alert('Proyecto guardado con éxito en este dispositivo.');
  }

  private initModals(): void {
    // Modal Acerca de
    const aboutModal = document.getElementById('modal-about') as HTMLElement;
    document.getElementById('btn-about')?.addEventListener('click', () => {
      aboutModal.classList.add('active');
    });
    document.getElementById('btn-close-about')?.addEventListener('click', () => {
      aboutModal.classList.remove('active');
    });

    // Modal Proyectos
    const projectsModal = document.getElementById('modal-projects') as HTMLElement;
    const projectsList = document.getElementById('saved-projects-list') as HTMLElement;

    document.getElementById('btn-projects')?.addEventListener('click', () => {
      this.renderProjectsList(projectsList, projectsModal);
      projectsModal.classList.add('active');
    });

    document.getElementById('btn-close-projects')?.addEventListener('click', () => {
      projectsModal.classList.remove('active');
    });
  }

  private renderProjectsList(container: HTMLElement, modal: HTMLElement): void {
    const projects = ProjectStorage.getAllProjects();
    container.innerHTML = '';

    if (projects.length === 0) {
      container.innerHTML = `<p style="color: var(--text-dim); font-size: 0.85rem; padding: 20px 0; text-align: center;">No hay proyectos guardados todavía en este navegador.</p>`;
      return;
    }

    projects.forEach((proj) => {
      const card = document.createElement('div');
      card.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 14px;
        background: var(--bg-input);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-sm);
      `;

      card.innerHTML = `
        <div>
          <strong style="color: var(--accent-gold); font-size: 0.88rem;">${proj.name}</strong>
          <p style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">
            ${new Date(proj.updatedAt).toLocaleString()} · Modo: ${proj.config.mode}
          </p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-load btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;">Cargar</button>
          <button class="btn-del btn-secondary" style="padding: 4px 10px; font-size: 0.75rem; color: #ef4444;">Borrar</button>
        </div>
      `;

      card.querySelector('.btn-load')?.addEventListener('click', async () => {
        this.config = { ...proj.config };
        await this.loadImageFromUrl(proj.imageDataUrl);
        modal.classList.remove('active');
      });

      card.querySelector('.btn-del')?.addEventListener('click', () => {
        if (confirm(`¿Borrar el proyecto "${proj.name}"?`)) {
          ProjectStorage.deleteProject(proj.id);
          this.renderProjectsList(container, modal);
        }
      });

      container.appendChild(card);
    });
  }
}

// Inicializar la aplicación al cargar el DOM
window.addEventListener('DOMContentLoaded', () => {
  new LetratoApp();

  // Registrar Service Worker para PWA offline en producción
  if ('serviceWorker' in navigator && !window.location.hostname.includes('localhost')) {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('SW registration:', err);
    });
  }
});
