import {
  MedicalEquipment,
  OCTrackingContract,
  OCTrackingItem,
  SupplierPurchaseOrder,
} from '../types';
import {
  DetectedPurchaseOrder,
  DetectedPurchaseOrderItem,
  DetectedPartToImport,
} from '../services/gmailIntegrationService';
import { cleanSupplierName } from './cleanSupplierUtils';
import { detectMatchingProjectForOC } from './linkOCTrackingUtils';
import {
  getStoredOCTrackingContracts,
  saveStoredOCTrackingContracts,
  autoRegisterSuppliersFromEquipments,
} from './ocTrackingStorage';
import {
  saveSingleEquipmentToFirestore,
  saveEquipmentsBatchToFirestore,
  saveOCTrackingContractsToFirestore,
} from '../services/realtimeSync';

export interface ExtractedPartCandidate {
  code: string;
  name: string;
  brand: string;
  model: string;
  quantity: number;
  unitPrice: number;
  supplier: string;
  subReferences?: string;
  isExisting: boolean;
  existingId?: string;
  previousCost?: number;
  statusAction: 'create' | 'update';
}

export interface ConvertOCToTrackingResult {
  success: boolean;
  ocNumber: string;
  contractNumber: string;
  createdPartsCount: number;
  updatedPartsCount: number;
  totalParts: number;
  parts: ExtractedPartCandidate[];
  targetContract: OCTrackingContract;
  supplier: string;
  updatedCatalog: MedicalEquipment[];
  message: string;
}

/**
 * Extracts and standardizes all part candidates from an incoming detected purchase order.
 * Accurately detects part numbers, descriptions, prices, quantities, and suppliers.
 */
export function extractPartCandidatesFromOrder(
  order: DetectedPurchaseOrder,
  catalog: MedicalEquipment[]
): ExtractedPartCandidate[] {
  const candidates: ExtractedPartCandidate[] = [];
  const cleanSupplier = cleanSupplierName(order.senderName || order.sender) || 'Proveedor SYD';

  // Helper to extract or normalize part number
  const extractCode = (rawCode?: string, rawDesc?: string, fallbackIdx = 1): string => {
    if (rawCode && rawCode.trim().length > 0) {
      return rawCode.trim().toUpperCase();
    }
    if (rawDesc) {
      // Check for common patterns: e.g. "PARTE 33681", "REF: 12345", "COD. 44521", "SYD-001"
      const matchPattern = rawDesc.match(
        /\b(?:parte|parte\s*n[oó]|p\/n|c[oó]d(?:igo)?|ref(?:erencia)?)\s*[:#-]?\s*([A-Z0-9\-_]{3,20})\b/i
      );
      if (matchPattern && matchPattern[1]) {
        return matchPattern[1].toUpperCase();
      }
      // Check for standalone code like SYD-XXXX or numbers 4-8 digits
      const matchStandalone = rawDesc.match(/\b([A-Z]{2,4}-\d{3,8})\b/i) || rawDesc.match(/\b(\d{4,8})\b/);
      if (matchStandalone && matchStandalone[1]) {
        return matchStandalone[1].toUpperCase();
      }
    }
    // Deterministic fallback code based on order and index
    const baseNumber = order.detectedOCNumber ? order.detectedOCNumber.replace(/[^A-Z0-9]/gi, '') : Date.now().toString().slice(-4);
    return `SYD-P-${baseNumber}-${fallbackIdx.toString().padStart(2, '0')}`;
  };

  // 1. Check order.detectedItems
  if (order.detectedItems && order.detectedItems.length > 0) {
    order.detectedItems.forEach((it, idx) => {
      const code = extractCode(it.partCode, it.description, idx + 1);
      const name = (it.description || `Parte #${code}`).trim();
      const brand = (it.brand || cleanSupplier || 'SYD Biomedical').trim();
      const model = (it.model || 'Estándar').trim();
      const quantity = Math.max(1, Number(it.quantity) || 1);
      const unitPrice = Math.max(0, Number(it.unitPrice) || 0);

      candidates.push({
        code,
        name,
        brand,
        model,
        quantity,
        unitPrice,
        supplier: cleanSupplier,
        subReferences: it.partCode && it.partCode !== code ? it.partCode : '',
        isExisting: false,
        statusAction: 'create',
      });
    });
  }

  // 2. Check order.detectedPartsToImport
  if (order.detectedPartsToImport && order.detectedPartsToImport.length > 0) {
    order.detectedPartsToImport.forEach((p, idx) => {
      const code = extractCode(p.code, p.name, candidates.length + idx + 1);
      // Avoid duplicate by code in candidates
      const existingInCandidates = candidates.find((c) => c.code.toUpperCase() === code.toUpperCase());
      if (existingInCandidates) {
        if (!existingInCandidates.unitPrice && p.baseCostCOP) {
          existingInCandidates.unitPrice = p.baseCostCOP;
        }
        return;
      }

      candidates.push({
        code,
        name: p.name || `Parte #${code}`,
        brand: p.brand || cleanSupplier || 'SYD Biomedical',
        model: p.model || 'Estándar',
        quantity: 1,
        unitPrice: p.baseCostCOP || 0,
        supplier: p.supplier ? cleanSupplierName(p.supplier) : cleanSupplier,
        subReferences: p.subReferences || '',
        isExisting: false,
        statusAction: 'create',
      });
    });
  }

  // 3. Check requested items in partCreationNotice
  const noticeItems = order.partCreationNotice?.requestedItems || (order.partCreationNotice?.requestedItem ? [order.partCreationNotice.requestedItem] : []);
  if (noticeItems.length > 0) {
    noticeItems.forEach((n, idx) => {
      const code = extractCode(n.partCode, n.name, candidates.length + idx + 1);
      const existingInCandidates = candidates.find((c) => c.code.toUpperCase() === code.toUpperCase());
      if (existingInCandidates) {
        if (!existingInCandidates.unitPrice && n.price) {
          existingInCandidates.unitPrice = n.price;
        }
        return;
      }

      candidates.push({
        code,
        name: n.name || `Parte #${code}`,
        brand: n.brand || cleanSupplier || 'SYD Biomedical',
        model: n.model || 'Estándar',
        quantity: n.quantity || 1,
        unitPrice: n.price || 0,
        supplier: n.supplier ? cleanSupplierName(n.supplier) : cleanSupplier,
        subReferences: n.subReferences || '',
        isExisting: false,
        statusAction: 'create',
      });
    });
  }

  // 4. Fallback if no structured parts were detected: parse from body text or create single item
  if (candidates.length === 0) {
    const rawText = `${order.subject || ''}\n${order.snippet || ''}`;
    // Look for lines containing item/code/price
    const codeMatch = rawText.match(/\b([A-Z]{2,4}-\d{3,8}|\d{4,8})\b/i);
    const fallbackCode = codeMatch ? codeMatch[1].toUpperCase() : `SYD-OC-${Date.now().toString().slice(-4)}`;
    
    candidates.push({
      code: fallbackCode,
      name: order.subject || 'Suministro de Equipos y Partes Médicas',
      brand: cleanSupplier,
      model: 'General',
      quantity: 1,
      unitPrice: order.detectedEstimatedTotal || 0,
      supplier: cleanSupplier,
      subReferences: '',
      isExisting: false,
      statusAction: 'create',
    });
  }

  // Check existence against current catalog by unique part number (code)
  return candidates.map((cand) => {
    const cleanCandCode = cand.code.trim().toUpperCase();
    const existing = catalog.find((eq) => {
      if (eq.code && eq.code.trim().toUpperCase() === cleanCandCode) return true;
      if (eq.id && eq.id.trim().toUpperCase() === cleanCandCode) return true;
      if (eq.subReferences) {
        const subRefs = eq.subReferences.split(/[,;\s]+/).map((s) => s.trim().toUpperCase());
        if (subRefs.includes(cleanCandCode)) return true;
      }
      return false;
    });

    if (existing) {
      return {
        ...cand,
        isExisting: true,
        existingId: existing.id,
        previousCost: existing.baseCostCOP,
        statusAction: 'update',
        brand: cand.brand && cand.brand !== 'SYD' ? cand.brand : existing.brand,
        model: cand.model && cand.model !== 'Estándar' ? cand.model : existing.model,
      };
    }

    return {
      ...cand,
      isExisting: false,
      statusAction: 'create',
    };
  });
}

/**
 * Converts a detected order / email into an official Purchase Order in Seguimiento de OC (Ventana 5),
 * and simultaneously creates uncreated parts or updates existing parts in the Equipment Catalog (Ventana 3).
 */
export async function convertOrderToPurchaseOrderAndSyncParts(params: {
  order: DetectedPurchaseOrder;
  customOCNumber?: string;
  catalog: MedicalEquipment[];
  onAddEquipmentToCatalog?: (equipment: MedicalEquipment) => void;
  onBatchSaveEquipments?: (catalog: MedicalEquipment[], count: number, mode: 'append_update') => void;
}): Promise<ConvertOCToTrackingResult> {
  const { order, customOCNumber, catalog, onAddEquipmentToCatalog, onBatchSaveEquipments } = params;
  const nowIso = new Date().toISOString();

  // 1. Determine effective OC Number
  const effectiveOCNumber = (
    customOCNumber?.trim() ||
    order.detectedOCNumber?.trim() ||
    `OC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`
  ).toUpperCase();

  const cleanSupplier = cleanSupplierName(order.senderName || order.sender) || 'Proveedor SYD';

  // 2. Extract and analyze parts
  const partCandidates = extractPartCandidatesFromOrder(order, catalog);

  // 3. Process each part: update existing or create new
  let updatedCatalog = [...catalog];
  let createdCount = 0;
  let updatedCount = 0;

  partCandidates.forEach((part, idx) => {
    const cleanCode = part.code.trim().toUpperCase();
    const existingIndex = updatedCatalog.findIndex((eq) => {
      if (eq.code && eq.code.trim().toUpperCase() === cleanCode) return true;
      if (eq.id && eq.id.trim().toUpperCase() === cleanCode) return true;
      if (eq.subReferences) {
        const subRefs = eq.subReferences.split(/[,;\s]+/).map((s) => s.trim().toUpperCase());
        if (subRefs.includes(cleanCode)) return true;
      }
      return false;
    });

    if (existingIndex >= 0) {
      // PART ALREADY CREATED: Update existing equipment data
      const existing = updatedCatalog[existingIndex];
      const updatedEq: MedicalEquipment = {
        ...existing,
        // Update baseCostCOP if new cost is positive
        baseCostCOP: part.unitPrice > 0 ? part.unitPrice : existing.baseCostCOP,
        // Update supplier
        supplier: cleanSupplier || existing.supplier,
        // Brand and Model update if candidate has more specific info
        brand: (!existing.brand || existing.brand === 'SYD' || existing.brand === 'General') && part.brand ? part.brand : existing.brand,
        model: (!existing.model || existing.model === 'General' || existing.model === 'Estándar') && part.model ? part.model : existing.model,
        // SubReferences append
        subReferences: part.subReferences
          ? existing.subReferences
            ? `${existing.subReferences}, ${part.subReferences}`
            : part.subReferences
          : existing.subReferences,
        allSuppliers: Array.from(
          new Set([
            ...(existing.allSuppliers || []),
            cleanSupplier,
            ...(existing.supplier ? [existing.supplier] : []),
          ])
        ).filter(Boolean),
      };

      updatedCatalog[existingIndex] = updatedEq;
      updatedCount++;

      // Save directly to Firestore for immediate persistence
      saveSingleEquipmentToFirestore(updatedEq).catch(() => {});
      if (onAddEquipmentToCatalog) {
        onAddEquipmentToCatalog(updatedEq);
      }
    } else {
      // PART NOT CREATED: Create automatically in Catalog
      const newEquipment: MedicalEquipment = {
        id: `eq_part_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
        code: cleanCode,
        name: part.name || `Parte #${cleanCode}`,
        brand: part.brand || cleanSupplier || 'SYD Biomedical',
        model: part.model || 'Estándar',
        originCountry: 'Importado',
        category: /laringo|cirug|quir/i.test(part.name) ? 'Cirugía' : 'Accesorios',
        productGroup: 'Equipos Médicos',
        supplier: cleanSupplier,
        allSuppliers: cleanSupplier ? [cleanSupplier] : [],
        baseCostCOP: part.unitPrice || 0,
        taxExempt: false,
        taxRate: 19,
        defaultMarginList: 'L4',
        warrantyMonths: 12,
        invimaRecordNumber: 'En Trámite',
        subReferences: part.subReferences || '',
        description: `Parte creada automáticamente al convertir Orden de Compra #${effectiveOCNumber} (Correo: ${order.subject || 'Gmail Compras'})`,
        standardAccessories: [],
        technicalSpecs: [],
        hasDocSheet: false,
        hasInvimaDoc: false,
        hasManual: false,
        hasQualityCert: false,
      };

      updatedCatalog = [newEquipment, ...updatedCatalog];
      createdCount++;

      // Save directly to Firestore
      saveSingleEquipmentToFirestore(newEquipment).catch(() => {});
      if (onAddEquipmentToCatalog) {
        onAddEquipmentToCatalog(newEquipment);
      }
    }
  });

  // Save updated catalog to localStorage and batch update
  try {
    localStorage.setItem('syd_equipments_catalog', JSON.stringify(updatedCatalog));
  } catch {}
  saveEquipmentsBatchToFirestore(updatedCatalog).catch(() => {});

  if (onBatchSaveEquipments) {
    onBatchSaveEquipments(updatedCatalog, createdCount, 'append_update');
  }

  // Auto-register supplier in Ventana 5 (Directorio de Proveedores)
  autoRegisterSuppliersFromEquipments(updatedCatalog);

  // 4. Transfer to Ventana 5 (Seguimiento de OC)
  const existingContracts = getStoredOCTrackingContracts();
  const matchInfo = detectMatchingProjectForOC({
    ...order,
    detectedOCNumber: effectiveOCNumber,
  });

  // Build tracking items
  const trackingItems: OCTrackingItem[] = partCandidates.map((cand, idx) => ({
    id: `item-oc-${Date.now()}-${idx}`,
    equipmentId: cand.code,
    code: cand.code,
    name: cand.name,
    brand: cand.brand || cleanSupplier,
    model: cand.model || 'Estándar',
    quantity: cand.quantity || 1,
    costPriceCOP: cand.unitPrice || 0,
    totalCostCOP: (cand.quantity || 1) * (cand.unitPrice || 0),
    supplier: cleanSupplier,
    ocNumber: effectiveOCNumber,
    status: 'Emitida / Enviada al Proveedor',
    paymentTerms: 'Crédito 30 días',
    paymentStatus: 'Pendiente',
    createdAt: nowIso,
    lastUpdatedAt: nowIso,
    notes: `Convertido automáticamente desde correo: "${order.subject}". Estado catálogo: ${
      cand.isExisting ? 'Parte existente actualizada' : 'Parte nueva creada'
    }.`,
    history: [
      {
        id: `log-conv-${Date.now()}-${idx}`,
        timestamp: nowIso,
        newStatus: 'Emitida / Enviada al Proveedor',
        user: 'Sistema Gmail Compras',
        note: `Orden de Compra formalizada. Parte ${cand.code} (${cand.isExisting ? 'actualizada' : 'creada'}) en Catálogo.`,
      },
    ],
  }));

  const itemsTotalCost = trackingItems.reduce((sum, it) => sum + (it.totalCostCOP || 0), 0);
  const effectiveTotal = order.detectedEstimatedTotal || itemsTotalCost;

  const newPO: SupplierPurchaseOrder = {
    id: `po-${Date.now()}`,
    ocNumber: effectiveOCNumber,
    supplier: cleanSupplier,
    paymentTerms: 'Crédito 30 Días',
    paymentStatus: 'Pendiente',
    status: 'Emitida',
    items: trackingItems,
    createdAt: nowIso,
    lastUpdatedAt: nowIso,
    notes: `Convertida automáticamente desde correo Gmail: ${order.subject}`,
  };

  let targetContract: OCTrackingContract;
  let updatedContracts: OCTrackingContract[];

  const existingIdx = existingContracts.findIndex(
    (c) =>
      c.id === matchInfo.matchedId ||
      c.ocNumber?.toLowerCase() === effectiveOCNumber.toLowerCase() ||
      (c.purchaseOrders && c.purchaseOrders.some((p) => p.ocNumber?.toLowerCase() === effectiveOCNumber.toLowerCase())) ||
      c.contractNumber?.toLowerCase() === matchInfo.contractNumber.toLowerCase()
  );

  if (existingIdx >= 0) {
    const prev = existingContracts[existingIdx];
    const existingPOs = prev.purchaseOrders || [];
    const alreadyHasPO = existingPOs.some((p) => p.ocNumber?.toLowerCase() === effectiveOCNumber.toLowerCase());

    const updatedPOs = alreadyHasPO
      ? existingPOs.map((p) => (p.ocNumber?.toLowerCase() === effectiveOCNumber.toLowerCase() ? newPO : p))
      : [...existingPOs, newPO];

    targetContract = {
      ...prev,
      ocNumber: effectiveOCNumber,
      supplier: cleanSupplier,
      totalCostCOP: (prev.totalCostCOP || 0) + effectiveTotal,
      items: [...prev.items, ...trackingItems],
      purchaseOrders: updatedPOs,
      lastUpdatedAt: nowIso,
      notes: `${prev.notes || ''}\n[${new Date().toLocaleDateString('es-CO')}] Vinculada OC #${effectiveOCNumber} (${partCandidates.length} partes procesadas).`.trim(),
    };

    updatedContracts = [...existingContracts];
    updatedContracts[existingIdx] = targetContract;
  } else {
    targetContract = {
      id: `oc-contract-${Date.now()}`,
      contractNumber: matchInfo.contractNumber || `CONT-${effectiveOCNumber}`,
      ocNumber: effectiveOCNumber,
      sourceType: matchInfo.sourceType || 'manual',
      tenderClientId: matchInfo.matchedType === 'licitacion' ? matchInfo.matchedId : undefined,
      salesOrderId: matchInfo.matchedType === 'orden_venta' ? matchInfo.matchedId : undefined,
      quoteId: matchInfo.matchedType === 'cotizacion' ? matchInfo.matchedId : undefined,
      clientName: matchInfo.clientName || 'Cliente SYD Colombia',
      nit: matchInfo.nit || '800.149.201-1',
      city: matchInfo.city || 'Barranquilla',
      supplier: cleanSupplier,
      supplierNit: '',
      supplierContact: order.senderName || '',
      paymentTerms: 'Crédito 30 días',
      paymentStatus: 'Pendiente',
      globalStatus: 'Emitida / Enviada al Proveedor',
      totalCostCOP: effectiveTotal,
      items: trackingItems,
      purchaseOrders: [newPO],
      createdAt: nowIso,
      lastUpdatedAt: nowIso,
      notes: `Orden de Compra originada desde correo "${order.subject}". ${createdCount} partes nuevas creadas, ${updatedCount} actualizadas.`,
    };

    updatedContracts = [targetContract, ...existingContracts];
  }

  // Persist contracts
  saveStoredOCTrackingContracts(updatedContracts);
  saveOCTrackingContractsToFirestore(updatedContracts).catch(() => {});

  // Dispatch storage event so all tabs/windows update in real time
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('syd_oc_contracts_updated', { detail: updatedContracts }));
    window.dispatchEvent(new CustomEvent('syd_equipments_updated', { detail: updatedCatalog }));
  }

  return {
    success: true,
    ocNumber: effectiveOCNumber,
    contractNumber: targetContract.contractNumber,
    createdPartsCount: createdCount,
    updatedPartsCount: updatedCount,
    totalParts: partCandidates.length,
    parts: partCandidates,
    targetContract,
    supplier: cleanSupplier,
    updatedCatalog,
    message: `Orden de Compra #${effectiveOCNumber} pasada exitosamente a Seguimiento de OC. Se crearon ${createdCount} partes y se actualizaron ${updatedCount} partes en el Catálogo.`,
  };
}
