import { DetectedPurchaseOrder } from '../services/gmailIntegrationService';
import { MedicalEquipment } from '../types';
import { MASTER_EQUIPMENTS_CATALOG } from '../data/masterEquipmentsCatalog';

export interface WorkflowStageItem {
  stage: 'authorization' | 'part_created' | 'supplier_po' | 'client_po' | 'documentation' | 'other';
  label: string;
  order: DetectedPurchaseOrder;
  isCurrent: boolean;
  partCodes: string[];
  ocNumber?: string;
  sender: string;
  date: string;
}

export interface WorkflowChain {
  hasRelation: boolean;
  totalRelated: number;
  partCodes: string[];
  ocNumbers: string[];
  stages: WorkflowStageItem[];
}

/**
 * Normalizes subject for matching threads with RE:, Fwd:, etc.
 */
function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(?:re|fwd|rv|enc|fwd|reenv[ií]o)\s*:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Extracts all unique part codes mentioned in an order
 */
export function extractOrderPartCodes(order: DetectedPurchaseOrder): string[] {
  const codes = new Set<string>();

  if (order.detectedPartsToImport && order.detectedPartsToImport.length > 0) {
    order.detectedPartsToImport.forEach((p) => {
      if (p.code && /^\d{4,8}$|^SYD-[A-Z0-9\-_]+/i.test(p.code)) {
        codes.add(p.code.toUpperCase());
      }
    });
  }

  if (order.detectedItems && order.detectedItems.length > 0) {
    order.detectedItems.forEach((it) => {
      if (it.partCode && /^\d{4,8}$|^SYD-[A-Z0-9\-_]+/i.test(it.partCode)) {
        codes.add(it.partCode.toUpperCase());
      }
    });
  }

  // Also check raw text for explicit created codes or part patterns
  const text = `${order.subject} ${order.rawBodyText || order.snippet || ''}`;
  const codeMatches = text.match(/\b(?:parte\s+creada|c[oó]digo|parte|c[oó]digo\s+creado)\s*[:#-]?\s*(\d{4,8})\b/gi);
  if (codeMatches) {
    codeMatches.forEach((m) => {
      const num = m.match(/\d{4,8}/);
      if (num && !/^(?:3302424|605|8059)$/.test(num[0])) {
        codes.add(num[0]);
      }
    });
  }

  return Array.from(codes);
}

/**
 * Check if a part code is already created in the app's equipment catalog or master catalog
 */
export function isPartAlreadyCreatedInApp(code: string, equipments: MedicalEquipment[]): boolean {
  if (!code) return false;
  const clean = code.trim().toUpperCase();
  return (
    equipments.some((eq) => eq.code && eq.code.trim().toUpperCase() === clean) ||
    MASTER_EQUIPMENTS_CATALOG.some((eq) => eq.code && eq.code.trim().toUpperCase() === clean)
  );
}

/**
 * Correlates an order with other orders across the workflow lifecycle
 */
export function findRelatedWorkflowOrders(
  currentOrder: DetectedPurchaseOrder,
  allOrders: DetectedPurchaseOrder[]
): WorkflowChain {
  const currentPartCodes = extractOrderPartCodes(currentOrder);
  const currentSubjectNorm = normalizeSubject(currentOrder.subject);
  const currentOC = currentOrder.detectedOCNumber?.trim().toUpperCase();

  const related = allOrders.filter((o) => {
    // Exact same message is not "another" related email
    if (o.id === currentOrder.id || o.messageId === currentOrder.messageId) {
      return true;
    }

    // 1. Thread matching
    if (currentOrder.threadId && o.threadId && currentOrder.threadId === o.threadId) {
      return true;
    }

    // 2. Matching OC number
    const otherOC = o.detectedOCNumber?.trim().toUpperCase();
    if (currentOC && otherOC && currentOC === otherOC) {
      return true;
    }

    // 3. Matching Part code
    const otherPartCodes = extractOrderPartCodes(o);
    const hasCommonPartCode = currentPartCodes.some((code) => otherPartCodes.includes(code));
    if (hasCommonPartCode) {
      return true;
    }

    // 4. Normalized Subject matching (if subject is specific enough, > 15 chars)
    if (currentSubjectNorm.length > 15) {
      const otherSubjectNorm = normalizeSubject(o.subject);
      if (
        otherSubjectNorm === currentSubjectNorm ||
        (otherSubjectNorm.includes(currentSubjectNorm) && currentSubjectNorm.length > 20) ||
        (currentSubjectNorm.includes(otherSubjectNorm) && otherSubjectNorm.length > 20)
      ) {
        return true;
      }
    }

    return false;
  });

  const allRelatedPartCodes = new Set<string>();
  const allRelatedOCs = new Set<string>();

  related.forEach((o) => {
    extractOrderPartCodes(o).forEach((c) => allRelatedPartCodes.add(c));
    if (o.detectedOCNumber) {
      allRelatedOCs.add(o.detectedOCNumber.toUpperCase());
    }
  });

  // Map to stages and sort logically: Authorization -> Part Created -> Supplier PO -> Client PO
  const stages: WorkflowStageItem[] = related.map((ord) => {
    let stage: WorkflowStageItem['stage'] = 'other';
    let label = 'Correo Relacionado';

    if (ord.emailType === 'documentation') {
      stage = 'documentation';
      label = 'Documentación Técnica';
    } else if (ord.emailType === 'part_authorization') {
      stage = 'authorization';
      label = '1. Autorización Técnica';
    } else if (ord.emailType === 'part_creation_response') {
      stage = 'part_created';
      label = '2. Creación de Parte';
    } else if (ord.emailType === 'general_po' || ord.emailType === 'oc_response') {
      stage = 'supplier_po';
      label = '3. Orden de Compra Proveedor';
    } else if (ord.emailType === 'client_po') {
      stage = 'client_po';
      label = '4. Orden de Compra Cliente';
    }

    return {
      stage,
      label,
      order: ord,
      isCurrent: ord.id === currentOrder.id || ord.messageId === currentOrder.messageId,
      partCodes: extractOrderPartCodes(ord),
      ocNumber: ord.detectedOCNumber,
      sender: ord.senderName || ord.sender || 'Remitente',
      date: ord.date || '',
    };
  });

  // Sort chronological or by stage sequence
  const stageOrder = { documentation: 0, authorization: 1, part_created: 2, supplier_po: 3, client_po: 4, other: 5 };
  stages.sort((a, b) => stageOrder[a.stage] - stageOrder[b.stage]);

  return {
    hasRelation: related.length > 1,
    totalRelated: related.length,
    partCodes: Array.from(allRelatedPartCodes),
    ocNumbers: Array.from(allRelatedOCs),
    stages,
  };
}
