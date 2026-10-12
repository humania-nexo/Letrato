import { jsPDF } from 'jspdf';
import type { ProcessedMatrix } from '../core/types';
import { CanvasRenderer } from './canvas-renderer';

export type PdfPageFormat = 'letter' | 'a4';
export type PdfOrientation = 'portrait' | 'landscape';

export class PdfRenderer {
  /**
   * Genera y descarga un PDF listo para imprenta en alta definición (300 DPI equivalente).
   */
  public async exportPdf(
    matrix: ProcessedMatrix,
    format: PdfPageFormat = 'letter',
    filename: string = 'letrato.pdf'
  ): Promise<void> {
    const { totalWidth, totalHeight } = matrix.grid;
    const isLandscape = totalWidth > totalHeight;
    const orientation: PdfOrientation = isLandscape ? 'landscape' : 'portrait';

    const doc = new jsPDF({
      orientation,
      unit: 'mm',
      format
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Márgenes editoriales de 15 mm
    const margin = 15;
    const maxAvailableWidth = pageWidth - margin * 2;
    const maxAvailableHeight = pageHeight - margin * 2;

    // Calcular escala manteniendo proporción
    const aspect = totalWidth / totalHeight;
    let targetWidth = maxAvailableWidth;
    let targetHeight = targetWidth / aspect;

    if (targetHeight > maxAvailableHeight) {
      targetHeight = maxAvailableHeight;
      targetWidth = targetHeight * aspect;
    }

    const posX = (pageWidth - targetWidth) / 2;
    const posY = (pageHeight - targetHeight) / 2;

    // Generar canvas temporal en ultra alta resolución (4x = ~300 DPI para imprenta)
    const scaleFactor = 4;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = totalWidth * scaleFactor;
    offCanvas.height = totalHeight * scaleFactor;

    const renderer = new CanvasRenderer(offCanvas);
    const ctx = offCanvas.getContext('2d');
    if (ctx) {
      ctx.scale(scaleFactor, scaleFactor);
      renderer.drawBackground(totalWidth, totalHeight, matrix.config.paperTheme);
      renderer.drawMatrixContent(ctx, matrix);
    }

    // Usar PNG sin pérdidas para preservar los niveles de gris puros sin artefactos de compresión JPEG
    const imgData = offCanvas.toDataURL('image/png');

    // Agregar imagen centrada en el documento PDF
    doc.addImage(imgData, 'PNG', posX, posY, targetWidth, targetHeight, undefined, 'FAST');

    // Pie de página editorial con la frase del libro
    doc.setFont('courier', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(110, 110, 110);
    doc.text(
      `«Para la impresora seguían siendo letras. Para el sistema seguían siendo datos. Pero para ellas, por primera vez, era un espejo.»`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
    doc.setFontSize(6.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `LETRATO · El Manuscrito de Ceniza · DinastIA(TM) · SAPIENSIA Clan`,
      pageWidth / 2,
      pageHeight - 4.5,
      { align: 'center' }
    );

    doc.save(filename);
  }
}
