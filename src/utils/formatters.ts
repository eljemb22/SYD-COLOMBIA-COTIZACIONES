export function cleanNumericString(val: any): string {
  if (val === null || val === undefined || val === '') return '';
  let str = String(val).trim();
  // If in scientific notation (e.g. 5.0000000651615317e+22 or 1.5e+7)
  if (str.toLowerCase().includes('e')) {
    try {
      const [base, expStr] = str.toLowerCase().split('e');
      const exp = parseInt(expStr, 10);
      if (!isNaN(exp) && exp > 0) {
        const [intPart, fracPart = ''] = base.split('.');
        if (exp >= fracPart.length) {
          str = intPart + fracPart + '0'.repeat(exp - fracPart.length);
        } else {
          str = intPart + fracPart.slice(0, exp) + '.' + fracPart.slice(exp);
        }
      }
    } catch {}
  }
  // Extract only integer digits, ignoring negative/decimals for exact integer currency representation
  const parts = str.split('.');
  const intDigits = parts[0].replace(/[^0-9]/g, '');
  return intDigits;
}

export function formatExactCOP(val: number | string): string {
  const digits = cleanNumericString(val);
  if (!digits || digits === '0') return '$ 0';
  const normalized = digits.replace(/^0+/, '') || '0';
  // Insert dots every 3 digits from right
  const formatted = normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$ ${formatted}`;
}

export function formatCOP(amount: number | string): string {
  // Always format strictly with clean currency representation without extraneous COP text
  return formatExactCOP(amount);
}

export function formatNumber(amount: number | string): string {
  const digits = cleanNumericString(amount);
  if (!digits) return '0';
  const normalized = digits.replace(/^0+/, '') || '0';
  return normalized.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function numberToSpanishWords(num: number | string): string {
  const digits = cleanNumericString(num);
  if (!digits || digits === '0' || Number(digits) === 0) return 'CERO PESOS COLOMBIANOS';
  
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  function readGroup(n: number): string {
    let output = '';
    if (n === 100) return 'CIEN';
    if (n > 99) {
      output += centenas[Math.floor(n / 100)] + ' ';
      n = n % 100;
    }
    if (n >= 10 && n <= 19) {
      output += especiales[n - 10] + ' ';
    } else if (n >= 20 && n <= 29) {
      if (n === 20) output += 'VEINTE ';
      else output += 'VEINTI' + unidades[n - 20] + ' ';
    } else if (n > 29) {
      output += decenas[Math.floor(n / 10)];
      if (n % 10 > 0) output += ' Y ' + unidades[n % 10];
      output += ' ';
    } else if (n > 0) {
      output += unidades[n] + ' ';
    }
    return output.trim();
  }

  // Break digits string into groups of 3 from right to handle arbitrarily large numbers (millones, miles de millones, billones)
  const groups: number[] = [];
  let remaining = digits;
  while (remaining.length > 0) {
    const chunk = remaining.slice(-3);
    groups.push(parseInt(chunk, 10));
    remaining = remaining.slice(0, -3);
  }

  let words = '';
  const scaleNames = ['', 'MIL', 'MILLÓN', 'MIL', 'BILLÓN', 'MIL', 'TRILLÓN'];

  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp === 0) continue;

    const groupText = readGroup(grp);
    if (i === 0) {
      words += groupText + ' ';
    } else if (i === 1) {
      if (grp === 1) words += 'MIL ';
      else words += groupText + ' MIL ';
    } else if (i === 2) {
      if (grp === 1) words += 'UN MILLÓN ';
      else words += groupText + ' MILLONES ';
    } else if (i === 3) {
      if (grp === 1) words += 'MIL MILLONES ';
      else words += groupText + ' MIL MILLONES ';
    } else if (i === 4) {
      if (grp === 1) words += 'UN BILLÓN ';
      else words += groupText + ' BILLONES ';
    } else {
      words += groupText + ' ' + (scaleNames[i] || '') + ' ';
    }
  }

  return (words.trim() + ' PESOS COLOMBIANOS').toUpperCase();
}

export function isValidOCNumber(ocNumber?: string | null): boolean {
  if (!ocNumber) return false;
  const cleaned = String(ocNumber).trim().toUpperCase();
  if (
    !cleaned ||
    cleaned === 'S/N' ||
    cleaned === 'SIN OC' ||
    cleaned === 'SIN N° OC' ||
    cleaned === 'SIN NO OC' ||
    cleaned === 'SIN N°' ||
    cleaned === 'PENDIENTE' ||
    cleaned === 'POR ASIGNAR' ||
    cleaned === 'N/A' ||
    cleaned === 'NULL' ||
    cleaned === 'UNDEFINED' ||
    cleaned === '-'
  ) {
    return false;
  }
  return true;
}

/**
 * Normalizes text by removing accents (tildes), punctuation, and casing
 * for robust cross-view matching between tenders, quotes, OVs, and OCs.
 */
export function normalizeClean(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Strips prefixes (No, N°, CTO, Contrato, OV, OC, leading zeros in HBOC) to match contract/process/order numbers reliably
 */
export function cleanRef(str?: string | null): string {
  if (!str) return '';
  return normalizeClean(str)
    .replace(/^(no|n°|nro|num|numero|cto|contrato|ov|oc)[\s.:_-]*/i, '')
    .replace(/^hboc0*/i, 'hboc')
    .replace(/^oc0*/i, 'oc')
    .replace(/[^a-z0-9]/g, '');
}

