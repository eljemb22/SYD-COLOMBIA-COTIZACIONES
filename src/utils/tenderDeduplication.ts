import { TenderClientProject, TenderItem } from '../types';
import { isTenderDeleted } from './tombstones';

export function normalizeKey(str?: string | null): string {
  if (!str) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a tender project is an Orden de Compra Directa del Cliente (OC Directa)
 * based on flag, processType, clientOrderNumber, or process code pattern (e.g. HBOC..., NoHBOC...).
 */
export function isTenderProjectDirectOC(t?: Partial<TenderClientProject> | null): boolean {
  if (!t) return false;
  if (t.header?.isDirectClientOC === true) return true;
  const pType = (t.header?.processType || '').toLowerCase().trim();
  if (
    pType === 'orden de compra directa del cliente' ||
    pType === 'oc directa' ||
    pType === 'oc directo' ||
    pType === 'orden de compra directa' ||
    pType === 'orden de compra directo' ||
    pType === 'orden de compra' ||
    pType.includes('oc direct') ||
    pType.includes('compra direct') ||
    pType.includes('directa del cliente') ||
    pType.includes('directo del cliente') ||
    pType.includes('directa') ||
    pType.includes('directo')
  ) {
    return true;
  }
  if (Boolean(t.header?.clientOrderNumber && String(t.header.clientOrderNumber).trim().length > 0)) {
    return true;
  }
  const rawProc = (t.header?.processNumber || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    rawProc.includes('hboc') ||
    rawProc.startsWith('nohb') ||
    rawProc.startsWith('ocdirect') ||
    rawProc.startsWith('oc-') ||
    rawProc.startsWith('orden')
  ) {
    return true;
  }
  return false;
}

/**
 * Normalizes process number display for direct client orders
 * ensuring masculine typo "OC directo" is always corrected to "OC Directa".
 */
export function formatTenderProcessNumber(t?: Partial<TenderClientProject> | null): string {
  if (!t) return 'Sin proceso';
  const raw = (t.header?.processNumber || t.header?.clientOrderNumber || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'oc directo' || lower === 'ocdirecto' || lower === 'orden de compra directo' || lower === 'oc directo.') {
    return 'OC Directa';
  }
  if ((!raw || lower === 'sin proceso' || lower === 'proceso-lic') && isTenderProjectDirectOC(t)) {
    return 'OC Directa';
  }
  return raw || 'Sin proceso';
}

/**
 * Deduplicates and consolidates Tender / Contract / Direct Client OC projects.
 * Prevents multiple identical cards in Ventana 4 (Licitaciones & Contratos)
 * when a quote is converted, linked, or updated.
 */
export function deduplicateTenderProjects(tenders: TenderClientProject[]): TenderClientProject[] {
  if (!Array.isArray(tenders)) return [];

  const map = new Map<string, TenderClientProject>();

  tenders.forEach((t) => {
    if (!t || !t.id || isTenderDeleted(t.id)) return;

    const normProcess = normalizeKey(t.header?.processNumber || t.header?.clientOrderNumber || '');
    const normQuote = normalizeKey(
      t.linkedQuoteNumber || t.header?.linkedQuoteNumber || t.linkedQuoteId || t.header?.linkedQuoteId || ''
    );
    const normClient = normalizeKey(t.clientName || t.header?.clientName || t.header?.entityName || '');

    // Key prioritization:
    // 1. Process / OC Number (e.g. "nohboc0000000640" or "hboc0000000640")
    // 2. Linked Quote Number (e.g. "3108269")
    // 3. Client Name if specific
    // 4. Unique ID
    let key = '';
    if (normProcess && normProcess.length >= 3 && !['lic', 'sinproceso', 'contrato'].includes(normProcess)) {
      key = `proc-${normProcess}`;
    } else if (normQuote && normQuote.length >= 3) {
      key = `quote-${normQuote}`;
    } else if (normClient && normClient.length >= 4 && !normClient.includes('clientelicitacionnueva')) {
      key = `client-${normClient}`;
    } else {
      key = `id-${t.id}`;
    }

    const isDirect = isTenderProjectDirectOC(t);
    const rawProc = (t.header?.processNumber || '').trim();
    const cleanProc = rawProc.toLowerCase() === 'oc directo' || rawProc.toLowerCase() === 'ocdirecto' ? 'OC Directa' : rawProc;
    const cleanHeader = t.header
      ? {
          ...t.header,
          processNumber: cleanProc,
          isDirectClientOC: isDirect,
          processType: isDirect ? 'Orden de Compra Directa del Cliente' : (t.header.processType || 'Licitación Pública'),
        }
      : ({
          entityName: t.clientName || '',
          processNumber: isDirect ? 'OC Directa' : '',
          processType: isDirect ? 'Orden de Compra Directa del Cliente' : 'Licitación Pública',
          isDirectClientOC: isDirect,
          contractObject: '',
          openingDate: '',
          closingDate: '',
          city: '',
          budgetCOP: 0,
        } as any);

    if (!map.has(key)) {
      map.set(key, {
        ...t,
        header: cleanHeader,
        items: [...(t.items || [])],
      });
    } else {
      const existing = map.get(key)!;

      // Status resolution: 'Adjudicada' has higher precedence
      if (t.status === 'Adjudicada' || existing.status !== 'Adjudicada') {
        existing.status = t.status || existing.status;
      }

      // Merge header attributes
      const mergedIsDirect = Boolean(isDirect || isTenderProjectDirectOC(existing));
      existing.header = {
        ...existing.header,
        ...cleanHeader,
        isDirectClientOC: mergedIsDirect,
        processType: mergedIsDirect
          ? 'Orden de Compra Directa del Cliente'
          : (existing.header?.processType || t.header?.processType || 'Licitación Pública'),
        clientName: existing.clientName || t.clientName || existing.header?.clientName || t.header?.clientName,
        nit: existing.nit || t.nit || existing.header?.nit || t.header?.nit,
        city: existing.header?.city || t.header?.city,
        processNumber: existing.header?.processNumber || t.header?.processNumber,
        clientOrderNumber: existing.header?.clientOrderNumber || t.header?.clientOrderNumber,
        contactPerson: existing.header?.contactPerson || t.header?.contactPerson,
        contactEmail: existing.header?.contactEmail || t.header?.contactEmail,
        contactPhone: existing.header?.contactPhone || t.header?.contactPhone,
        executionTerm: existing.header?.executionTerm || t.header?.executionTerm,
        budgetCOP: Math.max(Number(existing.header?.budgetCOP) || 0, Number(t.header?.budgetCOP) || 0),
        linkedQuoteId: existing.header?.linkedQuoteId || t.header?.linkedQuoteId || existing.linkedQuoteId || t.linkedQuoteId,
        linkedQuoteNumber: existing.header?.linkedQuoteNumber || t.header?.linkedQuoteNumber || existing.linkedQuoteNumber || t.linkedQuoteNumber,
        linkedQuoteTotal: existing.header?.linkedQuoteTotal || t.header?.linkedQuoteTotal || existing.linkedQuoteTotal || t.linkedQuoteTotal,
        linkedQuoteDate: existing.header?.linkedQuoteDate || t.header?.linkedQuoteDate,
      };

      existing.clientName = existing.header.clientName || existing.clientName;
      existing.nit = existing.header.nit || existing.nit;
      existing.linkedQuoteId = existing.header.linkedQuoteId || existing.linkedQuoteId;
      existing.linkedQuoteNumber = existing.header.linkedQuoteNumber || existing.linkedQuoteNumber;
      existing.linkedQuoteTotal = existing.header.linkedQuoteTotal || existing.linkedQuoteTotal;

      // Merge items without duplication (by id, code, or name+brand)
      if (t.items && t.items.length > 0) {
        if (!existing.items) existing.items = [];
        t.items.forEach((newItem: TenderItem) => {
          const itemCode = normalizeKey(newItem.code || '');
          const itemName = normalizeKey(newItem.name || '');
          const itemBrand = normalizeKey(newItem.brand || '');

          const duplicateIdx = existing.items.findIndex((existingItem) => {
            if (existingItem.id === newItem.id) return true;
            if (itemCode && normalizeKey(existingItem.code) === itemCode) return true;
            if (
              itemName &&
              normalizeKey(existingItem.name) === itemName &&
              (!itemBrand || normalizeKey(existingItem.brand) === itemBrand)
            ) {
              return true;
            }
            return false;
          });

          if (duplicateIdx === -1) {
            existing.items.push({ ...newItem });
          } else {
            // Update specs if new item has more requirements
            const currentReqs = existing.items[duplicateIdx].requirements || [];
            const newReqs = newItem.requirements || [];
            if (newReqs.length > currentReqs.length) {
              existing.items[duplicateIdx].requirements = newReqs;
            }
          }
        });
      }
    }
  });

  return Array.from(map.values());
}
