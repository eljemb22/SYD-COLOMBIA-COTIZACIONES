/**
 * High-fidelity email table and content parser.
 * Accurately extracts and reconstructs tabular data from HTML or text emails,
 * preserving tables (such as the standard SYD purchasing table with columns:
 * parte | proveedor | descripción | marca | referencia | precio | iva | cantidad | observación)
 * exactly as they appear in the original email client.
 */

import { isSignatureOrHeaderOrNoise, isMedicalEquipmentOrSupply } from './medicalEquipmentNoiseFilter';
import { cleanSupplierName } from './cleanSupplierUtils';
import { MASTER_EQUIPMENTS_CATALOG } from '../data/masterEquipmentsCatalog';
export { cleanSupplierName };

export interface TableRowData {
  cells: string[];
}

export interface TableData {
  headers: string[];
  rows: TableRowData[];
  title?: string;
}

export type EmailBlock =
  | { type: 'text'; content: string }
  | { type: 'table'; table: TableData };

/**
 * Standard headers expected in SYD purchasing & parts emails
 */
export const STANDARD_PURCHASING_HEADERS = [
  'parte',
  'proveedor',
  'descripción',
  'marca',
  'referencia',
  'precio',
  'iva',
  'cantidad',
  'observación',
];

/**
 * Parses raw text or HTML into structured blocks of text and tables.
 */
export function parseEmailContentToBlocks(rawText: string = '', rawHtml?: string): EmailBlock[] {
  // 1. If rawHtml is present and has <table>, extract HTML tables first
  if (rawHtml && /<table\b[^>]*>/i.test(rawHtml)) {
    const htmlBlocks = parseBlocksFromHtml(rawHtml);
    if (htmlBlocks.length > 0 && htmlBlocks.some((b) => b.type === 'table')) {
      return htmlBlocks;
    }
  }

  // 2. If rawText itself contains HTML <table> tags
  if (/<table\b[^>]*>/i.test(rawText)) {
    const htmlBlocks = parseBlocksFromHtml(rawText);
    if (htmlBlocks.length > 0 && htmlBlocks.some((b) => b.type === 'table')) {
      return htmlBlocks;
    }
  }

  // 3. Check for the standard SYD Purchasing table in plain text
  // Pattern: parte proveedor descripción marca referencia precio iva cantidad observación
  const purchasingTableBlock = parsePurchasingTableFromText(rawText);
  if (purchasingTableBlock) {
    return purchasingTableBlock;
  }

  // 4. Check for tab-separated or pipe-separated tables in text
  const tabOrPipeTable = parseDelimitedTableFromText(rawText);
  if (tabOrPipeTable) {
    return tabOrPipeTable;
  }

  // 5. Default: return single clean text block
  return [{ type: 'text', content: rawText }];
}

/**
 * Parses HTML content into text and table blocks
 */
function parseBlocksFromHtml(html: string): EmailBlock[] {
  const blocks: EmailBlock[] = [];
  const tableRegex = /<table\b[^>]*>([\s\S]*?)<\/table>/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tableRegex.exec(html)) !== null) {
    const textBefore = html.substring(lastIndex, match.index);
    const cleanBefore = cleanHtmlFragment(textBefore);
    if (cleanBefore.trim()) {
      blocks.push({ type: 'text', content: cleanBefore.trim() });
    }

    const tableHtml = match[1];
    const parsedTable = extractTableFromHtmlSnippet(tableHtml);
    if (parsedTable && parsedTable.rows.length > 0) {
      blocks.push({ type: 'table', table: parsedTable });
    } else {
      // Fallback if table was empty or unparseable
      const tableText = cleanHtmlFragment(match[0]);
      if (tableText.trim()) {
        blocks.push({ type: 'text', content: tableText.trim() });
      }
    }

    lastIndex = tableRegex.lastIndex;
  }

  const textAfter = html.substring(lastIndex);
  const cleanAfter = cleanHtmlFragment(textAfter);
  if (cleanAfter.trim()) {
    blocks.push({ type: 'text', content: cleanAfter.trim() });
  }

  return blocks;
}

/**
 * Extracts headers and rows from inside <table>...</table>
 */
function extractTableFromHtmlSnippet(tableInnerHtml: string): TableData | null {
  const trRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  const rows: string[][] = [];
  let trMatch: RegExpExecArray | null;

  while ((trMatch = trRegex.exec(tableInnerHtml)) !== null) {
    const rowContent = trMatch[1];
    const cellRegex = /<(?:th|td)\b[^>]*>([\s\S]*?)<\/(?:th|td)>/gi;
    const cells: string[] = [];
    let cMatch: RegExpExecArray | null;

    while ((cMatch = cellRegex.exec(rowContent)) !== null) {
      const cellText = cMatch[1]
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
      cells.push(cellText);
    }

    if (cells.length > 0 && cells.some((c) => c.length > 0)) {
      rows.push(cells);
    }
  }

  if (rows.length === 0) return null;

  // Header detection: find which row contains table headers (avoid title/logo rows)
  const HEADER_KEYWORDS = [
    'parte', 'codigo', 'código', 'cod', 'proveedor', 'tercero', 'descripcion', 'descripción',
    'detalle', 'concepto', 'articulo', 'artículo', 'marca', 'referencia', 'modelo', 'ref',
    'precio', 'costo', 'valor', 'vr', 'vlr', 'iva', 'tarifa', 'cant', 'cantidad', 'und', 'unidad',
    'total', 'observacion', 'observación', 'item', 'ítem', 'sub-ref', 'componente'
  ];

  let bestHeaderIndex = 0;
  let maxScore = -1;

  for (let i = 0; i < Math.min(rows.length, 4); i++) {
    const row = rows[i];
    let score = 0;
    for (const cell of row) {
      const lower = cell.toLowerCase().trim();
      if (HEADER_KEYWORDS.some((kw) => lower.includes(kw))) {
        score++;
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestHeaderIndex = i;
    }
  }

  let headers: string[];
  let dataRows: TableRowData[];

  if (maxScore > 0) {
    headers = rows[bestHeaderIndex];
    dataRows = rows.slice(bestHeaderIndex + 1).map((r) => ({ cells: r }));
  } else {
    // If no explicit header row detected, do not lose the first data row; use standard purchasing headers
    headers = [...STANDARD_PURCHASING_HEADERS];
    dataRows = rows.map((r) => ({ cells: r }));
  }

  return {
    headers,
    rows: dataRows,
  };
}

/**
 * Cleans non-table HTML fragment into readable text with newlines
 */
function cleanHtmlFragment(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<!--[\s\S]*?-->/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Parses plain text that contains the SYD purchasing table header:
 * 'parte proveedor descripción marca referencia precio iva cantidad observación'
 */
function parsePurchasingTableFromText(rawText: string): EmailBlock[] | null {
  // Regex to match the header even if there are variable spaces or linebreaks, with or without observacion
  const headerRegex = /parte\s+proveedor\s+descripci[oó]n\s+marca\s+referencia\s+precio\s+iva\s+cantidad(?:\s+observaci[oó]n)?/i;
  const match = rawText.match(headerRegex);
  if (!match) return null;

  const headerIndex = match.index!;
  const beforeText = rawText.substring(0, headerIndex).trim();
  const restText = rawText.substring(headerIndex + match[0].length).trim();

  const lines = restText.split('\n');
  const rows: TableRowData[] = [];
  const afterLines: string[] = [];
  let inTable = true;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (inTable) {
      const parsedRow = parsePurchasingRowLine(trimmed);
      if (parsedRow) {
        rows.push(parsedRow);
      } else {
        // Stop table parsing when reaching end of table rows
        inTable = false;
        afterLines.push(line);
      }
    } else {
      afterLines.push(line);
    }
  }

  // If no rows parsed, return null to fallback
  if (rows.length === 0) return null;

  const blocks: EmailBlock[] = [];
  if (beforeText) {
    blocks.push({ type: 'text', content: beforeText });
  }

  blocks.push({
    type: 'table',
    table: {
      headers: [...STANDARD_PURCHASING_HEADERS],
      rows,
    },
  });

  const afterText = afterLines.join('\n').trim();
  if (afterText) {
    blocks.push({ type: 'text', content: afterText });
  }

  return blocks;
}

/**
 * Parses an individual row line into the 9 purchasing columns
 */
function parsePurchasingRowLine(line: string): TableRowData | null {
  // Look for price + iva + cantidad pattern at the end:
  // e.g.: $ 779.600 19% 5 UNIDAD CON lote
  // or: 779.600 19% 5 UNIDAD
  const priceIvaMatch = line.match(/\s+(\$\s*[\d.,]{3,15})\s+(\d{1,2}%)\s+(\d+)\s*(.*)$/i);
  if (!priceIvaMatch) {
    // Also try without $ sign
    const noDollarMatch = line.match(/\s+([\d.]{4,12})\s+(\d{1,2}%)\s+(\d+)\s*(.*)$/i);
    if (!noDollarMatch) return null;

    const price = `$ ${noDollarMatch[1].trim()}`;
    const iva = noDollarMatch[2].trim();
    const cant = noDollarMatch[3].trim();
    const obs = noDollarMatch[4].trim();
    const leftPart = line.substring(0, noDollarMatch.index).trim();
    return parseLeftPartAndAssemble(leftPart, price, iva, cant, obs);
  }

  const price = priceIvaMatch[1].trim();
  const iva = priceIvaMatch[2].trim();
  const cant = priceIvaMatch[3].trim();
  const obs = priceIvaMatch[4].trim();
  const leftPart = line.substring(0, priceIvaMatch.index).trim();

  return parseLeftPartAndAssemble(leftPart, price, iva, cant, obs);
}

function parseLeftPartAndAssemble(
  leftPart: string,
  price: string,
  iva: string,
  cant: string,
  obs: string
): TableRowData | null {
  // Reference is typically the last token in leftPart (e.g. IVS-0008-10, 900MR030-G, 900RD301)
  const refMatch = leftPart.match(/\s+([A-Za-z0-9\-_/]{3,25})$/);
  if (!refMatch) return null;

  const referencia = refMatch[1].trim();
  const beforeRef = leftPart.substring(0, refMatch.index).trim();

  // Check if starts with a numeric part code (e.g. 70859)
  let parte = '';
  let rest = beforeRef;
  const parteMatch = beforeRef.match(/^(\d{4,8})\s+(.*)$/);
  if (parteMatch) {
    parte = parteMatch[1];
    rest = parteMatch[2];
  }

  // Split rest into supplier and description
  let proveedor = '';
  let descripcion = rest;

  // Patterns like "P331 TECNICA ELECTROMEDICA S.A."
  const pCodeSupplierMatch = rest.match(/^(P\d+\s+[A-Z\s\.]+?)\s+([A-Z0-9\s/].*)$/i);
  if (pCodeSupplierMatch) {
    proveedor = cleanSupplierName(pCodeSupplierMatch[1]);
    descripcion = pCodeSupplierMatch[2].trim();
  } else {
    // S.A. / S.A.S. pattern
    const saSupplierMatch = rest.match(/^([A-Z\s\.]+(?:S\.A\.|S\.A\.S\.|LTDA\.?))\s+(.*)$/i);
    if (saSupplierMatch) {
      proveedor = cleanSupplierName(saSupplierMatch[1]);
      descripcion = saSupplierMatch[2].trim();
    }
  }

  return {
    cells: [parte, proveedor, descripcion, '', referencia, price, iva, cant, obs],
  };
}

/**
 * Checks for tab-delimited or pipe-delimited tables in text
 */
function parseDelimitedTableFromText(rawText: string): EmailBlock[] | null {
  const lines = rawText.split('\n');
  let tableStartIndex = -1;
  let tableEndIndex = -1;
  let delimiter: '\t' | '|' | null = null;
  let columnCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (!l) continue;

    if (l.includes('\t') && l.split('\t').length >= 3) {
      if (tableStartIndex === -1) {
        tableStartIndex = i;
        delimiter = '\t';
        columnCount = l.split('\t').length;
      }
    } else if (l.includes('|') && l.split('|').map((c) => c.trim()).filter(Boolean).length >= 3) {
      if (tableStartIndex === -1) {
        tableStartIndex = i;
        delimiter = '|';
        columnCount = l.split('|').map((c) => c.trim()).filter(Boolean).length;
      }
    } else {
      if (tableStartIndex !== -1) {
        tableEndIndex = i;
        break;
      }
    }
  }

  if (tableStartIndex === -1) return null;
  if (tableEndIndex === -1) tableEndIndex = lines.length;

  const tableLines = lines.slice(tableStartIndex, tableEndIndex).filter((l) => l.trim().length > 0);
  if (tableLines.length < 2) return null;

  const beforeLines = lines.slice(0, tableStartIndex).join('\n').trim();
  const afterLines = lines.slice(tableEndIndex).join('\n').trim();

  let headers: string[] = [];
  const rows: TableRowData[] = [];

  if (delimiter === '\t') {
    headers = tableLines[0].split('\t').map((c) => c.trim());
    for (let i = 1; i < tableLines.length; i++) {
      rows.push({ cells: tableLines[i].split('\t').map((c) => c.trim()) });
    }
  } else if (delimiter === '|') {
    const cleanCells = (line: string) => {
      const tokens = line.split('|').map((c) => c.trim());
      if (tokens.length > 0 && tokens[0] === '') tokens.shift();
      if (tokens.length > 0 && tokens[tokens.length - 1] === '') tokens.pop();
      return tokens;
    };

    const firstRowCells = cleanCells(tableLines[0]);
    // Determine if first line is a true column header or already a data item row
    const isHeaderLine =
      firstRowCells.some((c) =>
        /^(?:item|c[oó]digo|codigo|descripci[oó]n|descripcion|detalle|concepto|producto|equipo|parte|cantidad|cant|precio|valor|vr\.?\s*unit|total|proveedor|marca|referencia|ref)$/i.test(c)
      ) &&
      !firstRowCells.some((c) => /^\d+[\.\)]\s*/.test(c) || /\$\s*[\d\.]+/i.test(c) || /refs?:/i.test(c));

    if (isHeaderLine) {
      headers = firstRowCells;
      const startRow = tableLines[1] && tableLines[1].includes('---') ? 2 : 1;
      for (let i = startRow; i < tableLines.length; i++) {
        const c = cleanCells(tableLines[i]);
        if (c.length > 0 && !tableLines[i].includes('---')) {
          rows.push({ cells: c });
        }
      }
    } else {
      // Pipe-delimited list of items without a header row
      headers = ['Sub-Referencias', 'Descripción', 'Cantidad', 'Precio'];
      for (let i = 0; i < tableLines.length; i++) {
        const c = cleanCells(tableLines[i]);
        if (c.length > 0 && !tableLines[i].includes('---')) {
          rows.push({ cells: c });
        }
      }
    }
  }

  if (rows.length === 0) return null;

  const blocks: EmailBlock[] = [];
  if (beforeLines) {
    blocks.push({ type: 'text', content: beforeLines });
  }

  blocks.push({
    type: 'table',
    table: { headers, rows },
  });

  if (afterLines) {
    blocks.push({ type: 'text', content: afterLines });
  }

  return blocks;
}

export interface StructuredEmailRow {
  code?: string;
  supplier?: string;
  description: string;
  brand?: string;
  modelOrRef?: string;
  subReferences?: string;
  unitPrice?: number;
  taxRate?: number;
  taxExempt?: boolean;
  quantity?: number;
  totalPrice?: number;
  observation?: string;
  notes?: string;
  rawCells?: string[];
}

/**
 * Cleanly parse Colombian COP or numeric currency from strings like "$ 4.325.665", "3.912.941,00", "$ 185.000 + IVA"
 */
export function parseCurrencyCOP(valStr?: string): number {
  if (!valStr) return 0;
  const cleaned = valStr
    .replace(/[$\sCOPcop]/g, '')
    .replace(/\+?\s*iva.*$/i, '')
    .trim();
  if (!cleaned) return 0;

  let numStr = cleaned;
  // Handle Colombian decimal formatting: "3.912.941,00" or "4.325.665"
  if (/,\d{2}$/.test(numStr)) {
    numStr = numStr.slice(0, -3).replace(/\./g, '');
  } else if (/\.\d{2}$/.test(numStr) && numStr.includes(',')) {
    numStr = numStr.slice(0, -3).replace(/,/g, '');
  } else {
    // If has dots separating thousands (e.g. 4.325.665)
    numStr = numStr.replace(/[.,]/g, '');
  }
  const n = parseFloat(numStr);
  return isNaN(n) ? 0 : n;
}

/**
 * Parses integer quantity from strings like "1", "2 und", "Cant: 5", "5 UNIDADES"
 */
export function parseQuantity(valStr?: string): number {
  if (!valStr) return 1;
  const match = valStr.match(/\b\d+\b/);
  if (match) {
    const q = parseInt(match[0], 10);
    return q > 0 ? q : 1;
  }
  return 1;
}

/**
 * Extracts all structured rows (parts, items, products) from HTML or text email bodies.
 * Supports:
 * 1. HTML and Markdown tables
 * 2. Key-Value item blocks (e.g., "Parte: 70859\nDescripción: ...\nPrecio: ...")
 * 3. Delimited text lines and numbered items (e.g. "1. 70859 - Laringoscopio...")
 */
export function extractStructuredRowsFromEmail(rawText: string = '', rawHtml?: string): StructuredEmailRow[] {
  const structuredRows: StructuredEmailRow[] = [];
  const blocks = parseEmailContentToBlocks(rawText, rawHtml);

  // 1. Process structured tables
  const tableBlocks = blocks.filter((b): b is { type: 'table'; table: TableData } => b.type === 'table');
  for (const tb of tableBlocks) {
    const { headers, rows } = tb.table;
    let codeCol = -1;
    let supplierCol = -1;
    let descCol = -1;
    let brandCol = -1;
    let refCol = -1;
    let subRefCol = -1;
    let priceCol = -1;
    let taxCol = -1;
    let qtyCol = -1;
    let totalCol = -1;
    let obsCol = -1;

    headers.forEach((h, idx) => {
      const cleanH = h.toLowerCase().trim().replace(/^[#\*\-•\s]+/, '').replace(/[:\.\-_]+$/, '');
      if (/^(?:parte|partes|c[oó]digo|codigo|c[oó]d|cod|no\.?\s*parte|part\s*no|item\s*code|c[oó]digo\s*(?:de\s*)?parte|ref\.?\s*parte|id\s*parte|c[oó]digo\s+creado|n[oº°]\.?\s*parte|n[oº°]\.?|item|ítem)$/i.test(cleanH) || /(?:c[oó]digo\s*de\s*parte|c[oó]digo\s*parte|n[oº°]\.?\s*parte|no\.?\s*parte)/i.test(cleanH)) {
        codeCol = idx;
      } else if (/proveedor|tercero|vendor|fabricante|distribuidor|empresa|casa\s*comercial|laboratorio/i.test(cleanH)) {
        supplierCol = idx;
      } else if (/descripci[oó]n|descripcion|detalle|concepto|equipo|dispositivo|producto|bien|art[ií]culo|nombre/i.test(cleanH)) {
        descCol = idx;
      } else if (/^marca|brand/i.test(cleanH)) {
        brandCol = idx;
      } else if (/referencia|modelo|cat[aá]logo|ref\b|model\b|mod\b/i.test(cleanH)) {
        refCol = idx;
      } else if (/sub-?ref|componente|accesorios?|desglose|subreferencia/i.test(cleanH)) {
        subRefCol = idx;
      } else if (/precio|costo|vr\b|vlr\b|valor|p\.?\s*unit|unit\s*price|importe/i.test(cleanH)) {
        priceCol = idx;
      } else if (/iva|impuesto|tarifa|exento|tax/i.test(cleanH)) {
        taxCol = idx;
      } else if (/cant|cantidad|qty|und|unidad|unidades/i.test(cleanH)) {
        qtyCol = idx;
      } else if (/total|vr\.?\s*total|vlr\.?\s*total|valor\s*total|importe|subtotal|total\s*cop/i.test(cleanH)) {
        totalCol = idx;
      } else if (/observaci|nota|comentario|obs\b/i.test(cleanH)) {
        obsCol = idx;
      }
    });

    // Fallback: If no descCol identified, find the widest textual column that is not already identified
    if (descCol === -1) {
      descCol = headers.findIndex((h, idx) => idx !== codeCol && idx !== priceCol && idx !== qtyCol && idx !== totalCol && idx !== supplierCol && idx !== brandCol && idx !== refCol && idx !== taxCol);
      if (descCol === -1) descCol = 0;
    }

    for (const r of rows) {
      const cells = r.cells.map((c) => c.replace(/^[>\s*•#]+/, '').trim());
      if (!cells || cells.length === 0) continue;

      let code = codeCol >= 0 && cells[codeCol] ? cells[codeCol].trim() : '';
      if (code === '-' || code === 'N/A' || code === '.' || code === '--' || code === 'PENDIENTE') {
        code = '';
      }
      // If code cell is empty or just a sequential counter like "1", look for 4-8 digit code or SYD code in non-price cells
      if (!code || /^\d{1,3}$/.test(code) || !/^\d{4,8}$|^SYD-/i.test(code)) {
        const found = cells.find((c, cIdx) =>
          cIdx !== priceCol && cIdx !== totalCol && cIdx !== subRefCol && cIdx !== descCol &&
          (/^\d{4,8}$|^SYD-[A-Z0-9\-_]{2,12}$/i.test(c.trim()))
        );
        if (found) {
          code = found.trim();
        }
      }

      let description = descCol >= 0 && cells[descCol] ? cells[descCol].trim() : '';

      // Check if description cell is actually a list of reference numbers (e.g. "Refs: 33681 13401..." or "11259 62733 11256...")
      const isSubRefCell = (val: string) =>
        /^(?:\d+[\.\)]\s*)?refs?\s*[:=]/i.test(val) ||
        /^(?:\d{4,7}\s+){2,}\d{4,7}$/.test(val) ||
        /^(?:\d{4,7}[,\s]+){2,}\d{4,7}$/.test(val);

      let subReferences: string | undefined = subRefCol >= 0 && cells[subRefCol] ? cells[subRefCol].trim() : undefined;

      if (!subReferences) {
        for (const c of cells) {
          if (isSubRefCell(c)) {
            subReferences = c.replace(/^(?:\d+[\.\)]\s*)?refs?\s*[:=]\s*/i, '').trim();
            break;
          }
          const subMatch = c.match(/\b(?:\d{4,6}\s+){2,}\d{4,6}\b/);
          if (subMatch) {
            subReferences = subMatch[0].trim();
            break;
          }
        }
      }

      // If description was empty, too short, or captured the sub-references numbers cell, find the true textual description cell
      if (!description || description.length < 3 || isSubRefCell(description)) {
        if (isSubRefCell(description) && !subReferences) {
          subReferences = description.replace(/^(?:\d+[\.\)]\s*)?refs?\s*[:=]\s*/i, '').trim();
        }
        // Find cell with equipment title (has letters and words, not purely numbers or price)
        const textualCell = cells.find(
          (c) =>
            !isSubRefCell(c) &&
            /[a-záéíóúñ]{4,}/i.test(c) &&
            !/^(?:cant|precio|total|iva|exento)/i.test(c.trim()) &&
            !/^\$\s*[\d\.]+/i.test(c.trim()) &&
            !/^(?:item|c[oó]digo|codigo|descripci[oó]n|descripcion)$/i.test(c.trim())
        );
        if (textualCell) {
          description = textualCell.trim();
        } else {
          // Fallback to longest text
          const longest = [...cells].sort((a, b) => b.length - a.length)[0];
          if (longest && longest.length >= 3) description = longest.trim();
        }
      }

      // Clean leading numbering like "1. ", "2. " from description
      description = description.replace(/^\d+[\.\)]\s*/, '').trim();

      // Skip header rows accidentally in body
      if (/^(?:descripci[oó]n|descripcion|equipo|parte|c[oó]digo|codigo|item|sub-referencias)$/i.test(description)) continue;

      let supplier = supplierCol >= 0 && cells[supplierCol] ? cells[supplierCol].trim() : undefined;
      let brand = brandCol >= 0 && cells[brandCol] ? cells[brandCol].trim() : undefined;
      let modelOrRef = refCol >= 0 && cells[refCol] ? cells[refCol].trim() : undefined;

      // Extract details embedded inside any cell (e.g. "Cant: 1", "$ 4.325.665+IVA", "MARCA: KAWE")
      let unitPrice = priceCol >= 0 ? parseCurrencyCOP(cells[priceCol]) : 0;
      let quantity = qtyCol >= 0 ? parseQuantity(cells[qtyCol]) : 1;
      let taxCell = taxCol >= 0 && cells[taxCol] ? cells[taxCol].trim() : '';

      for (const c of cells) {
        const cantMatch = c.match(/^cant(?:idad)?\s*[:=]?\s*(\d+)/i);
        if (cantMatch && qtyCol < 0) {
          quantity = parseInt(cantMatch[1], 10) || 1;
        }
        const priceMatch = c.match(/\$\s*([\d\.,]+)/);
        if (priceMatch && unitPrice === 0) {
          unitPrice = parseCurrencyCOP(priceMatch[1]);
          if (/\+?\s*iva/i.test(c)) taxCell = '19%';
          if (/exento/i.test(c)) taxCell = '0%';
        }
        const marcaMatch = c.match(/marca\s*[:=]\s*([a-záéíóúñ0-9\s\-]+)/i);
        if (marcaMatch && !brand) {
          brand = marcaMatch[1].trim();
        }
        const provMatch = c.match(/proveedor\s*[:=]\s*([a-záéíóúñ0-9\s\-]+)/i);
        if (provMatch && !supplier) {
          supplier = cleanSupplierName(provMatch[1]);
        }
        if (!brand) {
          const knownBrandMatch = c.match(/\b(MINDRAY|KAWE|WELCH\s*ALLYN|RIESTER|PHILIPS|GE|DRAGER|COVIDIEN|MEDTRONIC|EDAN|BIOLIGHT|CHOICEMMED)\b/i);
          if (knownBrandMatch) brand = knownBrandMatch[1].toUpperCase();
        }
        if (!supplier) {
          const knownSupMatch = c.match(/\b(CORALMEDICA|TECNICA\s+ELECTROMEDICA|IMPORMEDICAL|DISTRIBUIDORA\s+MEDICA|SUMINISTRO\s+Y\s+DOTACIONES)\b/i);
          if (knownSupMatch) supplier = cleanSupplierName(knownSupMatch[1].toUpperCase());
        }
      }

      const taxExempt = /exento|0%/i.test(taxCell);
      const taxRate = taxExempt ? 0 : 0.19;
      const totalPrice = totalCol >= 0 ? parseCurrencyCOP(cells[totalCol]) : (unitPrice > 0 ? unitPrice * quantity : 0);
      const observation = obsCol >= 0 && cells[obsCol] ? cells[obsCol].trim() : undefined;

      if (description && description.length >= 3) {
        structuredRows.push({
          code: code || undefined,
          supplier,
          description,
          brand,
          modelOrRef,
          subReferences,
          unitPrice,
          taxRate,
          taxExempt,
          quantity,
          totalPrice,
          observation,
          rawCells: cells,
        });
      }
    }
  }

  // 2. Process Key-Value item blocks in text (e.g., Parte: 70859\nDescripción: ...\nPrecio: ...)
  if (structuredRows.length === 0) {
    const rawLines = (rawText + '\n' + (rawHtml ? cleanHtmlFragment(rawHtml) : '')).split('\n');
    let currentBlock: Partial<StructuredEmailRow> | null = null;

    const commitBlock = () => {
      if (currentBlock && (currentBlock.description || currentBlock.code)) {
        if (currentBlock.description && /^\d+$/.test(currentBlock.description.trim())) {
          if (!currentBlock.code) {
            currentBlock.code = currentBlock.description.trim();
          }
          currentBlock.description = undefined;
        }

        if (!currentBlock.description && currentBlock.code) {
          currentBlock.description = `Parte Oficial (${currentBlock.code})`;
        }
        let desc = currentBlock.description?.trim();
        // If description is conversational noise, greetings, or header, but we have a valid part code, recover using catalog or clean fallback
        if ((!desc || isSignatureOrHeaderOrNoise(desc) || desc.length < 3 || /^\d+$/.test(desc)) && currentBlock.code && /^\d{4,8}$|^SYD-/i.test(currentBlock.code)) {
          const matchedCatalog = MASTER_EQUIPMENTS_CATALOG.find((eq) => eq.code.trim() === currentBlock!.code?.trim());
          if (matchedCatalog) {
            desc = matchedCatalog.name;
            currentBlock.brand = currentBlock.brand || matchedCatalog.brand;
            currentBlock.modelOrRef = currentBlock.modelOrRef || matchedCatalog.model;
            currentBlock.supplier = currentBlock.supplier || matchedCatalog.supplier;
          } else {
            desc = `Parte Oficial #${currentBlock.code}`;
          }
        }

        // Discard any block whose description is conversational noise, greetings, person signatures, or pure numbers
        if (!desc || isSignatureOrHeaderOrNoise(desc) || desc.length < 3 || /^\d+$/.test(desc)) {
          currentBlock = null;
          return;
        }

        // Must either be recognized medical equipment/supplies or have concrete product specs
        const hasFields = Boolean(
          (currentBlock.unitPrice && currentBlock.unitPrice > 0) ||
          (currentBlock.brand && currentBlock.brand !== 'SYD') ||
          (currentBlock.modelOrRef && currentBlock.modelOrRef !== 'Estándar') ||
          currentBlock.code ||
          (currentBlock.supplier && currentBlock.supplier !== 'Proveedor Asignado')
        );
        const isMed = isMedicalEquipmentOrSupply(desc);
        if (!hasFields && !isMed) {
          currentBlock = null;
          return;
        }

        structuredRows.push({
          code: currentBlock.code,
          supplier: currentBlock.supplier,
          description: desc,
          brand: currentBlock.brand,
          modelOrRef: currentBlock.modelOrRef,
          subReferences: currentBlock.subReferences,
          unitPrice: currentBlock.unitPrice || 0,
          taxRate: currentBlock.taxRate ?? (currentBlock.taxExempt ? 0 : 0.19),
          taxExempt: currentBlock.taxExempt || false,
          quantity: currentBlock.quantity || 1,
          totalPrice: currentBlock.totalPrice || (currentBlock.unitPrice ? currentBlock.unitPrice * (currentBlock.quantity || 1) : 0),
          observation: currentBlock.observation,
        });
      }
      currentBlock = null;
    };

    for (let i = 0; i < rawLines.length; i++) {
      const rawLine = rawLines[i];
      const line = rawLine.replace(/^(?:->|[>|\s*\-•#→])+/, '').trim();
      if (!line) {
        if (currentBlock && currentBlock.description && (currentBlock.brand || currentBlock.modelOrRef || currentBlock.unitPrice)) {
          commitBlock();
        }
        continue;
      }

      if (isSignatureOrHeaderOrNoise(line)) {
        if (currentBlock && (currentBlock.brand || currentBlock.modelOrRef || currentBlock.unitPrice)) {
          commitBlock();
        }
        continue;
      }

      // Check if line indicates start of a new item or code
      const codeStartMatch = line.match(/^(?:parte|c[oó]digo|codigo|n[úu]mero\s*de\s*parte|item|ítem)\s*[:=#\-]\s*([A-Za-z0-9\-_]+)/i);
      const descStartMatch = line.match(/^(?:descripci[oó]n|descripcion|nombre(?:\s+de\s+(?:la\s+)?parte)?|equipo|dispositivo|producto|art[ií]culo)\s*[:=]\s*(.+)/i);
      const triggerStartMatch = line.match(/^(?:favor\s+(?:crear|generar|habilitar|dar\s+de\s+alta)\s+(?:la\s+siguiente\s+|las\s+siguientes\s+)?partes?|solicitud\s+(?:de\s+)?creaci[oó]n(?:\s+de\s+parte)?|creaci[oó]n\s+de\s+partes?)\s*[:=]?\s*(.*)$/i);

      if (codeStartMatch) {
        if (currentBlock && currentBlock.description) {
          commitBlock();
        }
        currentBlock = {
          code: codeStartMatch[1].toUpperCase().replace(/[.,;:]+$/, ''),
        };
        continue;
      }

      if (descStartMatch) {
        if (currentBlock && currentBlock.description) {
          commitBlock();
        }
        currentBlock = {
          description: descStartMatch[1].trim(),
        };
        continue;
      }

      if (triggerStartMatch) {
        if (currentBlock && currentBlock.description) {
          commitBlock();
        }
        const inlineDesc = triggerStartMatch[1].trim();
        currentBlock = {
          description: inlineDesc.length >= 4 && !inlineDesc.includes(':') && !isSignatureOrHeaderOrNoise(inlineDesc) ? inlineDesc : '',
        };
        continue;
      }

      const brandMatch = line.match(/^(?:marca|fabricante|brand)\s*[:=]\s*(.+)/i);
      const modelMatch = line.match(/^(?:modelo|referencia|ref|model|cat[aá]logo)\s*[:=]\s*(.+)/i);
      const suppMatch = line.match(/^(?:proveedor|tercero|empresa|distribuidor|vendor)\s*[:=]\s*(.+)/i);
      const priceMatch = line.match(/^(?:precio|costo|valor|vr\.?\s*unit|vlr\.?\s*unit|p\.?\s*unit|precio\s*unitario)\s*[:=]\s*(.+)/i);
      const ivaMatch = line.match(/^(?:iva|tarifa|impuesto|r[ée]gimen\s*iva)\s*[:=]\s*(.+)/i);
      const cantMatch = line.match(/^(?:cant|cantidad|unidades?)\s*[:=]\s*(.+)/i);
      const subRefMatch = line.match(/^(?:sub-?referencias?|sub-?refs?|componentes?)\s*[:=]\s*(.+)/i);
      const lotMatch = line.match(/^(?:por\s+lote|lote|por\s+unidad|unidad|presentaci[oó]n|empaque)\b\s*[:=]?\s*(.*)$/i);
      const obsMatch = line.match(/^(?:observaci[oó]n|observacion|nota|notas)\s*[:=]\s*(.+)/i);
      const invimaMatch = line.match(/^(?:invima|registro\s*invima|reg\.?\s*invima)\s*[:=]\s*(.+)/i);

      // Handle lot or invima if they matched directly
      if (lotMatch) {
        if (currentBlock) {
          const lotVal = lotMatch[1].trim() || 'LOTE';
          currentBlock.notes = currentBlock.notes ? `${currentBlock.notes}, ${lotVal}` : lotVal;
          currentBlock.observation = currentBlock.observation ? `${currentBlock.observation}, ${lotVal}` : lotVal;
          currentBlock.subReferences = currentBlock.subReferences ? `${currentBlock.subReferences}, ${lotVal}` : lotVal;
          continue;
        }
      }

      if (invimaMatch) {
        if (currentBlock) {
          const invVal = invimaMatch[1].trim();
          currentBlock.notes = currentBlock.notes ? `${currentBlock.notes}, INVIMA: ${invVal}` : `INVIMA: ${invVal}`;
          currentBlock.observation = currentBlock.observation ? `${currentBlock.observation}, INVIMA: ${invVal}` : `INVIMA: ${invVal}`;
          continue;
        }
      }

      // Check for standalone code numbers (e.g. 70875)
      if (/^\d{4,8}$/.test(line)) {
        if (currentBlock && (currentBlock.brand || currentBlock.modelOrRef || currentBlock.unitPrice)) {
          commitBlock();
        }
        currentBlock = currentBlock || {};
        if (!currentBlock.code) {
          currentBlock.code = line;
        }
        continue;
      }

      // Check for unlabelled item title (e.g. "PAQUETE FRIO", "PAQUETE CALIENTE", "1. BANDA THERABAND...")
      const isNonTitle = /^(?:por\s+lote|lote|por\s+unidad|unidad|empaque|presentaci[oó]n|n\/?a|ninguno|ninguna|partes?\s+creadas?|c[oó]digos?\s+creados?|se\s+cre[oó]|se\s+crearon|qued[oó]\s+cread[ao]|el\s+\w+,\s+\d+|para\s+su\s+revisi[oó]n|buenas?\s+(?:tardes|d[ií]as|noches)|favor\s+crear)/i.test(line);
      const isUnlabelledTitle = !line.includes(':') && line.length >= 3 && !isSignatureOrHeaderOrNoise(line) && !isNonTitle && !/^\d+$/.test(line);

      if (isUnlabelledTitle) {
        const cleanTitle = line.replace(/^\d+[\.\)\-]\s*/, '').trim();
        if (currentBlock && (currentBlock.brand || currentBlock.modelOrRef || currentBlock.unitPrice || currentBlock.supplier)) {
          commitBlock();
          currentBlock = { description: cleanTitle };
          continue;
        }
        if (!currentBlock || !currentBlock.description || isSignatureOrHeaderOrNoise(currentBlock.description)) {
          currentBlock = currentBlock || {};
          currentBlock.description = cleanTitle;
          continue;
        }
      }

      if (brandMatch || modelMatch || suppMatch || priceMatch) {
        if (
          currentBlock &&
          ((brandMatch && currentBlock.brand) ||
            (modelMatch && currentBlock.modelOrRef) ||
            (priceMatch && currentBlock.unitPrice))
        ) {
          commitBlock();
        }
        if (!currentBlock) {
          currentBlock = {};
        }
        // If description not set, look back for first valid line that is not noise
        if (!currentBlock.description || isSignatureOrHeaderOrNoise(currentBlock.description)) {
          for (let b = i - 1; b >= 0 && b >= i - 5; b--) {
            const prevL = rawLines[b].replace(/^(?:->|[>|\s*\-•#→])+/, '').trim();
            if (
              prevL.length >= 3 &&
              !prevL.includes(':') &&
              !isSignatureOrHeaderOrNoise(prevL)
            ) {
              currentBlock.description = prevL.replace(/^\d+[\.\)\-]\s*/, '').trim();
              break;
            }
          }
        }
      }

      // Key-Value matches
      if (currentBlock) {
        if (
          !currentBlock.description &&
          !line.includes(':') &&
          line.length >= 3 &&
          !isSignatureOrHeaderOrNoise(line)
        ) {
          currentBlock.description = line;
          continue;
        }

        const descMatch = line.match(/^(?:descripci[oó]n|descripcion|nombre|equipo|detalle|concepto)\s*[:=]\s*(.+)/i);
        if (descMatch) {
          currentBlock.description = descMatch[1].trim();
          continue;
        }

        if (brandMatch) {
          currentBlock.brand = brandMatch[1].trim();
          continue;
        }

        if (modelMatch) {
          currentBlock.modelOrRef = modelMatch[1].trim();
          continue;
        }

        if (suppMatch) {
          currentBlock.supplier = cleanSupplierName(suppMatch[1]);
          continue;
        }

        if (priceMatch) {
          currentBlock.unitPrice = parseCurrencyCOP(priceMatch[1]);
          if (/exento|0%/i.test(priceMatch[1])) {
            currentBlock.taxExempt = true;
            currentBlock.taxRate = 0;
          } else {
            currentBlock.taxExempt = false;
            currentBlock.taxRate = 0.19;
          }
          continue;
        }

        if (ivaMatch) {
          currentBlock.taxExempt = /exento|0%/i.test(ivaMatch[1]);
          currentBlock.taxRate = currentBlock.taxExempt ? 0 : 0.19;
          continue;
        }

        if (cantMatch) {
          currentBlock.quantity = parseQuantity(cantMatch[1]);
          continue;
        }

        if (subRefMatch) {
          currentBlock.subReferences = subRefMatch[1].trim();
          continue;
        }

        if (lotMatch) {
          currentBlock.subReferences = line;
          currentBlock.observation = line;
          continue;
        }

        if (obsMatch) {
          currentBlock.observation = obsMatch[1].trim();
          continue;
        }
      }
    }
    commitBlock();
  }

  // 3. If no table rows or key-value blocks, parse line-by-line items
  if (structuredRows.length === 0) {
    const lines = rawText.split('\n');
    for (const rawLine of lines) {
      const line = rawLine.replace(/^(?:->|[>|\s*\-•#→])+/, '').trim();
      if (line.length < 5) continue;

      // Skip lines that are email headers, thread wrappers, status notices or disclaimers
      if (
        /\b(?:escribi[oó]:|wrote:|de:|para:|fecha:|date:|enviado:|asunto:|subject:|revisado|informaci[oó]n\s+vigente|no\s+se\s+cuenta|sin\s+parte|parte\s+creada|partes\s+creadas|aviso\s+de\s+confidencialidad)\b/i.test(line)
      ) {
        continue;
      }

      // Look for lines containing price or equipment keywords
      const priceMatch = line.match(/(?:\$|COP|Precio[:\s]*\$?)\s*([\d.]{4,14})/i) || line.match(/([\d.]{6,12})\s*\+?\s*IVA/i);
      const codeMatch = line.match(/\b([1-9]\d{4,7})\b/);
      const isYearOrPhone = codeMatch && /^(?:202[0-9]|203[0-9]|3302424|8059)$/.test(codeMatch[1]);
      const validCode = !isYearOrPhone ? codeMatch?.[1] : undefined;
      const qtyMatch = line.match(/\b(?:cant|cantidad|x)?[:\s]*(\d+)\s*(?:und|unidades|piezas|kits)?\b/i);

      // Check if line looks like an item specification
      if (
        priceMatch ||
        (validCode && /laringoscopio|monitor|desfibrilador|bomba|sensor|ventilador|cama|ec[oó]grafo|mesa|l[aá]mpara|aspirador|cable|brazalete|hojas|estuche|camilla|fonendoscopio|regulador|tensi[oó]metro|b[aá]scula|esterilizador|autoclave|espir[oó]metro|holter|gluc[oó]metro|odontol[oó]gic|compresor|electrodo/i.test(line))
      ) {
        let desc = line;
        if (priceMatch) desc = desc.replace(priceMatch[0], '');
        desc = desc.replace(/Cant\s*[:=]?\s*\d+/i, '').replace(/\+?\s*IVA.*$/i, '').trim();

        if (desc.length >= 4 && !/^(?:total|subtotal|gracias|saludos|atentamente|hola|buenos|buenas|adjunto)/i.test(desc)) {
          structuredRows.push({
            code: validCode,
            description: desc,
            unitPrice: priceMatch ? parseCurrencyCOP(priceMatch[1]) : 0,
            quantity: qtyMatch ? parseInt(qtyMatch[1], 10) : 1,
            taxExempt: /exento|0%/i.test(line),
            taxRate: /exento|0%/i.test(line) ? 0 : 0.19,
          });
        }
      }
    }
  }

  return structuredRows;
}
