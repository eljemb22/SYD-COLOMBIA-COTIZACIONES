/**
 * Clean Supplier Utils for SYD Colombia Purchasing System.
 * Strips internal ERP/accounting vendor code prefixes like "P331", "P-331", "P 331",
 * "PROV-123", "PRV-331", "COD 402", "[P331]", "(P331)", etc., leaving ONLY the clean supplier company name.
 * Example: "P331 TECNICA ELECTRO MEDICA S.A." -> "TECNICA ELECTRO MEDICA S.A."
 */

export function cleanSupplierName(rawSupplier?: string): string {
  if (!rawSupplier) return '';
  let cleaned = rawSupplier.trim();

  // Strip bracketed prefixes like "[P331] " or "(P331) " or "[331]"
  cleaned = cleaned.replace(/^[\[\(]\s*P?\d+\s*[\]\)]\s*[-–—:.\s]*/i, '');

  // Strip patterns like "P331 ", "P-331 ", "P 331 - ", "PROV-331 ", "PRV-012 ", "COD-123 ", "PROVEEDOR 331 "
  cleaned = cleaned.replace(
    /^(?:P\s*[-_#:]?\s*\d+|PROV(?:EEDOR)?\s*[-_#:]?\s*\d+|PRV\s*[-_#:]?\s*\d+|COD(?:IGO)?\s*[-_#:]?\s*\d+)\s*[-–—:.\s]*/i,
    ''
  );

  // Strip leading numbers followed by hyphen, dash, or colon, e.g. "331 - TECNICA ELECTRO MEDICA"
  cleaned = cleaned.replace(/^\d{2,6}\s*[-–—:]\s*/, '');

  // Strip leading/trailing non-alphanumeric noise and dashes
  cleaned = cleaned.replace(/^[-–—:.\s]+/, '').replace(/[-–—:.\s]+$/, '').trim();

  return cleaned || rawSupplier.trim();
}
