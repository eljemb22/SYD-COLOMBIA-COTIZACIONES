import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

/**
 * High-fidelity PDF exporter for SyD Colombia Commercial Quotes.
 * Captures all 3 calibrated sheets (Presentation, Pricing Table, Commercial Conditions)
 * and produces a crisp, exact Letter-sized PDF.
 */
export async function exportQuoteToPdf(
  quoteNumber: string,
  onProgress?: (progressText: string) => void
): Promise<void> {
  // Query all printable sheets dynamically in document order
  const foundSheets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-printable-sheet="true"]')
  );

  let sheets: HTMLElement[] = foundSheets;

  if (sheets.length === 0) {
    const sheetIds = ['hoja-word-1', 'hoja-word-2', 'hoja-word-3'];
    for (const id of sheetIds) {
      const el = document.getElementById(id);
      if (el) sheets.push(el);
    }
  }

  if (sheets.length === 0) {
    throw new Error('No se encontraron las hojas de la cotización para exportar.');
  }

  // Create jsPDF document: Letter format (215.9 x 279.4 mm), portrait
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter',
    compress: true,
  });

  const pdfWidth = 215.9;
  const pdfHeight = 279.4;

  for (let i = 0; i < sheets.length; i++) {
    const sheet = sheets[i];
    onProgress?.(`Generando página ${i + 1} de ${sheets.length}...`);

    // Ensure all inputs have their current value in value attribute so html2canvas renders them
    const inputs = sheet.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
    inputs.forEach((input) => {
      input.setAttribute('value', input.value);
    });

    // Capture sheet using html2canvas-pro with ultra-high fidelity (scale: 3 for 288 DPI crispness)
    const canvas = await html2canvas(sheet, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 15000,
      windowWidth: 850,
      onclone: (clonedDoc) => {
        // Ensure all input values and textareas in the cloned document match current values
        const clonedSheet = clonedDoc.getElementById(sheet.id);
        if (clonedSheet) {
          clonedSheet.style.width = '816px';
          clonedSheet.style.minWidth = '816px';
          clonedSheet.style.maxWidth = '816px';
          clonedSheet.style.minHeight = '1056px';
          clonedSheet.style.height = '1056px';
          clonedSheet.style.maxHeight = '1056px';
          clonedSheet.style.borderRadius = '0px';
          clonedSheet.style.border = 'none';
          clonedSheet.style.boxShadow = 'none';
          clonedSheet.style.margin = '0 auto';
          clonedSheet.style.overflow = 'hidden';

          const originalInputs = sheet.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
          const clonedInputs = clonedSheet.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
          originalInputs.forEach((orig, idx) => {
            if (clonedInputs[idx]) {
              clonedInputs[idx].value = orig.value;
              clonedInputs[idx].setAttribute('value', orig.value);
              clonedInputs[idx].style.border = 'none';
              clonedInputs[idx].style.background = 'transparent';
              clonedInputs[idx].style.outline = 'none';
              clonedInputs[idx].style.boxShadow = 'none';
            }
          });
        }
      },
    });

    // Use lossless PNG for pin-sharp text and graphics
    const imgData = canvas.toDataURL('image/png');

    if (i > 0) {
      pdf.addPage('letter', 'portrait');
    }

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW');
  }

  onProgress?.('Descargando archivo PDF...');
  const sanitizedNum = (quoteNumber || 'COTIZACION').replace(/[/\\?%*:|"<>]/g, '-');
  pdf.save(`Cotizacion_${sanitizedNum}_SyD.pdf`);
}

/**
 * Robust print function that extracts all exact quote sheets
 * into an isolated printable iframe, avoiding iframe sandbox issues
 * and preserving exact layout, letterhead, margins, and page breaks.
 */
export function printQuoteDocument(): void {
  const foundSheets = Array.from(
    document.querySelectorAll<HTMLElement>('[data-printable-sheet="true"]')
  );

  let rawSheets: HTMLElement[] = foundSheets;

  if (rawSheets.length === 0) {
    const sheetIds = ['hoja-word-1', 'hoja-word-2', 'hoja-word-3'];
    for (const id of sheetIds) {
      const el = document.getElementById(id);
      if (el) {
        rawSheets.push(el);
      }
    }
  }

  if (rawSheets.length === 0) {
    window.print();
    return;
  }

  const sheetElements: HTMLElement[] = rawSheets.map((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    const originalInputs = el.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');
    const cloneInputs = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea');

    originalInputs.forEach((orig, idx) => {
      const target = cloneInputs[idx];
      if (target) {
        target.setAttribute('value', orig.value);
        target.style.border = 'none';
        target.style.background = 'transparent';
        target.style.outline = 'none';
      }
    });

    return clone;
  });

  if (sheetElements.length === 0) {
    // Fallback to standard window.print() if elements not found
    window.print();
    return;
  }

  // Create an invisible iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) {
    window.print();
    return;
  }

  // Collect all CSS styles from the main document to ensure exact styling
  let allStyles = '';
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    allStyles += node.outerHTML;
  });

  iframeDoc.open();
  iframeDoc.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>Imprimir Cotización - SyD Colombia</title>
        ${allStyles}
        <style>
          @page {
            size: letter portrait;
            margin: 0;
          }
          *, *::before, *::after {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          html, body {
            margin: 0;
            padding: 0;
            background: #ffffff !important;
            color: #000000 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          }
          .print-container {
            width: 100%;
            margin: 0;
            padding: 0;
          }
          .commercial-quote-sheet {
            page-break-after: always;
            page-break-inside: avoid;
            break-after: page;
            width: 100%;
            height: 100vh;
            min-height: 100vh;
            position: relative;
            overflow: hidden;
            box-shadow: none !important;
            border: none !important;
            margin: 0 !important;
          }
          .commercial-quote-sheet:last-child {
            page-break-after: avoid;
            break-after: avoid;
          }
          input, textarea {
            font-family: inherit;
            color: inherit;
          }
          button {
            display: none !important;
          }
        </style>
      </head>
      <body>
        <div class="print-container">
          ${sheetElements.map((el) => el.outerHTML).join('')}
        </div>
      </body>
    </html>
  `);
  iframeDoc.close();

  // Wait for images in iframe to load before triggering print
  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (err) {
      console.warn('Iframe print failed, falling back to window.print()', err);
      window.print();
    } finally {
      // Remove iframe after print dialog completes
      setTimeout(() => {
        try {
          document.body.removeChild(iframe);
        } catch {}
      }, 2000);
    }
  }, 400);
}
