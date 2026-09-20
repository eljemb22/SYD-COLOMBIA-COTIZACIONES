import { OFFICIAL_SYD_LETTERHEAD_BASE64_DATA_URL } from './sydOfficialLetterheadData';

/**
 * Official SyD Colombia S.A. Corporate Letterhead Generator
 * Faithfully matches the official corporate stationery:
 * - Left vertical cyan band with vertical text: "Nit.: 802.000.608-7" positioned in upper section
 * - Bottom-left navy block with vertical text: "www.syd.com.co"
 * - Top-right official corporate logo: "SyD Colombia S.A." (registered trademark ®)
 * - Bottom-right official certification seals: ICONTEC ISO 9001 (SC7290-1) + IQNET Certified Management System
 * - Bottom office addresses for Barranquilla, Bogotá, Medellín, and Popayán
 */

export const OFFICIAL_SYD_LETTERHEAD_SVG_PATH = '/logos/syd_official_letterhead.svg';
export const OFFICIAL_SYD_LETTERHEAD_PNG_PATH = '/logos/syd_official_letterhead.png';

let cachedLetterheadDataUrl: string | null = null;

export function getOfficialSyDLetterheadDataUrl(): string {
  if (cachedLetterheadDataUrl) {
    return cachedLetterheadDataUrl;
  }

  // Pre-compiled high-resolution corporate letterhead (1700x2200 Letter size, 300 DPI)
  if (
    OFFICIAL_SYD_LETTERHEAD_BASE64_DATA_URL &&
    OFFICIAL_SYD_LETTERHEAD_BASE64_DATA_URL.startsWith('data:image/png;base64,')
  ) {
    cachedLetterheadDataUrl = OFFICIAL_SYD_LETTERHEAD_BASE64_DATA_URL;
    return cachedLetterheadDataUrl;
  }

  return OFFICIAL_SYD_LETTERHEAD_PNG_PATH;
}
