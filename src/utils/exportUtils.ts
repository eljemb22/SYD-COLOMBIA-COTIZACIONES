import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  ShadingType,
  convertInchesToTwip,
  PageBreak,
  Header,
  Footer,
  ImageRun,
  HorizontalPositionRelativeFrom,
  VerticalPositionRelativeFrom,
  TextWrappingType,
  PageOrientation,
  VerticalAlign,
} from 'docx';
import { saveAs } from 'file-saver';
import { QuoteHeader, QuoteItem } from '../types';
import { formatCOP, formatNumber, numberToSpanishWords } from './formatters';
import { getFormattedSpanishDate } from './quoteConsecutive';
import { getOfficialSyDLetterheadDataUrl } from './sydDefaultLetterhead';

interface ExportMargins {
  headerMarginTop?: number;
  sidePadding?: number;
  companyLogoUrl?: string;
  companyLetterheadUrl?: string;
  companyFooterUrl?: string;
}

// Convert base64 data URL to Uint8Array and type for docx ImageRun
function dataUrlToImageInfo(dataUrl: string): { data: Uint8Array; type: 'png' | 'jpg' } | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const type: 'png' | 'jpg' = mime.includes('jpeg') || mime.includes('jpg') ? 'jpg' : 'png';

    const byteString = atob(parts[1]);
    const uint8Array = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      uint8Array[i] = byteString.charCodeAt(i);
    }
    return { data: uint8Array, type };
  } catch (e) {
    console.error('Error converting data URL for docx', e);
    return null;
  }
}

// Generate an official high-resolution corporate SyD Colombia letterhead background
function generateCorporateLetterheadDataUrl(): string | null {
  return getOfficialSyDLetterheadDataUrl() || null;
}

// Generate signature graphic image
function generateSignatureDataUrl(): string | null {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 140;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.strokeStyle = '#1E293B';
    ctx.lineWidth = 2.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(35, 105);
    ctx.bezierCurveTo(30, 70, 28, 30, 31, 18);
    ctx.bezierCurveTo(32, 15, 39, 22, 39, 64);
    ctx.bezierCurveTo(39, 92, 40, 125, 39, 130);

    ctx.moveTo(21, 54);
    ctx.bezierCurveTo(42, 51, 63, 48, 73, 47);

    ctx.moveTo(53, 26);
    ctx.bezierCurveTo(59, 56, 63, 98, 67, 115);
    ctx.bezierCurveTo(68, 119, 73, 112, 77, 84);
    ctx.bezierCurveTo(81, 63, 84, 49, 87, 49);
    ctx.bezierCurveTo(91, 49, 92, 77, 95, 105);
    ctx.bezierCurveTo(98, 115, 101, 115, 106, 98);
    ctx.bezierCurveTo(112, 81, 118, 67, 123, 67);
    ctx.bezierCurveTo(127, 67, 126, 91, 129, 109);
    ctx.bezierCurveTo(131, 115, 137, 112, 147, 104);
    ctx.bezierCurveTo(160, 92, 175, 82, 190, 75);
    ctx.stroke();

    return canvas.toDataURL('image/png');
  } catch (e) {
    console.error('Error generating signature canvas', e);
    return null;
  }
}

export const exportQuoteToWord = async (
  header: QuoteHeader,
  items: QuoteItem[],
  margins?: ExportMargins
) => {
  const subtotal = items.reduce((acc, it) => acc + it.totalSalePrice, 0);
  const iva = items.reduce((acc, it) => {
    const rate = it.taxExempt ? 0 : (it.taxRate !== undefined ? it.taxRate : (header.taxRate ?? 0.19));
    return acc + Math.round(it.totalSalePrice * rate);
  }, 0);
  const total = subtotal + iva;
  const totalWords = numberToSpanishWords(total);

  // Standard crisp solid black borders matching preview
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 4, color: '000000' },
  };

  // Precise cell margins for clean padding inside table cells
  const cellMargins = {
    top: 50,
    bottom: 50,
    left: 50,
    right: 50,
  };

  // Column widths carefully balanced to sum exactly to 9,900 DXA (100% printable width of 8.5" page with 0.81" margins)
  const colWidths = {
    item: 400,       // 4.0%
    desc: 2680,      // 27.0% (ample space for description + accessories)
    brand: 840,      // 8.5% (fits MINDRAY, STRYKER without breaking words)
    model: 990,      // 10.0% (fits models without word cutting)
    qty: 450,        // 4.5%
    price: 1140,     // 11.5%
    subtotal: 1140,  // 11.5%
    iva: 1090,       // 11.0%
    total: 1170,     // 12.0%
  };

  // Build Table Header (Page 2) matching exact preview layout and colors
  const tableHeaderRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      new TableCell({
        width: { size: colWidths.item, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Item', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.desc, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Descripción', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.brand, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Marca', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.model, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Modelo', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.qty, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Cant.', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.price, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Precio', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.subtotal, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Subtotal', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.iva, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Iva', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.total, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Total', bold: true, size: 17, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
    ],
  });

  // Build Table Body Rows with clean single-line currency format
  const tableItemRows = items.map((item, index) => {
    const itemSubtotal = item.totalSalePrice;
    const itemTaxRate = item.taxExempt ? 0 : (item.taxRate !== undefined ? item.taxRate : (header.taxRate ?? 0.19));
    const itemIva = Math.round(itemSubtotal * itemTaxRate);
    const itemTotal = itemSubtotal + itemIva;

    const descriptionParagraphs: Paragraph[] = [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 20, after: item.accessories && item.accessories.length > 0 ? 20 : 20, line: 240 },
        children: [new TextRun({ text: item.name.toUpperCase(), size: 16.5, font: 'Calibri', color: '000000' })],
      }),
    ];

    if (item.accessories && item.accessories.length > 0) {
      descriptionParagraphs.push(
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 20, line: 220 },
          children: [
            new TextRun({ text: 'ACCESORIOS: ', bold: true, size: 13.5, font: 'Calibri', color: '475569' }),
            new TextRun({
              text: item.accessories
                .map((a) => `${a.name.toUpperCase()}${a.quantity > 1 ? ` (X${a.quantity})` : ''}`)
                .join(', '),
              size: 13.5,
              font: 'Calibri',
              color: '475569',
            }),
          ],
        })
      );
    }

    return new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: colWidths.item, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 25, after: 25, line: 240 },
              children: [new TextRun({ text: `${index + 1}`, size: 16.5, font: 'Calibri', color: '000000' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWidths.desc, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: descriptionParagraphs,
        }),
        new TableCell({
          width: { size: colWidths.brand, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 25, after: 25, line: 240 },
              children: [
                new TextRun({
                  text: item.brand.toUpperCase(),
                  size: item.brand && item.brand.length > 12 ? 14 : 16.5,
                  font: 'Calibri',
                  color: '000000',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWidths.model, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 25, after: 25, line: 240 },
              children: [
                new TextRun({
                  text: item.model.toUpperCase(),
                  size: item.model && item.model.length > 12 ? 14 : 16.5,
                  font: 'Calibri',
                  color: '000000',
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWidths.qty, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 25, after: 25, line: 240 },
              children: [new TextRun({ text: `${item.quantity}`, size: 16.5, font: 'Calibri', color: '000000' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWidths.price, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 25, after: 25, line: 240 },
              children: [new TextRun({ text: `$\u00A0${formatNumber(item.unitSalePrice)}`, size: 15.5, font: 'Calibri', color: '000000' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWidths.subtotal, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 25, after: 25, line: 240 },
              children: [new TextRun({ text: `$\u00A0${formatNumber(itemSubtotal)}`, size: 15.5, font: 'Calibri', color: '000000' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWidths.iva, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 25, after: 25, line: 240 },
              children: [new TextRun({ text: itemIva > 0 ? `$\u00A0${formatNumber(itemIva)}` : '$ -', size: 15.5, font: 'Calibri', color: '000000' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: colWidths.total, type: WidthType.DXA },
          borders: cellBorder,
          margins: cellMargins,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 25, after: 25, line: 240 },
              children: [new TextRun({ text: `$\u00A0${formatNumber(itemTotal)}`, size: 15.5, font: 'Calibri', color: '000000' })],
            }),
          ],
        }),
      ],
    });
  });

  // Build Totales Row (Merged first 5 columns: Item, Desc, Brand, Model, Qty)
  const mergedTotalsWidth = colWidths.item + colWidths.desc + colWidths.brand + colWidths.model + colWidths.qty; // 5,200 DXA
  const totalsRow = new TableRow({
    cantSplit: true,
    children: [
      new TableCell({
        columnSpan: 5,
        width: { size: mergedTotalsWidth, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: 'Totales', bold: true, size: 16.5, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.price, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: '', size: 16.5, font: 'Calibri' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.subtotal, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: `$\u00A0${formatNumber(subtotal)}`, bold: true, size: 16.5, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.iva, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: iva > 0 ? `$\u00A0${formatNumber(iva)}` : '$ -', bold: true, size: 16.5, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
      new TableCell({
        width: { size: colWidths.total, type: WidthType.DXA },
        shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        borders: cellBorder,
        margins: cellMargins,
        verticalAlign: VerticalAlign.CENTER,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 30, after: 30 },
            children: [new TextRun({ text: `$\u00A0${formatNumber(total)}`, bold: true, size: 16.5, font: 'Calibri', color: '000000' })],
          }),
        ],
      }),
    ],
  });

  const equipmentTable = new Table({
    width: { size: 9900, type: WidthType.DXA },
    rows: [tableHeaderRow, ...tableItemRows, totalsRow],
  });

  // Determine letterhead: prioritize active/permanent attached letterhead, then official SyD corporate letterhead
  let rawLetterheadUrl = margins?.companyLetterheadUrl;
  if (!rawLetterheadUrl && typeof localStorage !== 'undefined') {
    const manual = localStorage.getItem('syd_custom_manual_letterhead');
    if (manual && manual !== 'none' && manual.length > 20 && !manual.includes('OFICIAL SYD COLOMBIA')) {
      rawLetterheadUrl = manual;
    } else {
      const saved = localStorage.getItem('syd_active_letterhead_url');
      if (saved && saved !== 'none' && saved.length > 20 && !saved.includes('OFICIAL SYD COLOMBIA')) {
        rawLetterheadUrl = saved;
      }
    }
  }
  const letterheadInfo = rawLetterheadUrl ? dataUrlToImageInfo(rawLetterheadUrl) : null;

  // Signature image
  const signatureDataUrl = generateSignatureDataUrl();
  const signatureInfo = signatureDataUrl ? dataUrlToImageInfo(signatureDataUrl) : null;

  // Margins in DXA/twips:
  // Top margin accommodates letterhead banner smoothly
  const topMarginTwips = margins?.headerMarginTop
    ? Math.max(1800, Math.round(margins.headerMarginTop * 14))
    : 2150;
  const sideMarginTwips = 1170; // 0.8125 in (leaving exact 9,900 DXA printable width)
  const bottomMarginTwips = 2000; // 1.39 in (ensures all tables stop before bottom logos & addresses without creating artificial page overflows)

  // Header definition with full-bleed letterhead overlay
  const headerDefinition = letterheadInfo
    ? new Header({
        children: [
          new Paragraph({
            children: [
              new ImageRun({
                type: letterheadInfo.type,
                data: letterheadInfo.data,
                transformation: {
                  width: 816, // Letter full width in px (8.5 in * 96 DPI)
                  height: 1056, // Letter full height in px (11 in * 96 DPI)
                },
                floating: {
                  behindDocument: true,
                  allowOverlap: true,
                  lockAnchor: true,
                  horizontalPosition: {
                    relative: HorizontalPositionRelativeFrom.PAGE,
                    offset: 0,
                  },
                  verticalPosition: {
                    relative: VerticalPositionRelativeFrom.PAGE,
                    offset: 0,
                  },
                  wrap: {
                    type: TextWrappingType.NONE,
                  },
                },
              }),
            ],
          }),
        ],
      })
    : undefined;

  // Build the complete modern DOCX document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 12240, // 8.5 in in twips
              height: 15840, // 11 in in twips
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: topMarginTwips,
              bottom: bottomMarginTwips,
              left: sideMarginTwips,
              right: sideMarginTwips,
              header: 0,
              footer: 0,
            },
          },
        },
        headers: headerDefinition
          ? {
              default: headerDefinition,
            }
          : undefined,
        children: [
          // ==================== PÁGINA 1: CARTA DE PRESENTACIÓN ====================
          new Paragraph({
            spacing: { after: 240 },
            children: [
              new TextRun({
                text: (() => {
                  const rawDate = header.date?.trim();
                  if (!rawDate) return getFormattedSpanishDate(header.city || 'Barranquilla');
                  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
                    const [y, m, d] = rawDate.split('-').map(Number);
                    return getFormattedSpanishDate(header.city || 'Barranquilla', new Date(y, m - 1, d));
                  }
                  return rawDate;
                })(),
                font: 'Calibri',
                size: 22,
                color: '1E293B',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({
                text: 'Señor(es):',
                font: 'Calibri',
                size: 22,
                color: '334155',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: (header.clientName || 'CLIENTE NO ESPECIFICADO').toUpperCase(),
                bold: true,
                font: 'Calibri',
                size: 23,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200 },
            children: [
              new TextRun({
                text: header.city || '',
                font: 'Calibri',
                size: 21,
                color: '334155',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: 'Asunto: Cotización Comercial',
                bold: true,
                font: 'Calibri',
                size: 22,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 220 },
            children: [
              new TextRun({
                text: header.quoteNumber || '',
                bold: true,
                font: 'Calibri',
                size: 22,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { before: 140, after: 180 },
            children: [
              new TextRun({
                text: 'Cordial Saludo:',
                bold: true,
                font: 'Calibri',
                size: 22,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 220, line: 300 },
            children: [
              new TextRun({
                text: 'SUMINISTROS Y DOTACIONES COLOMBIA S.A. ',
                bold: true,
                font: 'Calibri',
                size: 21.5,
                color: '000000',
              }),
              new TextRun({
                text: 'presentamos a su consideración la propuesta para la adquisición de equipos, insumos y material médico, cuya descripción y demás condiciones de venta están incorporadas a la presente cotización.',
                font: 'Calibri',
                size: 21.5,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 220, line: 300 },
            children: [
              new TextRun({
                text: 'SYD COLOMBIA S.A. ',
                bold: true,
                font: 'Calibri',
                size: 21.5,
                color: '000000',
              }),
              new TextRun({
                text: 'distribuye en el país a algunas de las más importantes empresas fabricantes de medicamentos, insumos y dispositivos médicos del mundo, situación que avala su seriedad y profesionalismo en este campo.',
                font: 'Calibri',
                size: 21.5,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 220, line: 300 },
            children: [
              new TextRun({
                text: 'Contamos con personal calificado para brindarle una asesoría integral en todas las etapas de su adquisición, de manera que usted pueda satisfacer sus necesidades. Disponemos además de personal técnico, cuyos conocimientos incluyen una excelente preparación teórica y experiencia en el campo, lo que nos permite brindar una oportuna atención a todos nuestros clientes.',
                font: 'Calibri',
                size: 21.5,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200, line: 300 },
            children: [
              new TextRun({
                text: 'En caso de optar por nuestra propuesta, podrá estar seguro de que tendrá todo el respaldo que da nuestra amplia trayectoria a nivel nacional, bajo un marco de honestidad, calidad y profesionalismo. La expedición de la orden de compra mediante la cual se acepta la presente oferta mercantil supone el conocimiento y aceptación expresa de las condiciones contempladas en ella.',
                font: 'Calibri',
                size: 21.5,
                color: '000000',
              }),
            ],
          }),

          // SALTO DE PÁGINA A PÁGINA 2 (TABLA DE COTIZACIÓN)
          new Paragraph({
            children: [new PageBreak()],
          }),

          // ==================== PÁGINA 2: TABLA DE EQUIPOS Y PRECIOS ====================
          equipmentTable,
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({
                text: `VALOR TOTAL EN LETRAS (CON IVA ${Math.round((header.taxRate ?? 0.19) * 100)}%): `,
                bold: true,
                font: 'Calibri',
                size: 19,
                color: '000000',
              }),
              new TextRun({
                text: totalWords.toUpperCase(),
                bold: true,
                font: 'Calibri',
                size: 19,
                color: '000000',
              }),
            ],
          }),

          // ==================== CONDICIONES COMERCIALES Y FIRMA ====================
          new Paragraph({
            keepNext: true,
            spacing: { before: 180, after: 160 },
            children: [
              new TextRun({
                text: 'CONDICIONES COMERCIALES',
                bold: true,
                font: 'Calibri',
                size: 23,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180, line: 276 },
            children: [
              new TextRun({ text: 'Forma de pago: ', bold: true, font: 'Calibri', size: 21, color: '000000' }),
              new TextRun({ text: header.paymentTerms || '50% Anticipo y 50% Contra-entrega.', font: 'Calibri', size: 21, color: '000000' }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 180, line: 276 },
            children: [
              new TextRun({ text: 'Tiempo de entrega estimado: ', bold: true, font: 'Calibri', size: 21, color: '000000' }),
              new TextRun({
                text: `${header.deliveryTime || '90D'}. El tiempo de entrega será confirmado al momento de suscribir el contrato o recibir el anticipo, teniendo en cuenta la disponibilidad de fábrica de los equipos contados a partir de la aceptación de la propuesta en mención. El tiempo de entrega será prorrogable por mutuo acuerdo entre las partes, o en caso de que se presente alguna eventualidad en la entrega por parte del fabricante.`,
                font: 'Calibri',
                size: 21,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180, line: 276 },
            children: [
              new TextRun({ text: 'Capacitación: ', bold: true, font: 'Calibri', size: 21, color: '000000' }),
              new TextRun({
                text: header.trainingTerms || 'Un (1) día en la ubicación del equipo. Las fechas de las visitas serán acordadas entre las partes.',
                font: 'Calibri',
                size: 21,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 180, line: 276 },
            children: [
              new TextRun({ text: 'Mantenimiento: ', bold: true, font: 'Calibri', size: 21, color: '000000' }),
              new TextRun({
                text: header.maintenanceTerms || 'SYD COLOMBIA S.A. realizara un (1) mantenimiento preventivo por parte del Servicio Técnico de Nuestra Empresa por parte de un personal altamente calificado y entrenado, en apoyo de la marca para instalar y dar mantenimiento a esta clase de equipos.',
                font: 'Calibri',
                size: 21,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 140, line: 276 },
            children: [
              new TextRun({ text: 'Garantía: ', bold: true, font: 'Calibri', size: 21, color: '000000' }),
              new TextRun({
                text: header.warrantyTerms || 'Doce (12) meses contados a partir de la fecha de instalación del equipo.',
                font: 'Calibri',
                size: 21,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100, line: 276 },
            children: [
              new TextRun({
                text: 'Quedan exceptuados de esta garantía los siguientes casos:',
                font: 'Calibri',
                size: 21,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40, line: 260 },
            children: [
              new TextRun({
                text: 'Daños generados por la incorrecta operación, manipulación o cuidado de los sistemas.',
                font: 'Calibri',
                size: 20.5,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40, line: 260 },
            children: [
              new TextRun({
                text: 'Mal uso o abuso.',
                font: 'Calibri',
                size: 20.5,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 40, line: 260 },
            children: [
              new TextRun({
                text: 'Omisión al seguir las instrucciones de operación del equipo.',
                font: 'Calibri',
                size: 20.5,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 180, line: 260 },
            children: [
              new TextRun({
                text: 'Las anormalidades de energía eléctrica, instalación eléctrica inadecuada.',
                font: 'Calibri',
                size: 20.5,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 180, line: 276 },
            children: [
              new TextRun({ text: 'Transporte: ', bold: true, font: 'Calibri', size: 21, color: '000000' }),
              new TextRun({
                text: 'SYD COLOMBIA asume los gastos del envío de los equipos adquiridos adjudicados en la oferta',
                font: 'Calibri',
                size: 21,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 200, line: 276 },
            children: [
              new TextRun({ text: 'Validez De La Oferta: ', bold: true, font: 'Calibri', size: 21, color: '000000' }),
              new TextRun({
                text: `Treinta ${header.validityDays || 30} días calendario a partir de la fecha de entrega de la oferta`,
                font: 'Calibri',
                size: 21,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            keepNext: true,
            spacing: { after: 60 },
            children: [
              new TextRun({ text: 'Atentamente,', font: 'Calibri', size: 21, color: '000000' }),
            ],
          }),

          // Signature block with rendered image
          signatureInfo
            ? new Paragraph({
                keepNext: true,
                spacing: { after: 30 },
                children: [
                  new ImageRun({
                    type: signatureInfo.type,
                    data: signatureInfo.data,
                    transformation: {
                      width: 150,
                      height: 70,
                    },
                  }),
                ],
              })
            : new Paragraph({
                keepNext: true,
                spacing: { after: 40 },
                children: [
                  new TextRun({
                    text: 'Htu',
                    font: 'Brush Script MT',
                    size: 44,
                    color: '1E293B',
                  }),
                ],
              }),

          new Paragraph({
            keepNext: true,
            spacing: { after: 15 },
            children: [
              new TextRun({
                text: 'SUMINISTROS Y DOTACIONES COLOMBIA S.A.',
                bold: true,
                font: 'Calibri',
                size: 22,
                color: '000000',
              }),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Dpto. Mercadeo y Ventas',
                font: 'Calibri',
                size: 21,
                color: '334155',
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const clientClean = (header.clientName || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_');
  const fileName = `Cotizacion_${header.quoteNumber || '21082026-1'}_SYD_Colombia_${clientClean}.docx`;
  saveAs(blob, fileName);
};

export const exportTenderToWord = (header: any, items: any[], clientInfo?: any) => {
  const entity = header?.entityName || clientInfo?.clientName || 'ENTIDAD CONTRATANTE';
  const processNum = header?.processNumber || header?.tenderCode || 'LP-2026';
  const processType = header?.processType || 'Licitación Pública';
  const contractObj = header?.contractObject || header?.processTitle || 'SUMINISTRO DE EQUIPOS BIOMÉDICOS';
  const city = header?.city || 'Colombia';
  const nit = header?.nit || clientInfo?.nit || '';

  const renderItemRequirements = (item: any, itemIdx: number) => {
    if (item.requirements && Array.isArray(item.requirements) && item.requirements.length > 0) {
      return item.requirements
        .map(
          (req: any, rIdx: number) => {
            const cleanReqText = (req.requirement || '').replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, '');
            return `
          <tr style="font-size: 10pt; ${req.isUnique ? 'background-color: #fffbeb;' : ''}">
            <td align="center" style="padding: 7px 6px; border: 1px solid #94a3b8; font-weight: bold; background-color: ${req.isUnique ? '#fef3c7' : '#f8fafc'}; width: 8%; color: #0f172a;">${rIdx + 1}</td>
            <td style="padding: 7px 10px; border: 1px solid #94a3b8; color: #1e293b; line-height: 1.45;">
              ${req.isUnique ? '<span style="display:inline-block; font-size: 8.5pt; background-color: #fef3c7; color: #b45309; border: 1px solid #f59e0b; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-bottom: 4px;">CARACTERÍSTICA EXCLUSIVA / DIFERENCIAL TECNOLÓGICO</span><br/>' : ''}
              ${req.workRange ? `<span style="display:inline-block; font-size: 8.5pt; background-color: #eff6ff; color: #1e40af; border: 1px solid #93c5fd; padding: 2px 6px; border-radius: 3px; font-weight: bold; margin-bottom: 4px;">📊 RANGO DE TRABAJO: ${req.workRange}</span><br/>` : ''}
              ${cleanReqText}
            </td>
          </tr>
        `;
          }
        )
        .join('');
    } else {
      return `
        <tr style="font-size: 10pt;">
          <td align="center" style="padding: 7px 6px; border: 1px solid #94a3b8; font-weight: bold; width: 8%;">1</td>
          <td style="padding: 7px 10px; border: 1px solid #94a3b8; color: #1e293b;">${((item.requirementDescription || item.description || item.name) || '').replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, '')}</td>
        </tr>
      `;
    }
  };

  const tenderDoc = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>Especificaciones Técnicas - ${processNum}</title>
      <style>
        body { font-family: 'Calibri', 'Segoe UI', sans-serif; font-size: 11pt; color: #1e293b; line-height: 1.4; }
        h1 { font-size: 15pt; color: #0f2744; text-align: center; margin-bottom: 4px; text-transform: uppercase; font-weight: bold; }
        h2 { font-size: 12pt; color: #1e3a8a; text-align: center; margin-top: 0; margin-bottom: 15px; font-weight: normal; }
        .header-box { border: 1px solid #cbd5e1; background-color: #f8fafc; padding: 12px; margin-bottom: 20px; border-radius: 4px; font-size: 10pt; }
        .equipment-header { background-color: #0f2744; color: white; padding: 8px 12px; font-weight: bold; font-size: 11pt; margin-top: 18px; margin-bottom: 6px; border-radius: 3px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 16px; font-size: 10pt; }
        th { background-color: #1e3a8a; color: white; padding: 8px 10px; border: 1px solid #1e3a8a; text-align: left; }
        td { padding: 6px 10px; border: 1px solid #cbd5e1; vertical-align: top; }
        .footer { font-size: 9pt; color: #64748b; text-align: center; margin-top: 30px; border-top: 1px solid #cbd5e1; padding-top: 10px; }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 10px;">
        <span style="font-size: 18pt; font-weight: 900; color: #0284c7; letter-spacing: 2px;">SUMINISTROS Y DOTACIONES COLOMBIA S.A.</span><br/>
        <span style="font-size: 9.5pt; color: #64748b;">NIT: 900.284.182-1 • Especificaciones Técnicas de Equipos Biomédicos</span>
      </div>

      <h1>ANEXO TÉCNICO - ESPECIFICACIONES TÉCNICAS DE LOS EQUIPOS</h1>
      <h2>PROCESO DE SELECCIÓN: ${processNum}</h2>

      <div class="header-box">
        <table style="width: 100%; border: none; margin: 0; font-size: 10pt;">
          <tr>
            <td style="border: none; width: 22%; font-weight: bold; color: #334155;">ENTIDAD:</td>
            <td style="border: none; width: 78%; font-weight: bold; color: #0f172a;">${entity} ${nit ? `(NIT: ${nit})` : ''}</td>
          </tr>
          <tr>
            <td style="border: none; font-weight: bold; color: #334155;">MODALIDAD:</td>
            <td style="border: none;">${processType}</td>
          </tr>
          <tr>
            <td style="border: none; font-weight: bold; color: #334155;">OBJETO:</td>
            <td style="border: none;">${contractObj}</td>
          </tr>
          <tr>
            <td style="border: none; font-weight: bold; color: #334155;">CIUDAD / FECHA:</td>
            <td style="border: none;">${city} • Vigencia 2026</td>
          </tr>
        </table>
      </div>

      ${items
        .map((it, idx) => {
          return `
          <div class="equipment-header">
            ÍTEM ${idx + 1}: ${(it.name || 'EQUIPO BIOMÉDICO').toUpperCase()} — MARCA: ${(it.brand || '').toUpperCase()} / MODELO: ${(it.model || '').toUpperCase()}
          </div>
          <div style="font-size: 9.5pt; color: #334155; margin-bottom: 6px; padding: 4px 8px; background-color: #f1f5f9;">
            <strong>Registro INVIMA:</strong> ${it.invimaRecord || 'Vigente'} | 
            <strong>Garantía:</strong> ${it.warrantyMonths || 24} Meses | 
            <strong>Cantidad:</strong> ${it.quantity || 1} Unidades | 
            <strong>Origen:</strong> ${it.originCountry || 'Importado'}
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 8%; text-align: center;">N°</th>
                <th style="width: 92%;">ESPECIFICACIÓN / REQUISITO TÉCNICO</th>
              </tr>
            </thead>
            <tbody>
              ${renderItemRequirements(it, idx)}
            </tbody>
          </table>
        `;
        })
        .join('')}

      <div style="margin-top: 25px; page-break-inside: avoid;">
        <br/><br/>
        <table style="width: 100%; border: none; font-size: 10pt;">
          <tr>
            <td style="border: none; width: 50%;">
              ___________________________________________<br/>
              <strong>SUMINISTROS Y DOTACIONES COLOMBIA S.A.</strong><br/>
              Departamento Técnico y Biomédico<br/>
              NIT: 900.284.182-1
            </td>
            <td style="border: none; width: 50%; text-align: right;">
              Fecha de Emisión: ${new Date().toLocaleDateString('es-CO')}<br/>
              Firma y Sello Técnico Autorizado
            </td>
          </tr>
        </table>
      </div>

      <div class="footer">
        Documento técnico generado por el Sistema de Gestión SYD Colombia S.A.
      </div>
    </body>
    </html>
  `;

  const blob = new Blob(['\ufeff' + tenderDoc], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const cleanEntity = (entity || 'Entidad').replace(/[^a-zA-Z0-9]/g, '_');
  link.download = `Especificaciones_Tecnicas_${processNum}_${cleanEntity}.doc`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportTenderComparativeToWord = exportTenderToWord;

export const exportTenderToExcel = async (header: any, items: any[], clientInfo?: any) => {
  const entity = header?.entityName || clientInfo?.clientName || 'ENTIDAD CONTRATANTE';
  const nit = header?.nit || clientInfo?.nit || 'N/A';
  const processNum = header?.processNumber || header?.tenderCode || 'LP-2026';
  const processType = header?.processType || 'Licitación Pública / Selección Abreviada';
  const city = header?.city || 'Colombia';
  const objectDesc = header?.objectDescription || 'Dotación y suministro de equipamiento médico y biomédico hospitalario';

  try {
    const XLSX = await import('xlsx');

    // Build structured data array
    const dataRows: any[] = [];

    // Header info rows
    dataRows.push(['SUMINISTROS Y DOTACIONES COLOMBIA S.A. - ESPECIFICACIONES TÉCNICAS']);
    dataRows.push(['NIT: 900.284.182-1 | DEPARTAMENTO TÉCNICO Y BIOMÉDICO']);
    dataRows.push([]);
    dataRows.push(['ENTIDAD / CLIENTE:', entity]);
    dataRows.push(['NIT CLIENTE:', nit]);
    dataRows.push(['NÚMERO DE PROCESO:', processNum]);
    dataRows.push(['MODALIDAD:', processType]);
    dataRows.push(['CIUDAD / MUNICIPIO:', city]);
    dataRows.push(['OBJETO CONTRACTUAL:', objectDesc]);
    dataRows.push(['FECHA DE EXPORTACIÓN:', new Date().toLocaleDateString('es-CO')]);
    dataRows.push([]);

    // Column Headers
    dataRows.push([
      'ÍTEM N°',
      'EQUIPO BIOMÉDICO',
      'MARCA',
      'MODELO',
      'CANTIDAD',
      'REGISTRO INVIMA',
      'GARANTÍA (MESES)',
      'PAÍS DE ORIGEN',
      'REQ. N°',
      'ESPECIFICACIÓN / REQUISITO TÉCNICO',
      '¿CARACTERÍSTICA ÚNICA / EXCLUSIVA?',
      'RANGO DE TRABAJO OPERATIVO'
    ]);

    items.forEach((it: any, itIdx: number) => {
      const itemNum = itIdx + 1;
      const reqList = it.requirements && Array.isArray(it.requirements) && it.requirements.length > 0
        ? it.requirements
        : [{ requirement: it.requirementDescription || it.name, isUnique: false, workRange: '' }];

      reqList.forEach((req: any, rIdx: number) => {
        const cleanReqText = (req.requirement || '').replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, '');
        dataRows.push([
          itemNum,
          it.name || '',
          it.brand || '',
          it.model || '',
          it.quantity || 1,
          it.invimaRecord || 'Vigente',
          it.warrantyMonths || 24,
          it.originCountry || 'Importado',
          rIdx + 1,
          cleanReqText,
          req.isUnique ? 'SÍ (Exclusiva / Diferencial)' : 'NO',
          req.workRange || 'N/A'
        ]);
      });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(dataRows);

    // Set column widths
    worksheet['!cols'] = [
      { wch: 9 },  // Item N°
      { wch: 32 }, // Equipo
      { wch: 18 }, // Marca
      { wch: 18 }, // Modelo
      { wch: 10 }, // Cantidad
      { wch: 22 }, // INVIMA
      { wch: 16 }, // Garantía
      { wch: 16 }, // Origen
      { wch: 9 },  // Req N°
      { wch: 60 }, // Especificación
      { wch: 30 }, // Única
      { wch: 26 }  // Rango
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Especificaciones Técnicas');

    const cleanEntity = (entity || 'Entidad').replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Especificaciones_Tecnicas_${processNum}_${cleanEntity}.xlsx`;

    XLSX.writeFile(workbook, fileName);
  } catch (err) {
    console.error('Error exporting with XLSX, falling back to table HTML format', err);
    // Fallback if needed
    let rowsHtml = '';
    items.forEach((it: any, itIdx: number) => {
      if (it.requirements && Array.isArray(it.requirements) && it.requirements.length > 0) {
        it.requirements.forEach((req: any, rIdx: number) => {
          rowsHtml += `
            <tr style="${req.isUnique ? 'background-color: #fef3c7;' : ''}">
              <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold; ${req.isUnique ? 'background-color: #fde68a; color: #92400e;' : ''}">${rIdx + 1}</td>
              <td style="border: 1px solid #cbd5e1;">${it.name || ''}</td>
              <td style="border: 1px solid #cbd5e1; text-align: center;">${it.brand || ''} ${it.model || ''}</td>
              <td style="border: 1px solid #cbd5e1; text-align: center;">${it.quantity || 1}</td>
              <td style="border: 1px solid #cbd5e1;">${it.invimaRecord || ''}</td>
              <td style="border: 1px solid #cbd5e1;">${req.isUnique ? '[CARACTERÍSTICA EXCLUSIVA / DIFERENCIAL]: ' : ''}${req.workRange ? `[📊 RANGO: ${req.workRange}] ` : ''}${(req.requirement || '').replace(/^[⭐★*]\s*/, '').replace(/[⭐★]/g, '')}</td>
            </tr>
          `;
        });
      } else {
        rowsHtml += `
          <tr>
            <td style="border: 1px solid #cbd5e1; text-align: center; font-weight: bold;">1</td>
            <td style="border: 1px solid #cbd5e1;">${it.name || ''}</td>
            <td style="border: 1px solid #cbd5e1; text-align: center;">${it.brand || ''} ${it.model || ''}</td>
            <td style="border: 1px solid #cbd5e1; text-align: center;">${it.quantity || 1}</td>
            <td style="border: 1px solid #cbd5e1;">${it.invimaRecord || ''}</td>
            <td style="border: 1px solid #cbd5e1;">${it.requirementDescription || it.name}</td>
          </tr>
        `;
      }
    });

    const tableContent = `
      <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: Arial, sans-serif;">
        <table>
          <tr>
            <th colspan="6" style="background-color: #0f2744; color: #ffffff; font-size: 14pt; padding: 10px;">
              SUMINISTROS Y DOTACIONES COLOMBIA S.A. - ESPECIFICACIONES TÉCNICAS
            </th>
          </tr>
          <tr>
            <th colspan="6" style="background-color: #1e3a8a; color: #ffffff; font-size: 11pt; padding: 6px;">
              CLIENTE / ENTIDAD: ${entity} | PROCESO: ${processNum}
            </th>
          </tr>
          <tr style="background-color: #e2e8f0; font-weight: bold; text-align: center;">
            <th style="border: 1px solid #94a3b8; padding: 6px; width: 40px;">N°</th>
            <th style="border: 1px solid #94a3b8; padding: 6px;">Equipo Biomédico</th>
            <th style="border: 1px solid #94a3b8; padding: 6px;">Marca / Modelo</th>
            <th style="border: 1px solid #94a3b8; padding: 6px; width: 50px;">Cant.</th>
            <th style="border: 1px solid #94a3b8; padding: 6px;">Reg. INVIMA</th>
            <th style="border: 1px solid #94a3b8; padding: 6px;">Especificación / Requisito Técnico</th>
          </tr>
          ${rowsHtml}
        </table>
      </body>
      </html>
    `;
    const blob = new Blob(['\ufeff' + tableContent], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanEntity = (entity || 'Entidad').replace(/[^a-zA-Z0-9]/g, '_');
    link.download = `Especificaciones_Tecnicas_${processNum}_${cleanEntity}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};

