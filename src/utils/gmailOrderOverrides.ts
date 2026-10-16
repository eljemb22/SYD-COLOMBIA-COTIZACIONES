import { DetectedPurchaseOrder, DetectedPartToImport, DetectedPurchaseOrderItem } from '../services/gmailIntegrationService';

const STORAGE_KEY = 'syd_gmail_orders_custom_edits_v1';

export type OrderOverrideData = {
  emailType?: 'part_creation_response' | 'part_authorization' | 'oc_response' | 'general_po' | 'client_po' | 'documentation' | 'meeting_invite' | 'other';
  detectedOCNumber?: string;
  detectedCustomer?: string;
  detectedEstimatedTotal?: number;
  detectedItems?: DetectedPurchaseOrderItem[];
  detectedPartsToImport?: DetectedPartToImport[];
  urgency?: 'Alta' | 'Media' | 'Baja';
  lastModified?: string;
};

/**
 * Get all stored overrides from localStorage
 */
export function getStoredOrderOverrides(): Record<string, OrderOverrideData> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Error reading stored order overrides:', err);
    return {};
  }
}

/**
 * Save an override for a specific order ID or message ID
 */
export function saveOrderOverride(
  orderKey: string,
  updates: OrderOverrideData
): void {
  if (typeof window === 'undefined' || !orderKey) return;
  try {
    const all = getStoredOrderOverrides();
    const dataWithTs = {
      ...(all[orderKey] || {}),
      ...updates,
      lastModified: new Date().toISOString(),
    };
    all[orderKey] = dataWithTs;

    // Also persist under stripped or msg_ prefixed key to guarantee seamless lookup
    const rawKey = orderKey.replace(/^msg_/, '');
    if (rawKey) {
      all[rawKey] = { ...(all[rawKey] || {}), ...dataWithTs };
      all[`msg_${rawKey}`] = { ...(all[`msg_${rawKey}`] || {}), ...dataWithTs };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('Error saving order override:', err);
  }
}

/**
 * Remove an override for a specific order
 */
export function removeOrderOverride(orderKey: string): void {
  if (typeof window === 'undefined' || !orderKey) return;
  try {
    const all = getStoredOrderOverrides();
    delete all[orderKey];
    const rawKey = orderKey.replace(/^msg_/, '');
    if (rawKey) {
      delete all[rawKey];
      delete all[`msg_${rawKey}`];
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('Error removing order override:', err);
  }
}

/**
 * Apply any stored overrides to a DetectedPurchaseOrder
 */
export function applyOrderOverrides(order: DetectedPurchaseOrder): DetectedPurchaseOrder {
  const all = getStoredOrderOverrides();
  const rawId = order.id ? order.id.replace(/^msg_/, '') : undefined;
  const rawMsgId = order.messageId ? order.messageId.replace(/^msg_/, '') : undefined;

  const override =
    all[order.id] ||
    (rawId ? all[rawId] : undefined) ||
    (rawId ? all[`msg_${rawId}`] : undefined) ||
    (order.messageId ? all[order.messageId] : undefined) ||
    (rawMsgId ? all[rawMsgId] : undefined) ||
    (rawMsgId ? all[`msg_${rawMsgId}`] : undefined);

  if (!override) return order;

  const rawText = (order.rawBodyText || order.snippet || '').toLowerCase();
  const sender = (order.sender || order.senderEmail || order.senderName || '').toLowerCase();
  const isFromDiana = sender.includes('auxadministrativo@syd.com.co') || sender.includes('diana figueroa');
  const isNegativeNotice =
    rawText.includes('no cuenta con parte') ||
    rawText.includes('no se cuenta con parte') ||
    rawText.includes('información vigente no') ||
    rawText.includes('informacion vigente no');

  // Apply manual user overrides faithfully so the user can classify as Info, OC, or Part Creation
  const effectiveEmailType = override.emailType !== undefined ? override.emailType : order.emailType;
  let effectiveParts = override.detectedPartsToImport !== undefined ? override.detectedPartsToImport : order.detectedPartsToImport;

  // Authorization and Info emails never have importable parts
  if (effectiveEmailType === 'part_authorization' || effectiveEmailType === 'other') {
    effectiveParts = undefined;
  } else if (effectiveParts && effectiveParts.length > 0) {
    // Filter out invalid/garbage codes (years, telephone numbers, ext)
    const INVALID_CODES = new Set(['2024', '2025', '2026', '2027', '2028', '3302424', '2424', '20330', '20316', '605', '8059', '123']);
    effectiveParts = effectiveParts.filter((p) => p.code && !INVALID_CODES.has(p.code));
  }

  return {
    ...order,
    emailType: effectiveEmailType,
    detectedOCNumber: override.detectedOCNumber !== undefined ? override.detectedOCNumber : order.detectedOCNumber,
    detectedCustomer: override.detectedCustomer !== undefined ? override.detectedCustomer : order.detectedCustomer,
    detectedEstimatedTotal:
      override.detectedEstimatedTotal !== undefined
        ? override.detectedEstimatedTotal
        : order.detectedEstimatedTotal,
    detectedItems: override.detectedItems !== undefined ? override.detectedItems : order.detectedItems,
    detectedPartsToImport: effectiveParts,
    urgency: override.urgency !== undefined ? override.urgency : order.urgency,
  };
}
