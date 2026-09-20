/**
 * Utilities for cleaning email body text, decoding HTML, splitting thread chains ("cola de correos"),
 * and separating legal disclaimers and signatures for maximum readability.
 */

import { parseCurrencyCOP, extractStructuredRowsFromEmail, StructuredEmailRow, cleanSupplierName } from './emailTableParser';
import { isSignatureOrHeaderOrNoise, isMedicalEquipmentOrSupply } from './medicalEquipmentNoiseFilter';
export { isSignatureOrHeaderOrNoise, isMedicalEquipmentOrSupply, cleanSupplierName };

export interface ParsedThreadMessage {
  id: string;
  senderName?: string;
  senderEmail?: string;
  dateStr?: string;
  body: string;
  isLatest: boolean;
  headerSnippet?: string;
  signature?: string;
  disclaimer?: string;
}

export interface StructuredEmailView {
  greeting?: string;
  mainBody: string;
  bulletItems: string[];
  signature?: string;
  disclaimer?: string;
}

/**
 * Robustly converts raw HTML from Gmail into clean, structured plain text,
 * eliminating CSS styles, scripts, XML declarations, and preserving paragraph line breaks.
 */
export function cleanHtmlToStructuredText(html: string): string {
  if (!html) return '';

  let cleaned = html;

  // 1. Remove style blocks and script blocks completely (including their inner CSS/JS code!)
  cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  cleaned = cleaned.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
  cleaned = cleaned.replace(/<xml[^>]*>[\s\S]*?<\/xml>/gi, '');

  // 2. Remove Outlook and HTML comments: <!--[if mso]>...<![endif]-->
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, '');

  // 3. Convert line-breaking tags to clean newlines and preserve table columns
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/(p|div|li|h[1-6])>/gi, '\n');
  cleaned = cleaned.replace(/<\/(td|th)>/gi, ' \t ');
  cleaned = cleaned.replace(/<\/tr>/gi, '\n');
  cleaned = cleaned.replace(/<td[^>]*>/gi, '');
  cleaned = cleaned.replace(/<th[^>]*>/gi, '');

  // 4. Handle links cleanly: <a href="url">Text</a> -> Text
  cleaned = cleaned.replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1');

  // 5. Remove all remaining tags
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  // 6. Decode HTML entities
  cleaned = decodeHtmlEntities(cleaned);

  // 7. Normalize whitespace
  return cleanEmailText(cleaned);
}

/**
 * Decodes standard HTML entities into actual characters
 */
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';

  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&aacute;/gi, 'á')
    .replace(/&eacute;/gi, 'é')
    .replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó')
    .replace(/&uacute;/gi, 'ú')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&Aacute;/gi, 'Á')
    .replace(/&Eacute;/gi, 'É')
    .replace(/&Iacute;/gi, 'Í')
    .replace(/&Oacute;/gi, 'Ó')
    .replace(/&Uacute;/gi, 'Ú')
    .replace(/&Ntilde;/gi, 'Ñ')
    .replace(/&bull;/gi, '•')
    .replace(/&#8211;/g, '–')
    .replace(/&#8212;/g, '—')
    .replace(/&#8216;/g, '‘')
    .replace(/&#8217;/g, '’')
    .replace(/&#8220;/g, '“')
    .replace(/&#8221;/g, '”')
    .replace(/&#\d+;/g, (m) => {
      const num = parseInt(m.substring(2, m.length - 1), 10);
      return !isNaN(num) ? String.fromCharCode(num) : '';
    });
}

/**
 * Cleans raw email text:
 * - Decodes HTML entities
 * - Removes excessive blank lines
 * - Removes email divider junk and artifacts
 * - Smooths broken hard wraps inside paragraphs
 */
export function cleanEmailText(raw: string): string {
  if (!raw) return '';

  let text = decodeHtmlEntities(raw);

  // If text contains HTML tags that weren't cleaned, clean them now
  if (text.includes('<style') || text.includes('<div') || text.includes('<p>') || text.includes('<br')) {
    text = cleanHtmlToStructuredText(text);
  }

  // Remove standalone email line divider artifacts like "*_*" or "*---*" or "___" or "==="
  text = text.replace(/^[ \t]*[*_~=-]{3,}[ \t]*$/gm, '');

  // Remove base64 or CID image placeholders like [image: ...] or cid:...
  text = text.replace(/\[image:\s*[^\]]+\]/gi, '');
  text = text.replace(/\bdata:image\/[a-zA-Z]+;base64,[^\s]+/g, '');

  // Compress 3 or more consecutive newlines into at most 2 newlines
  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n([ \t]*\n){2,}/g, '\n\n');

  // Trim trailing whitespace per line
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/, ''))
    .join('\n');

  return text.trim();
}

/**
 * Separates legal disclaimers and corporate confidentiality notices
 * so they don't clutter the main email text.
 */
export function extractLegalDisclaimer(text: string): { body: string; disclaimer?: string } {
  if (!text) return { body: '' };

  const disclaimerMarkers = [
    /(?:^|\n)(?:AVISO DE CONFIDENCIALIDAD|CL[AÁ]USULA DE CONFIDENCIALIDAD|NOTA DE CONFIDENCIALIDAD|CONFIDENTIALITY NOTICE|AVISO LEGAL|PROTEGE EL MEDIO AMBIENTE|POR FAVOR NO IMPRIMA ESTE MENSAJE)[\s\S]*/i,
    /(?:^|\n)(?:Este mensaje y cualquier archivo anexo son confidenciales y para uso exclusivo del destinatario)[\s\S]*/i,
    /(?:^|\n)(?:La informaci[oó]n contenida en este correo electr[oó]nico y cualquier archivo adjunto est[aá] dirigida exclusivamente)[\s\S]*/i,
    /(?:^|\n)(?:Antes de imprimir este correo electr[oó]nico, aseg[uú]rese de que sea necesario)[\s\S]*/i,
  ];

  for (const marker of disclaimerMarkers) {
    const match = marker.exec(text);
    if (match && match.index !== undefined && match.index > 20) {
      const body = text.substring(0, match.index).trim();
      const disclaimer = match[0].trim();
      return { body, disclaimer };
    }
  }

  return { body: text };
}

/**
 * Separates corporate signatures from the main email message body
 */
export function extractSignature(text: string): { body: string; signature?: string } {
  if (!text) return { body: '' };

  const signatureMarkers = [
    /(?:^|\n)(?:Atentamente,?|Cordialmente,?|Saludos cordiales,?|Un cordial saludo,?|Quedo atento,?|Quedamos atentos,?|Muchas gracias,?|Gracias y saludos,?)[\s\n]+([^\n]+[\s\S]*)$/i,
  ];

  for (const marker of signatureMarkers) {
    const match = marker.exec(text);
    if (match && match.index !== undefined && match.index > 30) {
      const body = text.substring(0, match.index).trim();
      const signature = match[0].trim();
      return { body, signature };
    }
  }

  return { body: text };
}

/**
 * Breaks an email down into structured components for crystal-clear readability
 */
export function parseStructuredEmail(rawText: string): StructuredEmailView {
  const cleaned = cleanEmailText(rawText);
  const { body: withoutDisclaimer, disclaimer } = extractLegalDisclaimer(cleaned);
  const { body: withoutSig, signature } = extractSignature(withoutDisclaimer);

  // Look for initial greeting
  const lines = withoutSig.split('\n');
  let greeting: string | undefined = undefined;
  let remainingLines = lines;

  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    if (
      /^(?:Buenos d[ií]as|Buenas tardes|Buenas noches|Cordial saludo|Estimad[oa]s?|Apreciad[oa]s?|Hola|Saludos)/i.test(
        firstLine
      )
    ) {
      greeting = firstLine;
      remainingLines = lines.slice(1);
    }
  }

  // Extract any numbered or bulleted list items (e.g. 1. Monitor..., 2. Desfibrilador..., - Sensores...)
  const bulletItems: string[] = [];
  const textLines: string[] = [];

  for (const line of remainingLines) {
    const trimmed = line.trim();
    if (/^(?:\d+[\.\)]|[-*•])\s+/.test(trimmed)) {
      bulletItems.push(trimmed.replace(/^(?:\d+[\.\)]|[-*•])\s+/, ''));
    } else {
      textLines.push(line);
    }
  }

  const mainBody = textLines.join('\n').trim();

  return {
    greeting,
    mainBody: mainBody || withoutSig,
    bulletItems,
    signature,
    disclaimer,
  };
}

/**
 * Splits an email body into separate messages if it is a thread / chain ("cola de correos").
 * Detects patterns like:
 * - "El lun, 31 ago 2026 a las 14:05, Jairo Mendoza <...> escribió:"
 * - "On Mon, Aug 31, 2026 at ... wrote:"
 * - "-----Mensaje original-----" / "-----Original Message-----"
 * - "De: ... Enviado el: ... Para: ... Asunto: ..."
 * - "From: ... Date: ... Subject: ..."
 */
/**
 * Helper to clean body and extract both legal disclaimer and corporate signature
 */
function cleanAndExtractMeta(raw: string): { body: string; disclaimer?: string; signature?: string } {
  const cleaned = cleanEmailText(raw);
  const { body: withoutDisc, disclaimer } = extractLegalDisclaimer(cleaned);
  const { body, signature } = extractSignature(withoutDisc);
  return { body, disclaimer, signature };
}

export function splitEmailThread(
  rawText?: string,
  fallbackSender?: string,
  fallbackDate?: string
): ParsedThreadMessage[] {
  const cleaned = cleanEmailText(rawText || '');
  if (!cleaned) {
    return [
      {
        id: 'msg_0',
        senderName: fallbackSender || 'Remitente',
        dateStr: fallbackDate,
        body: 'Sin contenido en el cuerpo del correo.',
        isLatest: true,
      },
    ];
  }

  // Regex patterns that signal the start of a quoted previous message in a thread
  const dividerRegexes = [
    // Spanish / English Gmail header: "El lun, 31 ago... escribió:" or "On Mon, Aug 31... wrote:" (with optional leading quotes >)
    /(?:^|\n)[ \t]*(?:>+[ \t]*)?(?:(?:El|On)\s+[\s\S]{3,120}?(?:a las|at)\s+[\s\S]{2,40}?(?:escribi[oó]|wrote):\s*)/i,
    // Outlook / Traditional headers: "-----Mensaje original-----"
    /(?:^|\n)[ \t]*(?:>+[ \t]*)?(?:-{3,}\s*(?:Mensaje original|Original Message|Forwarded message|Mensaje reenviado)\s*-{3,})/i,
    // Header block: "De: ... Enviado el: ... Para: ..."
    /(?:^|\n)[ \t]*(?:>+[ \t]*)?(?:De:\s*[^\n]+\n[ \t]*(?:>+[ \t]*)?(?:Enviado el|Fecha):\s*[^\n]+(?:\n[ \t]*(?:>+[ \t]*)?(?:Para|Asunto):[^\n]+)*)/i,
    // Header block: "From: ... Sent: ... To: ..."
    /(?:^|\n)[ \t]*(?:>+[ \t]*)?(?:From:\s*[^\n]+\n[ \t]*(?:>+[ \t]*)?(?:Sent|Date):\s*[^\n]+(?:\n[ \t]*(?:>+[ \t]*)?(?:To|Subject):[^\n]+)*)/i,
  ];

  // Combine patterns into a search to find the earliest match
  let splitIndex = -1;

  for (const regex of dividerRegexes) {
    const match = regex.exec(cleaned);
    if (match && match.index !== undefined) {
      if (splitIndex === -1 || match.index < splitIndex) {
        splitIndex = match.index;
      }
    }
  }

  // If no divider was found, check if there's a block of lines starting with '>'
  if (splitIndex === -1) {
    const quoteIndex = cleaned.search(/(?:^|\n)>\s+/);
    if (quoteIndex !== -1 && quoteIndex > 20) {
      splitIndex = quoteIndex;
    }
  }

  if (splitIndex !== -1 && splitIndex > 5) {
    const latestRaw = cleaned.substring(0, splitIndex);
    const restPart = cleaned.substring(splitIndex);

    const { body: latestBody, disclaimer, signature } = cleanAndExtractMeta(latestRaw);
    const previousMessages = splitRestThread(restPart, 1);

    return [
      {
        id: 'msg_latest',
        senderName: fallbackSender || 'Último Remitente',
        dateStr: fallbackDate,
        body: latestBody || '(Sin texto en la respuesta reciente)',
        isLatest: true,
        disclaimer,
        signature,
      },
      ...previousMessages,
    ];
  }

  // Single message (not a thread)
  const { body: singleBody, disclaimer, signature } = cleanAndExtractMeta(cleaned);
  return [
    {
      id: 'msg_0',
      senderName: fallbackSender || 'Remitente',
      dateStr: fallbackDate,
      body: singleBody,
      isLatest: true,
      disclaimer,
      signature,
    },
  ];
}

function splitRestThread(text: string, depth: number): ParsedThreadMessage[] {
  if (!text || depth > 6) return [];

  const lines = text.split('\n');
  let headerSnippet = '';
  let bodyStartIndex = 0;

  if (lines.length > 0) {
    const firstFew = lines.slice(0, 4).join('\n');
    if (/(?:escribi[oó]|wrote|Mensaje original|Original Message|De:|From:)/i.test(firstFew)) {
      headerSnippet = lines.slice(0, 3).join(' • ').replace(/^-{3,}|-{3,}$/g, '').trim();
      bodyStartIndex = Math.min(3, lines.length);
    }
  }

  const cleanBodyLines = lines
    .slice(bodyStartIndex)
    .map((l) => l.replace(/^[>|\s]+/, ''))
    .join('\n');

  const cleanedRaw = cleanEmailText(cleanBodyLines);

  // Check if there is another nested message inside this rest
  const dividerRegexes = [
    /(?:^|\n)[ \t]*(?:>+[ \t]*)?(?:(?:El|On)\s+[\s\S]{3,120}?(?:a las|at)\s+[\s\S]{2,40}?(?:escribi[oó]|wrote):\s*)/i,
    /(?:^|\n)[ \t]*(?:>+[ \t]*)?(?:-{3,}\s*(?:Mensaje original|Original Message|Forwarded message|Mensaje reenviado)\s*-{3,})/i,
    /(?:^|\n)[ \t]*(?:>+[ \t]*)?(?:De:\s*[^\n]+\n[ \t]*(?:>+[ \t]*)?(?:Enviado el|Fecha):\s*[^\n]+)/i,
  ];

  let nextSplitIndex = -1;
  for (const regex of dividerRegexes) {
    const match = regex.exec(cleanedRaw);
    if (match && match.index !== undefined) {
      if (nextSplitIndex === -1 || match.index < nextSplitIndex) {
        nextSplitIndex = match.index;
      }
    }
  }

  let currentMsgBody = cleanedRaw;
  let nextRestText = '';

  if (nextSplitIndex !== -1 && nextSplitIndex > 10) {
    currentMsgBody = cleanedRaw.substring(0, nextSplitIndex);
    nextRestText = cleanedRaw.substring(nextSplitIndex);
  }

  const { body: finalBody, disclaimer, signature } = cleanAndExtractMeta(currentMsgBody);

  // Attempt to extract sender from header snippet
  let extractedSender = `Mensaje Anterior #${depth}`;
  if (headerSnippet) {
    const emailMatch = headerSnippet.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const deMatch = headerSnippet.match(/(?:De|From):\s*([^•\n<]+)/i);
    if (deMatch && deMatch[1].trim()) {
      extractedSender = deMatch[1].trim();
    } else if (emailMatch) {
      extractedSender = emailMatch[1];
    }
  }

  const currentMsg: ParsedThreadMessage = {
    id: `msg_prev_${depth}`,
    senderName: extractedSender,
    headerSnippet: headerSnippet || undefined,
    body: finalBody || '(Mensaje citado)',
    isLatest: false,
    disclaimer,
    signature,
  };

  if (nextRestText && depth < 5) {
    return [currentMsg, ...splitRestThread(nextRestText, depth + 1)];
  }

  return [currentMsg];
}

export interface RequestedPartCreationDetails {
  name: string;
  brand?: string;
  model?: string;
  price?: number;
  supplier?: string;
  subReferences?: string;
  taxExempt?: boolean;
  taxRate?: number;
  quantity?: number;
  notes?: string;
  partCode?: string;
  category?: string;
  invimaRecordNumber?: string;
}

/**
 * Robustly extracts all requested or referenced parts from email content, HTML tables,
 * key-value lists, or entire thread history chains.
 */
export function extractAllRequestedPartCreationDetails(
  rawText: string = '',
  rawHtml?: string
): RequestedPartCreationDetails[] {
  const results: RequestedPartCreationDetails[] = [];
  if (!rawText && !rawHtml) return results;

  const filterValidParts = (items: RequestedPartCreationDetails[]): RequestedPartCreationDetails[] => {
    return items.filter((item) => {
      if (!item.name || isSignatureOrHeaderOrNoise(item.name)) return false;
      const isMed = isMedicalEquipmentOrSupply(item.name);
      const hasSpecs = Boolean(
        (item.price && item.price > 0) ||
        (item.brand && item.brand !== 'SYD') ||
        (item.model && item.model !== 'Estándar') ||
        (item.supplier && item.supplier !== 'Proveedor Asignado') ||
        item.partCode
      );
      return isMed || hasSpecs;
    });
  };

  const cleaned = cleanEmailText(rawText);

  // 1. First priority: Check structured rows (HTML tables, delimited plain-text tables, and key-value blocks)
  try {
    const structuredRows: StructuredEmailRow[] = extractStructuredRowsFromEmail(rawText, rawHtml);
    if (structuredRows.length > 0) {
      for (const row of structuredRows) {
        // Filter out headers, greetings, and disclaimers
        if (
          row.description &&
          row.description.length >= 3 &&
          !isSignatureOrHeaderOrNoise(row.description) &&
          !/^(?:parte|c[oó]digo|item|descripci[oó]n|revisado|informaci[oó]n\s+vigente)/i.test(row.description)
        ) {
          results.push({
            name: row.description,
            brand: row.brand || undefined,
            model: row.modelOrRef || undefined,
            price: row.unitPrice && row.unitPrice > 0 ? row.unitPrice : undefined,
            supplier: row.supplier || undefined,
            subReferences: row.subReferences || undefined,
            taxExempt: row.taxExempt || false,
            taxRate: row.taxRate ?? (row.taxExempt ? 0 : 0.19),
            quantity: row.quantity || 1,
            notes: row.observation || undefined,
            partCode: row.code && /^\d{4,8}$|^SYD-/i.test(row.code) ? row.code : undefined,
            invimaRecordNumber: (row.observation && /INVIMA:\s*([^\s,;]+)/i.exec(row.observation)?.[1]) || undefined,
          });
        }
      }
      if (results.length > 0) {
        const sanitized = filterValidParts(results);
        if (sanitized.length > 0) return sanitized;
      }
    }
  } catch (err) {
    console.warn('Error parsing structured rows for requested parts:', err);
  }

  // 2. Second priority: Scan lines for Key-Value pairs or trigger sections
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);

  let currentItem: Partial<RequestedPartCreationDetails> | null = null;
  let inTriggerSection = false;

  const commitItem = () => {
    if (currentItem && (currentItem.name || currentItem.model)) {
      const finalName = currentItem.name || (currentItem.model ? `Parte / Equipo ${currentItem.model}` : '');
      if (finalName && !isSignatureOrHeaderOrNoise(finalName)) {
        results.push({
          name: finalName,
          brand: currentItem.brand,
          model: currentItem.model,
          price: currentItem.price,
          supplier: currentItem.supplier,
          subReferences: currentItem.subReferences,
          taxExempt: currentItem.taxExempt,
          taxRate: currentItem.taxRate,
          quantity: currentItem.quantity,
          notes: currentItem.notes,
          partCode: currentItem.partCode,
          invimaRecordNumber: currentItem.invimaRecordNumber,
        });
      }
    }
    currentItem = null;
  };

  for (let i = 0; i < lines.length; i++) {
    // Strip leading email quote characters, bullets, and whitespace (including ->, >, |, -, •, #)
    const line = lines[i].replace(/^(?:->|[>|\s*\-•#→])+/, '').trim();
    if (!line) continue;

    // Check for signature markers or disclaimers: commit current item and close trigger section (do not terminate loop)
    if (/^(?:cordialmente|atentamente|saludos|quedo\s+atento|quedamos\s+atentos|muchas\s+gracias|gracias\s+y\s+saludos|aviso\s+de\s+confidencialidad|-{3,})/i.test(line)) {
      commitItem();
      inTriggerSection = false;
      continue;
    }

    // Check for trigger header: "Favor crear la siguiente parte", "Solicito amablemente la creación del siguiente repuesto", etc.
    if (/^(?:favor\s+(?:crear|generar|habilitar|dar\s+de\s+alta)\s+(?:la\s+siguiente\s+|las\s+siguientes\s+)?partes?|solicitud\s+(?:de\s+)?creaci[oó]n(?:\s+de\s+parte)?|creaci[oó]n\s+de\s+partes?|solicito\s+(?:amablemente\s+)?(?:la\s+)?creaci[oó]n(?:\s+de\s+|\s+del\s+)?(?:la\s+siguiente\s+|las\s+siguientes\s+|del\s+siguiente\s+)?(?:parte|partes|repuesto|repuestos|equipo|equipos)?)\s*[:=]?\s*(.*)$/i.test(line)) {
      commitItem();
      inTriggerSection = true;
      const restOfLine = line.replace(/^(?:favor\s+(?:crear|generar|habilitar|dar\s+de\s+alta)\s+(?:la\s+siguiente\s+|las\s+siguientes\s+)?partes?|solicitud\s+(?:de\s+)?creaci[oó]n(?:\s+de\s+parte)?|creaci[oó]n\s+de\s+partes?|solicito\s+(?:amablemente\s+)?(?:la\s+)?creaci[oó]n(?:\s+de\s+|\s+del\s+)?(?:la\s+siguiente\s+|las\s+siguientes\s+|del\s+siguiente\s+)?(?:parte|partes|repuesto|repuestos|equipo|equipos)?)\s*[:=]?\s*/i, '').trim();
      if (restOfLine.length >= 4 && !restOfLine.includes(':')) {
        currentItem = { name: restOfLine };
      }
      continue;
    }

    // Labeled fields
    const nameMatch = line.match(/^(?:nombre(?:\s+de\s+(?:la\s+)?parte)?|equipo|descripci[oó]n|descripcion|producto|dispositivo|art[ií]culo|repuesto)\s*[:=]\s*(.+)$/i);
    const brandMatch = line.match(/^(?:marca|brand|fabricante)\s*[:=]\s*(.+)$/i);
    const modelMatch = line.match(/^(?:modelo|ref(?:erencia)?|model|cat[aá]logo)\s*[:=]\s*(.+)$/i);
    const priceMatch = line.match(/^(?:precio|costo|valor|vr\.?\s*unit|vlr\.?\s*unit|precio\s*unitario)\s*[:=]\s*(.+)$/i);
    const provMatch = line.match(/^(?:proveedor|distribuidor|vendor|tercero|empresa)\s*[:=]\s*(.+)$/i);
    const invimaMatch = line.match(/^(?:invima|registro\s*invima|reg\.?\s*invima)\s*[:=]\s*(.+)$/i);
    const subRefMatch = line.match(/^(?:sub-?referencias?|sub-?refs?|componentes?|referencias\s+componentes)\s*[:=]\s*(.+)$/i);
    const ivaMatch = line.match(/^(?:iva|impuesto|tarifa)\s*[:=]\s*(.+)$/i);
    const cantMatch = line.match(/^(?:cant|cantidad|unidades?)\.?\s*[:=]\s*(.+)$/i);
    const obsMatch = line.match(/^(?:observaci[oó]n|observaciones|notas?)\s*[:=]\s*(.+)$/i);
    const lotMatch = line.match(/^(?:por\s+lote|lote|por\s+unidad|unidad|presentaci[oó]n|empaque)\b\s*[:=]?\s*(.*)$/i);
    const codeMatch = line.match(/^(?:parte|c[oó]digo|codigo|n[uú]mero\s+de\s+parte)\s*[:=]\s*(\d{4,8}|SYD-[A-Z0-9\-_]+)$/i);

    // Explicit INVIMA match
    if (invimaMatch) {
      currentItem = currentItem || {};
      currentItem.invimaRecordNumber = invimaMatch[1].trim();
      continue;
    }

    // Explicit Lot / Packaging match (e.g. "LOTE", "POR LOTE", "PRESENTACIÓN: LOTE")
    if (lotMatch) {
      currentItem = currentItem || {};
      const lotVal = lotMatch[1].trim() || 'LOTE';
      currentItem.notes = currentItem.notes ? `${currentItem.notes}, ${lotVal}` : lotVal;
      currentItem.subReferences = currentItem.subReferences ? `${currentItem.subReferences}, ${lotVal}` : lotVal;
      continue;
    }

    // Unlabelled title or numbered item: e.g. "PAQUETE FRIO", "PAQUETE CALIENTE", "1. BANDA THERABAND..."
    const isNoise = /^(?:buenos|buenas|hola|estimad|gracias|quedo|saludos|favor|atentamente|cordialmente|aviso\s+de\s+confidencialidad|de:|para:|asunto:|fecha:)/i.test(line);
    const isNonTitle = /^(?:por\s+lote|lote|por\s+unidad|unidad|empaque|presentaci[oó]n|n\/?a|ninguno|ninguna|partes?\s+creadas?|c[oó]digos?\s+creados?|se\s+cre[oó]|se\s+crearon|qued[oó]\s+cread[ao]|el\s+\w+,\s+\d+|para\s+su\s+revisi[oó]n|buenas?\s+(?:tardes|d[ií]as|noches)|favor\s+crear)/i.test(line);
    const isUnlabelledTitle =
      !line.includes(':') &&
      line.length >= 3 &&
      !isNoise &&
      !isNonTitle &&
      !isSignatureOrHeaderOrNoise(line);

    if (isUnlabelledTitle) {
      const cleanTitle = line.replace(/^\d+[\.\)\-]\s*/, '').trim();
      // If current item already accumulated details (brand, model, price, or supplier), this is a NEW item!
      if (currentItem && (currentItem.brand || currentItem.model || currentItem.price || currentItem.supplier)) {
        commitItem();
        currentItem = { name: cleanTitle };
        continue;
      }
      // If we don't have a name yet, set it as current item name if inside trigger section or if next line is a field
      if (!currentItem || !currentItem.name) {
        // Look ahead 1-3 lines to check if followed by MARCA, MODELO, PRECIO, etc.
        let isFollowedByField = inTriggerSection;
        if (!isFollowedByField) {
          for (let nextIdx = i + 1; nextIdx < Math.min(lines.length, i + 4); nextIdx++) {
            const nextL = lines[nextIdx].replace(/^(?:->|[>|\s*\-•#→])+/, '').trim();
            if (/^(?:marca|brand|modelo|ref|precio|costo|proveedor)\s*[:=]/i.test(nextL)) {
              isFollowedByField = true;
              break;
            }
          }
        }

        if (isFollowedByField) {
          currentItem = currentItem || {};
          currentItem.name = cleanTitle;
          continue;
        }
      }
    }

    if (nameMatch) {
      if (currentItem && (currentItem.name || currentItem.brand || currentItem.model || currentItem.price)) {
        commitItem();
      }
      currentItem = currentItem || {};
      currentItem.name = nameMatch[1].trim();
      continue;
    }

    if (brandMatch) {
      if (currentItem && (currentItem.brand || currentItem.model || currentItem.price)) {
        commitItem();
      }
      currentItem = currentItem || {};
      currentItem.brand = brandMatch[1].trim();
      // If we don't have a name yet, look at preceding line in text
      if (!currentItem.name) {
        for (let b = i - 1; b >= 0 && b >= i - 4; b--) {
          const prevL = lines[b].replace(/^(?:->|[>|\s*\-•#→])+/, '').trim();
          if (prevL.length >= 4 && !prevL.includes(':') && !/^(?:buenos|buenas|hola|estimad|gracias|quedo|saludos|favor|de:|para:|asunto:|fecha:)/i.test(prevL) && !isSignatureOrHeaderOrNoise(prevL)) {
            currentItem.name = prevL;
            break;
          }
        }
      }
      continue;
    }

    if (modelMatch) {
      if (currentItem && (currentItem.model || currentItem.price)) {
        commitItem();
      }
      currentItem = currentItem || {};
      currentItem.model = modelMatch[1].trim();
      if (!currentItem.name) {
        for (let b = i - 1; b >= 0 && b >= i - 4; b--) {
          const prevL = lines[b].replace(/^(?:->|[>|\s*\-•#→])+/, '').trim();
          if (prevL.length >= 4 && !prevL.includes(':') && !/^(?:buenos|buenas|hola|estimad|gracias|quedo|saludos|favor|de:|para:|asunto:|fecha:)/i.test(prevL) && !isSignatureOrHeaderOrNoise(prevL)) {
            currentItem.name = prevL;
            break;
          }
        }
      }
      continue;
    }

    if (priceMatch) {
      currentItem = currentItem || {};
      currentItem.price = parseCurrencyCOP(priceMatch[1]);
      if (/exento|0%/i.test(priceMatch[1])) {
        currentItem.taxExempt = true;
        currentItem.taxRate = 0;
      } else {
        currentItem.taxExempt = false;
        currentItem.taxRate = 0.19;
      }
      continue;
    }

    if (provMatch) {
      currentItem = currentItem || {};
      currentItem.supplier = cleanSupplierName(provMatch[1]);
      continue;
    }

    if (invimaMatch) {
      currentItem = currentItem || {};
      currentItem.invimaRecordNumber = invimaMatch[1].trim();
      continue;
    }

    if (subRefMatch) {
      currentItem = currentItem || {};
      currentItem.subReferences = subRefMatch[1].trim();
      continue;
    }

    if (ivaMatch) {
      currentItem = currentItem || {};
      currentItem.taxExempt = /exento|0%/i.test(ivaMatch[1]);
      currentItem.taxRate = currentItem.taxExempt ? 0 : 0.19;
      continue;
    }

    if (cantMatch) {
      currentItem = currentItem || {};
      const q = parseInt(cantMatch[1].replace(/\D/g, ''), 10);
      currentItem.quantity = q > 0 ? q : 1;
      continue;
    }

    if (obsMatch) {
      currentItem = currentItem || {};
      currentItem.notes = obsMatch[1].trim();
      continue;
    }

    if (lotMatch) {
      currentItem = currentItem || {};
      currentItem.notes = line;
      currentItem.subReferences = line;
      continue;
    }

    if (codeMatch) {
      currentItem = currentItem || {};
      currentItem.partCode = codeMatch[1].trim();
      continue;
    }

    // If we are in trigger section and haven't captured a name yet, first descriptive line is the name
    if (inTriggerSection && (!currentItem || !currentItem.name)) {
      if (
        line.length >= 4 &&
        !line.includes(':') &&
        !/^(?:buenos|buenas|hola|estimad|gracias|quedo|saludos|favor|atentamente|cordialmente)/i.test(line) &&
        !isSignatureOrHeaderOrNoise(line)
      ) {
        currentItem = currentItem || {};
        currentItem.name = line;
      }
    }
  }

  commitItem();

  const sanitized = filterValidParts(results);
  if (sanitized.length > 0) {
    return sanitized;
  }

  // 3. Third priority: Search immediate parent message in thread (Step 1 request from immediate quote)
  try {
    const threadParts = splitEmailThread(rawText);
    if (threadParts.length > 1) {
      // Only check the immediate previous message (index 1) to avoid bleeding old parts from distant conversations
      const immediateParentBody = threadParts[1].body;
      if (immediateParentBody && immediateParentBody.length > 10) {
        const threadResults = extractAllRequestedPartCreationDetails(immediateParentBody);
        const validThread = filterValidParts(threadResults);
        if (validThread.length > 0) {
          return validThread;
        }
      }
    }
  } catch (err) {
    console.warn('Error in thread walk for requested parts:', err);
  }

  return sanitized;
}

/**
 * Extracts the primary requested part creation details from email text or HTML.
 */
export function extractRequestedPartCreationDetails(
  rawText: string = '',
  rawHtml?: string
): RequestedPartCreationDetails | null {
  const all = extractAllRequestedPartCreationDetails(rawText, rawHtml);
  return all.length > 0 ? all[0] : null;
}



