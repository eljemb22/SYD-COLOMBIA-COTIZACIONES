import {
  OCTrackingContract,
  OCTrackingItem,
  SupplierPurchaseOrder,
  TenderClientProject,
  SalesOrderRecord,
  SavedQuote,
} from '../types';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
} from './ocTrackingStorage';
import { getStoredSalesOrders } from './salesOrdersStorage';
import { getSavedQuotes } from './quoteStorage';
import { cleanSupplierName } from './cleanSupplierUtils';
import { DetectedPurchaseOrder } from '../services/gmailIntegrationService';

export interface OCMatchResult {
  matchedType: 'licitacion' | 'orden_venta' | 'cotizacion' | 'contrato_existente' | 'nuevo';
  matchedId?: string;
  matchedTitle: string;
  clientName: string;
  nit: string;
  city: string;
  contractNumber: string;
  sourceType: 'licitacion_adjudicada' | 'oc_directa' | 'orden_venta' | 'cotizacion_aprobada' | 'manual';
  isDirectOC?: boolean;
  typeLabel?: string;
  matchConfidence: 'alta' | 'media' | 'baja' | 'general';
  matchReasons: string[];
}

/**
 * Normalizes text for matching keywords and tokens
 */
function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts meaningful tokens (words >= 4 chars, skipping common Spanish stop words)
 */
function extractTokens(text: string): string[] {
  const stopWords = new Set([
    'para', 'como', 'este', 'esta', 'estos', 'estas', 'orden', 'compra', 'solicitud',
    'correo', 'mensaje', 'buenos', 'dias', 'tardes', 'favor', 'envio', 'adjunto',
    'senor', 'senores', 'hospital', 'clinica', 'equipo', 'equipos', 'parte', 'partes',
    'repuesto', 'repuestos', 'colombia', 'precio', 'cotizacion', 'referencia'
  ]);
  return normalizeText(text)
    .split(' ')
    .filter((w) => w.length >= 3 && !stopWords.has(w));
}

/**
 * Detects which tender, contract, or client sales order an incoming OC belongs to
 * based on detected items, equipment codes, descriptions, and customer names.
 */
export function detectMatchingProjectForOC(order: DetectedPurchaseOrder): OCMatchResult {
  const itemTexts: string[] = [];
  const partCodes: string[] = [];

  if (order.detectedItems && order.detectedItems.length > 0) {
    order.detectedItems.forEach((it) => {
      if (it.description) itemTexts.push(it.description);
      if (it.brand) itemTexts.push(it.brand);
      if (it.model) itemTexts.push(it.model);
      if (it.partCode) partCodes.push(it.partCode.toLowerCase().trim());
    });
  }

  if (order.detectedPartsToImport && order.detectedPartsToImport.length > 0) {
    order.detectedPartsToImport.forEach((p) => {
      if (p.name) itemTexts.push(p.name);
      if (p.brand) itemTexts.push(p.brand);
      if (p.model) itemTexts.push(p.model);
      if (p.code) partCodes.push(p.code.toLowerCase().trim());
    });
  }

  const fullEmailText = `${order.subject || ''} ${order.detectedCustomer || ''} ${itemTexts.join(' ')}`;
  const emailTokens = extractTokens(fullEmailText);
  const normalizedEmailText = normalizeText(fullEmailText);
  const detectedCustomerNorm = normalizeText(order.detectedCustomer || '');

  // 1. Check Tender Client Projects (Ventana 4 - Licitaciones & Contratos Directos del Cliente)
  // Prioritized so that contracts and direct OCs registered in Ventana 4 are matched primarily
  // and labeled as either "OC Directa" or "Licitación Normal" without duplicate detection.
  let tenderProjects: TenderClientProject[] = [];
  try {
    const rawTenders = localStorage.getItem('syd_tender_clients_v2');
    if (rawTenders) tenderProjects = JSON.parse(rawTenders);
  } catch {}

  let bestTenderMatch: { tender: TenderClientProject; score: number; reasons: string[] } | null = null;

  for (const t of tenderProjects) {
    let score = 0;
    const reasons: string[] = [];

    const tClientNorm = normalizeText(t.clientName || t.header?.entityName || '');
    if (detectedCustomerNorm && tClientNorm.includes(detectedCustomerNorm)) {
      score += 40;
      reasons.push(`Entidad/Cliente coincide: "${t.clientName}"`);
    } else if (tClientNorm && normalizedEmailText.includes(tClientNorm)) {
      score += 35;
      reasons.push(`Mención de "${t.clientName}" en correo`);
    }

    // Process number match
    const procNorm = normalizeText(t.header?.processNumber || '');
    if (procNorm && normalizedEmailText.includes(procNorm)) {
      score += 50;
      reasons.push(`N° de Proceso/Licitación/OC encontrado: ${t.header?.processNumber}`);
    }

    // Direct OC number match
    if (order.detectedOCNumber) {
      const ocClean = normalizeText(order.detectedOCNumber);
      if (procNorm && (procNorm.includes(ocClean) || ocClean.includes(procNorm))) {
        score += 65;
        reasons.push(`Coincidencia con N° de Orden de Compra #${order.detectedOCNumber}`);
      }
    }

    // Items match
    if (t.items && Array.isArray(t.items)) {
      for (const tItem of t.items) {
        const itemDescNorm = normalizeText(tItem.name || '');
        const itemCodeNorm = (tItem.code || '').toLowerCase().trim();

        if (itemCodeNorm && partCodes.includes(itemCodeNorm)) {
          score += 45;
          reasons.push(`Código de equipo coincide: ${itemCodeNorm}`);
        } else if (itemDescNorm) {
          const itemTokens = extractTokens(itemDescNorm);
          const common = itemTokens.filter((t) => emailTokens.includes(t));
          if (common.length >= 2) {
            score += 20 * common.length;
            reasons.push(`Equipo coincide: "${tItem.name}"`);
          }
        }
      }
    }

    if (score > (bestTenderMatch?.score || 0)) {
      bestTenderMatch = { tender: t, score, reasons };
    }
  }

  if (bestTenderMatch && bestTenderMatch.score >= 30) {
    const isDirect =
      Boolean((bestTenderMatch.tender as any).isDirectOC) ||
      bestTenderMatch.tender.header?.processType === 'OC Directa' ||
      bestTenderMatch.tender.header?.processType === 'Orden de Compra Directa del Cliente' ||
      bestTenderMatch.tender.header?.processType === 'Contratación Directa' ||
      /orden\s+de\s+compra|oc\s+directa/i.test(bestTenderMatch.tender.header?.processType || '') ||
      /oc[-_\s]/i.test(bestTenderMatch.tender.header?.processNumber || '');

    const typeLabel = isDirect ? 'OC Directa' : 'Licitación Normal';
    const badgeIcon = isDirect ? '📦' : '🏛️';

    return {
      matchedType: 'licitacion',
      matchedId: bestTenderMatch.tender.id,
      matchedTitle: `${badgeIcon} ${typeLabel}: ${bestTenderMatch.tender.header?.processNumber || bestTenderMatch.tender.clientName}`,
      clientName: bestTenderMatch.tender.clientName || bestTenderMatch.tender.header?.entityName || 'Cliente SYD',
      nit: bestTenderMatch.tender.nit || bestTenderMatch.tender.header?.nit || '900.123.456-1',
      city: (bestTenderMatch.tender.header as any)?.city || 'Bogotá D.C.',
      contractNumber: bestTenderMatch.tender.header?.processNumber || `LIC-${bestTenderMatch.tender.clientName.slice(0, 10).toUpperCase()}`,
      sourceType: isDirect ? 'oc_directa' : 'licitacion_adjudicada',
      isDirectOC: isDirect,
      typeLabel: typeLabel,
      matchConfidence: bestTenderMatch.score >= 60 ? 'alta' : 'media',
      matchReasons: bestTenderMatch.reasons,
    };
  }

  // 2. Check existing OC Tracking Contracts (Ventana 5)
  const existingContracts = getStoredOCTrackingContracts();
  if (order.detectedOCNumber) {
    const existingWithSameOC = existingContracts.find(
      (c) =>
        c.ocNumber?.toLowerCase() === order.detectedOCNumber?.toLowerCase() ||
        c.purchaseOrders?.some((po) => po.ocNumber?.toLowerCase() === order.detectedOCNumber?.toLowerCase())
    );
    if (existingWithSameOC) {
      // If this contract is linked to or shares process number with a tender project in Ventana 4, resolve to the Ventana 4 tender
      const parentTender = existingWithSameOC.tenderClientId
        ? tenderProjects.find((t) => t.id === existingWithSameOC.tenderClientId)
        : tenderProjects.find(
            (t) =>
              (t.header?.processNumber && normalizeText(t.header.processNumber) === normalizeText(existingWithSameOC.contractNumber)) ||
              (t.clientName && normalizeText(t.clientName) === normalizeText(existingWithSameOC.clientName))
          );

      if (parentTender) {
        const isDirect =
          Boolean((parentTender as any).isDirectOC) ||
          parentTender.header?.processType === 'OC Directa' ||
          parentTender.header?.processType === 'Orden de Compra Directa del Cliente' ||
          parentTender.header?.processType === 'Contratación Directa' ||
          /orden\s+de\s+compra|oc\s+directa/i.test(parentTender.header?.processType || '') ||
          /oc[-_\s]/i.test(parentTender.header?.processNumber || '');
        const typeLabel = isDirect ? 'OC Directa' : 'Licitación Normal';
        const badgeIcon = isDirect ? '📦' : '🏛️';

        return {
          matchedType: 'licitacion',
          matchedId: parentTender.id,
          matchedTitle: `${badgeIcon} ${typeLabel}: ${parentTender.header?.processNumber || parentTender.clientName}`,
          clientName: parentTender.clientName || parentTender.header?.entityName || existingWithSameOC.clientName,
          nit: parentTender.nit || parentTender.header?.nit || existingWithSameOC.nit || '900.123.456-1',
          city: (parentTender.header as any)?.city || existingWithSameOC.city || 'Bogotá D.C.',
          contractNumber: parentTender.header?.processNumber || existingWithSameOC.contractNumber,
          sourceType: isDirect ? 'oc_directa' : 'licitacion_adjudicada',
          isDirectOC: isDirect,
          typeLabel: typeLabel,
          matchConfidence: 'alta',
          matchReasons: [`Vinculado al expediente de Licitaciones / OC Directa #${parentTender.header?.processNumber || parentTender.clientName}`],
        };
      }

      const isDirect =
        Boolean((existingWithSameOC as any).isDirectOC) ||
        existingWithSameOC.sourceType === 'oc_directa' ||
        /oc|directa/i.test(existingWithSameOC.contractNumber || '');
      const typeLabel = isDirect ? 'OC Directa' : 'Licitación Normal';

      return {
        matchedType: 'contrato_existente',
        matchedId: existingWithSameOC.id,
        matchedTitle: `${isDirect ? '📦 OC Directa' : '🏛️ Contrato Activo'}: ${existingWithSameOC.contractNumber} (${existingWithSameOC.clientName})`,
        clientName: existingWithSameOC.clientName,
        nit: existingWithSameOC.nit || '900.123.456-1',
        city: existingWithSameOC.city || 'Bogotá D.C.',
        contractNumber: existingWithSameOC.contractNumber,
        sourceType: isDirect ? 'oc_directa' : existingWithSameOC.sourceType,
        isDirectOC: isDirect,
        typeLabel: typeLabel,
        matchConfidence: 'alta',
        matchReasons: [`Coincidencia directa con N° de Orden de Compra #${order.detectedOCNumber}`],
      };
    }
  }

  // 3. Check Sales Orders (Ventana 7)
  const salesOrders = getStoredSalesOrders();
  let bestSOMatch: { so: SalesOrderRecord; score: number; reasons: string[] } | null = null;

  for (const so of salesOrders) {
    let score = 0;
    const reasons: string[] = [];

    // Client match
    const soClientNorm = normalizeText(so.clientName || '');
    if (detectedCustomerNorm && soClientNorm.includes(detectedCustomerNorm)) {
      score += 40;
      reasons.push(`Cliente coincide: "${so.clientName}"`);
    } else if (soClientNorm && normalizedEmailText.includes(soClientNorm)) {
      score += 35;
      reasons.push(`Mención del cliente "${so.clientName}" en correo`);
    }

    // Number match
    if (
      order.detectedOCNumber &&
      (so.salesOrderNumber?.toLowerCase().includes(order.detectedOCNumber.toLowerCase()) ||
        so.contractNumber?.toLowerCase().includes(order.detectedOCNumber.toLowerCase()))
    ) {
      score += 60;
      reasons.push(`N° OC / Orden de Venta coincide (${so.salesOrderNumber})`);
    }

    // Items match
    if (so.items && Array.isArray(so.items)) {
      for (const soItem of so.items) {
        const itemDescNorm = normalizeText(soItem.name || '');
        const itemCodeNorm = (soItem.code || '').toLowerCase().trim();

        if (itemCodeNorm && partCodes.includes(itemCodeNorm)) {
          score += 50;
          reasons.push(`Código de parte coincide: ${itemCodeNorm}`);
        } else if (itemDescNorm) {
          const itemTokens = extractTokens(itemDescNorm);
          const common = itemTokens.filter((t) => emailTokens.includes(t));
          if (common.length >= 2) {
            score += 25 * common.length;
            reasons.push(`Equipo/Ítem similar: "${soItem.name}"`);
          }
        }
      }
    }

    if (score > (bestSOMatch?.score || 0)) {
      bestSOMatch = { so, score, reasons };
    }
  }

  if (bestSOMatch && bestSOMatch.score >= 30) {
    const isDirect = /oc|directa/i.test(bestSOMatch.so.contractNumber || bestSOMatch.so.notes || '');
    const typeLabel = isDirect ? 'OC Directa' : 'Licitación Normal';

    return {
      matchedType: 'orden_venta',
      matchedId: bestSOMatch.so.id,
      matchedTitle: `Orden de Venta (${typeLabel}): ${bestSOMatch.so.salesOrderNumber} (${bestSOMatch.so.clientName})`,
      clientName: bestSOMatch.so.clientName,
      nit: bestSOMatch.so.clientNit || '900.123.456-1',
      city: bestSOMatch.so.clientCity || 'Bogotá D.C.',
      contractNumber: bestSOMatch.so.salesOrderNumber,
      sourceType: 'orden_venta',
      isDirectOC: isDirect,
      typeLabel: typeLabel,
      matchConfidence: bestSOMatch.score >= 60 ? 'alta' : 'media',
      matchReasons: bestSOMatch.reasons,
    };
  }

  // 4. Check Quotes (Cotizaciones)
  const savedQuotes = getSavedQuotes();
  let bestQuoteMatch: { quote: SavedQuote; score: number; reasons: string[] } | null = null;

  for (const q of savedQuotes) {
    let score = 0;
    const reasons: string[] = [];

    const qClientNorm = normalizeText(q.clientName || '');
    if (detectedCustomerNorm && qClientNorm.includes(detectedCustomerNorm)) {
      score += 40;
      reasons.push(`Cliente de Cotización coincide: "${q.clientName}"`);
    }

    if (q.quoteNumber && normalizedEmailText.includes(normalizeText(q.quoteNumber))) {
      score += 50;
      reasons.push(`N° de Cotización referenciado: ${q.quoteNumber}`);
    }

    if (q.items && Array.isArray(q.items)) {
      for (const qItem of q.items) {
        const itemDescNorm = normalizeText(qItem.name || qItem.model || '');
        const itemCodeNorm = (qItem.code || '').toLowerCase().trim();

        if (itemCodeNorm && partCodes.includes(itemCodeNorm)) {
          score += 40;
          reasons.push(`Parte de cotización coincide: ${itemCodeNorm}`);
        } else if (itemDescNorm) {
          const itemTokens = extractTokens(itemDescNorm);
          const common = itemTokens.filter((t) => emailTokens.includes(t));
          if (common.length >= 2) {
            score += 15 * common.length;
            reasons.push(`Ítem cotizado similar: "${qItem.name}"`);
          }
        }
      }
    }

    if (score > (bestQuoteMatch?.score || 0)) {
      bestQuoteMatch = { quote: q, score, reasons };
    }
  }

  if (bestQuoteMatch && bestQuoteMatch.score >= 30) {
    return {
      matchedType: 'cotizacion',
      matchedId: bestQuoteMatch.quote.id,
      matchedTitle: `Cotización: ${bestQuoteMatch.quote.quoteNumber || 'Aprobada'} (${bestQuoteMatch.quote.clientName})`,
      clientName: bestQuoteMatch.quote.clientName || 'Cliente SYD',
      nit: bestQuoteMatch.quote.nit || '900.123.456-1',
      city: bestQuoteMatch.quote.city || 'Bogotá D.C.',
      contractNumber: bestQuoteMatch.quote.quoteNumber || 'COT-APROBADA',
      sourceType: 'cotizacion_aprobada',
      matchConfidence: bestQuoteMatch.score >= 60 ? 'alta' : 'media',
      matchReasons: bestQuoteMatch.reasons,
    };
  }

  // Fallback: Default new contract based on detected email data
  const fallbackClient = order.detectedCustomer || 'Cliente Institucional SYD';
  const fallbackContractNum = order.detectedOCNumber ? `OC-${order.detectedOCNumber}` : `CONT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  return {
    matchedType: 'nuevo',
    matchedTitle: `Nuevo Seguimiento para: ${fallbackClient}`,
    clientName: fallbackClient,
    nit: '900.123.456-1',
    city: 'Bogotá D.C.',
    contractNumber: fallbackContractNum,
    sourceType: 'manual',
    matchConfidence: 'general',
    matchReasons: ['Asignación automática desde datos de la Orden de Compra'],
  };
}

/**
 * Transfers an incoming detected purchase order directly into Ventana 5 (Seguimiento de OC),
 * linking it to the detected contract / tender / sales order.
 */
export function transferEmailOCToVentana5(order: DetectedPurchaseOrder): {
  success: boolean;
  contract: OCTrackingContract;
  matchInfo: OCMatchResult;
  message: string;
} {
  const ocNumber = order.detectedOCNumber || `OC-SYD-${Date.now().toString().slice(-4)}`;
  const cleanSupplier = cleanSupplierName(order.senderName || order.senderEmail) || 'Proveedor Asignado';
  const matchInfo = detectMatchingProjectForOC(order);

  const existingContracts = getStoredOCTrackingContracts();
  const nowIso = new Date().toISOString();

  // Build items from detected items or parts
  const trackingItems: OCTrackingItem[] = [];

  if (order.detectedItems && order.detectedItems.length > 0) {
    order.detectedItems.forEach((it, idx) => {
      trackingItems.push({
        id: `item-oc-${Date.now()}-${idx}`,
        equipmentId: it.partCode || `eq-det-${idx}`,
        code: it.partCode || `EQ-${idx + 1}`,
        name: it.description || `Ítem ${idx + 1} de OC`,
        brand: it.brand || 'SYD',
        model: it.model || 'Estándar',
        quantity: it.quantity || 1,
        costPriceCOP: it.unitPrice || 0,
        totalCostCOP: (it.quantity || 1) * (it.unitPrice || 0),
        supplier: cleanSupplier,
        ocNumber: ocNumber,
        status: 'Emitida',
        paymentStatus: 'Pendiente',
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
        notes: `Importado desde correo Gmail "${order.subject}"`,
        history: [
          {
            id: `log-${Date.now()}-${idx}`,
            timestamp: nowIso,
            newStatus: 'Emitida',
            user: 'Sistema Gmail',
            note: 'Detectado automáticamente en correo',
          },
        ],
      });
    });
  } else if (order.detectedPartsToImport && order.detectedPartsToImport.length > 0) {
    order.detectedPartsToImport.forEach((p, idx) => {
      trackingItems.push({
        id: `item-part-${Date.now()}-${idx}`,
        equipmentId: p.code,
        code: p.code,
        name: p.name,
        brand: p.brand || 'SYD',
        model: p.model || 'Estándar',
        quantity: 1,
        costPriceCOP: p.baseCostCOP || 0,
        totalCostCOP: p.baseCostCOP || 0,
        supplier: cleanSupplier,
        ocNumber: ocNumber,
        status: 'Emitida',
        paymentStatus: 'Pendiente',
        createdAt: nowIso,
        lastUpdatedAt: nowIso,
        notes: `Parte oficial creada #${p.code}`,
        history: [
          {
            id: `log-${Date.now()}-${idx}`,
            timestamp: nowIso,
            newStatus: 'Emitida',
            user: 'Sistema Gmail',
            note: 'Parte oficial importada',
          },
        ],
      });
    });
  } else {
    // Fallback single item
    trackingItems.push({
      id: `item-gen-${Date.now()}`,
      equipmentId: `GEN-${ocNumber}`,
      code: `GEN-${ocNumber}`,
      name: order.subject || 'Suministro de Equipos y Partes Médicas',
      brand: 'SYD',
      model: 'General',
      quantity: 1,
      costPriceCOP: order.detectedEstimatedTotal || 0,
      totalCostCOP: order.detectedEstimatedTotal || 0,
      supplier: cleanSupplier,
      ocNumber: ocNumber,
      status: 'Emitida',
      paymentStatus: 'Pendiente',
      createdAt: nowIso,
      lastUpdatedAt: nowIso,
      notes: `Importado desde correo Gmail`,
      history: [
        {
          id: `log-${Date.now()}`,
          timestamp: nowIso,
          newStatus: 'Emitida',
          user: 'Sistema Gmail',
          note: 'Registro de OC inicial',
        },
      ],
    });
  }

  const itemsTotalCost = trackingItems.reduce((sum, it) => sum + (it.totalCostCOP || 0), 0);
  const effectiveTotal = order.detectedEstimatedTotal || itemsTotalCost;

  // New Supplier Purchase Order structure
  const newPO: SupplierPurchaseOrder = {
    id: `po-${Date.now()}`,
    ocNumber: ocNumber,
    supplier: cleanSupplier,
    paymentTerms: 'Crédito 30 Días',
    paymentStatus: 'Pendiente',
    status: 'Emitida',
    items: trackingItems,
    createdAt: nowIso,
    lastUpdatedAt: nowIso,
    notes: `Generada automáticamente desde correo: ${order.subject}`,
  };

  // Find if a contract already matches to attach the PO, or create a new contract
  let targetContract: OCTrackingContract;
  let updatedContracts: OCTrackingContract[];

  const existingIdx = existingContracts.findIndex(
    (c) =>
      c.id === matchInfo.matchedId ||
      c.ocNumber?.toLowerCase() === ocNumber.toLowerCase() ||
      c.contractNumber?.toLowerCase() === matchInfo.contractNumber.toLowerCase()
  );

  if (existingIdx >= 0) {
    const prev = existingContracts[existingIdx];
    const existingPOs = prev.purchaseOrders || [];
    const alreadyHasPO = existingPOs.some((p) => p.ocNumber?.toLowerCase() === ocNumber.toLowerCase());

    const updatedPOs = alreadyHasPO
      ? existingPOs.map((p) => (p.ocNumber?.toLowerCase() === ocNumber.toLowerCase() ? newPO : p))
      : [...existingPOs, newPO];

    targetContract = {
      ...prev,
      ocNumber: ocNumber,
      supplier: cleanSupplier,
      totalCostCOP: prev.totalCostCOP + effectiveTotal,
      items: [...prev.items, ...trackingItems],
      purchaseOrders: updatedPOs,
      lastUpdatedAt: nowIso,
      notes: `${prev.notes || ''}\n[${new Date().toLocaleDateString('es-CO')}] Vinculada OC #${ocNumber} con proveedor ${cleanSupplier}.`.trim(),
    };

    updatedContracts = [...existingContracts];
    updatedContracts[existingIdx] = targetContract;
  } else {
    // Create new tracking contract
    targetContract = {
      id: `oc-contract-${Date.now()}`,
      contractNumber: matchInfo.contractNumber,
      ocNumber: ocNumber,
      sourceType: matchInfo.sourceType,
      tenderClientId: matchInfo.matchedType === 'licitacion' ? matchInfo.matchedId : undefined,
      salesOrderId: matchInfo.matchedType === 'orden_venta' ? matchInfo.matchedId : undefined,
      quoteId: matchInfo.matchedType === 'cotizacion' ? matchInfo.matchedId : undefined,
      clientName: matchInfo.clientName,
      nit: matchInfo.nit,
      city: matchInfo.city,
      supplier: cleanSupplier,
      totalCostCOP: effectiveTotal,
      items: trackingItems,
      purchaseOrders: [newPO],
      globalStatus: 'Emitida',
      paymentTerms: '30 días crédito',
      paymentStatus: 'Pendiente',
      createdAt: nowIso,
      lastUpdatedAt: nowIso,
      notes: `Registrado automáticamente desde Gmail Compras (OC #${ocNumber}). Vinculado a ${matchInfo.matchedTitle}.`,
    };

    updatedContracts = [targetContract, ...existingContracts];
  }

  // Persist to storage & Firestore sync
  saveStoredOCTrackingContracts(updatedContracts);

  const reasonsText = matchInfo.matchReasons.length > 0 ? `\n• Motivo: ${matchInfo.matchReasons.join(', ')}` : '';

  return {
    success: true,
    contract: targetContract,
    matchInfo,
    message: `✓ Orden de Compra #${ocNumber} transferida exitosamente a Ventana 5 (Seguimiento de OC).\n\n• Vinculada a: ${matchInfo.matchedTitle}\n• Proveedor: ${cleanSupplier}\n• Ítems registrados: ${trackingItems.length}${reasonsText}`,
  };
}
