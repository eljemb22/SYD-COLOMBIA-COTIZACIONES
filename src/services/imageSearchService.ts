/**
 * Service to search product and biomedical equipment images from internet sources
 * and convert them to clean Base64 data URLs via proxy.
 * Only returns REAL photographs of modern medical equipment - no illustrations,
 * drawings, historical photos, or generic medical images.
 */

export interface ProductImageOption {
  title: string;
  url: string;
  thumbnail: string;
  source?: string;
  width?: number;
  height?: number;
}

export interface SearchImagesResponse {
  success: boolean;
  query: string;
  images: ProductImageOption[];
  error?: string;
}

/**
 * Searches the internet for biomedical equipment images by query or equipment details.
 * Returns images that pass real-photo validation (server-side filtered).
 */
export async function searchEquipmentImagesFromInternet(
  equipmentName: string,
  brand?: string,
  model?: string,
  customQuery?: string
): Promise<ProductImageOption[]> {
  try {
    const finalQuery = (customQuery || [equipmentName, brand, model].filter(Boolean).join(' ')).trim();
    if (!finalQuery) return [];

    const res = await fetch('/api/products/search-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: finalQuery,
        equipmentName,
        brand,
        model,
      }),
    });

    if (res.ok) {
      const data: SearchImagesResponse = await res.json();
      if (Array.isArray(data.images)) {
        return data.images.slice(0, 12);
      }
    }
  } catch (err) {
    console.warn('Error in searchEquipmentImagesFromInternet:', err);
  }

  return [];
}

/**
 * Keywords that indicate an image is NOT a real photograph of equipment.
 * Any match in title or URL causes immediate rejection.
 */
const NON_PHOTO_KEYWORDS = [
  // Non-photographic media
  'illustration', 'drawing', 'sketch', 'diagram', 'chart', 'graph',
  'map', 'painting', 'engraving', 'etching', 'woodcut', 'lithograph',
  'blueprint', 'schematic', 'design', 'plan', 'portrait', 'cartoon',
  'clipart', 'icon', 'symbol', 'logo', 'watermark',
  // Historical/old content
  'historical', 'historic', 'vintage', 'antique', 'old', 'ancient',
  '19th century', '18th century', '17th century', '1600', '1700', '1800', '1900',
  'black and white', 'b&w', 'monochrome', 'sepia', 'retro',
  'tretise', 'treatise', 'trabajo', 'ensayo', 'estudio', 'thesis',
  'diseases of', 'with their homopathi', 'treatise on',
  // Non-equipment medical images
  'radiograph', 'x-ray plate', 'radiography film', 'scan result',
  'ultrasound image', 'mri scan', 'ct scan', 'pet scan',
  'anatomical', 'anatomy', 'skeleton', 'organ', 'cell', 'virus',
  'bacteria', 'microbe', 'dna', 'rna', 'protein',
  // Generic medical stock that's not equipment
  'doctor', 'nurse', 'patient', 'surgeon', 'medical team',
  'hospital corridor', 'waiting room', 'reception',
  'first aid', 'bandage', 'syringe', 'pill', 'capsule',
  'prescription', 'recipe', 'medicine bottle',
];

/**
 * Keywords that indicate a REAL modern product photograph.
 * We want to see these in title or URL.
 */
const REAL_PHOTO_KEYWORDS = [
  'product', 'photo', 'photograph', 'picture', 'image',
  'clinical', 'hospital', 'medical equipment', 'medical device',
  'surgical', 'operating', 'monitor', 'scanner', 'pump',
  'ventilator', 'incubator', 'defibrillator', 'ultrasound',
  'x-ray', 'rayos x', 'table', 'mesa', 'bed', 'camilla',
  'monitor', 'monitor de', 'signos vitales', 'patient monitor',
  'wheeled', 'mobile', 'portable', 'cart', 'carrito',
  'brand new', 'nuevo', 'modern', 'moderno', '2020', '2021', '2022', '2023', '2024', '2025',
  'supplier', 'distributor', 'manufacturer', 'factory',
  'price', 'precio', 'buy', 'comprar', 'sale', 'venta',
  'catalog', 'catálogo', 'brochure', 'datasheet',
];

/**
 * Equipment type keywords that MUST appear in title/URL for that equipment type.
 * This prevents showing a monitor when searching for a surgical table.
 */
const EQUIPMENT_TYPE_KEYWORDS: Record<string, string[]> = {
  'mesa de cirugia': ['mesa', 'operating table', 'surgical table', 'hybase', 'quirurgica', 'cirugía', 'operation table'],
  'monitor': ['monitor', 'patient monitor', 'vital signs', 'umec', 'cardiac monitor'],
  'desfibrilador': ['defibrillator', 'desfibrilador', 'aed', 'cardiac defibrillator'],
  'oximetro': ['oximeter', 'oxímetro', 'pulse oximeter', 'spo2'],
  'incubadora': ['incubator', 'incubadora', 'cunero', 'neonatal', 'incubator'],
  'lámpara': ['lamp', 'lampara', 'lámpara', 'examination light', 'surgical light'],
  'estetoscopio': ['stethoscope', 'estetoscopio', 'fonendoscopio'],
  'fonendoscopio': ['stethoscope', 'estetoscopio', 'fonendoscopio'],
  'pinza': ['forceps', 'pinza', 'surgical forceps', 'hemostatic forceps'],
  'rayos x': ['x-ray', 'rayos x', 'radiography', 'radiographic', 'xray'],
  'mobieye': ['mobieye', 'mobile x-ray', 'mobile radiography'],
  'digieye': ['digieye', 'digital radiography'],
  'tallimetro': ['stadiometer', 'tallímetro', 'height rod', 'measuring rod'],
  'balanza': ['scale', 'balanza', 'báscula', 'weighing scale', 'medical scale'],
  'infantometro': ['infantometer', 'infantómetro', 'baby measuring', 'infant scale'],
  'cuello cisne': ['examination light', 'cuello cisne', 'gs 300', 'gooseneck'],
  'organos': ['ophthalmoscope', 'otoscope', 'órganos', '777'],
  'tomografo': ['ct scanner', 'tomografo', 'computed tomography'],
  'resonancia': ['mri', 'resonancia', 'magnetic resonance'],
};

function buildSearchQueries(
  equipmentName: string,
  brand?: string,
  model?: string
): string[] {
  const queries: string[] = [];
  const cleanName = (equipmentName || '').trim();
  const cleanBrand = (brand || '').trim();
  const cleanModel = (model || '').trim();

  // PRIORITY 1: Most specific - Brand + Model + photo terms
  if (cleanBrand && cleanModel) {
    queries.push(`${cleanBrand} ${cleanModel} product photo medical`);
    queries.push(`${cleanBrand} ${cleanModel} clinical photograph`);
    queries.push(`${cleanBrand} ${cleanModel} hospital equipment photo`);
    queries.push(`${cleanBrand} ${cleanModel} medical device`);
    queries.push(`${cleanBrand} ${cleanModel} supplier`);
  }
  // PRIORITY 2: Name + Brand + Model
  if (cleanName && cleanBrand && cleanModel) {
    queries.push(`${cleanName} ${cleanBrand} ${cleanModel} medical equipment photo`);
    queries.push(`${cleanBrand} ${cleanModel} ${cleanName} clinical photo`);
  }
  // PRIORITY 3: Name + Brand
  if (cleanName && cleanBrand) {
    queries.push(`${cleanName} ${cleanBrand} medical equipment photo`);
    queries.push(`${cleanBrand} ${cleanName} hospital device`);
  }
  // PRIORITY 4: Name + Model
  if (cleanName && cleanModel) {
    queries.push(`${cleanName} ${cleanModel} medical equipment photo`);
  }
  // PRIORITY 5: Just Name + photo terms
  if (cleanName) {
    queries.push(`${cleanName} medical equipment product photo`);
    queries.push(`${cleanName} hospital equipment clinical photo`);
    queries.push(`${cleanName} biomedical device photograph`);
  }
  // PRIORITY 6: Just Brand + Model
  if (cleanBrand && cleanModel) {
    queries.push(`${cleanBrand} ${cleanModel} medical`);
  }

  // Deduplicate while preserving order
  const seen = new Set<string>();
  return queries.filter((q) => {
    const key = q.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isRealEquipmentPhoto(
  option: ProductImageOption,
  equipmentName: string,
  brand?: string,
  model?: string
): boolean {
  const title = (option.title || '').toLowerCase();
  const url = (option.url || '').toLowerCase();
  const combined = `${title} ${url}`;

  const cleanName = (equipmentName || '').toLowerCase();
  const cleanBrand = (brand || '').trim().toLowerCase();
  const cleanModel = (model || '').trim().toLowerCase();

  // REJECT: Non-photo content in title or URL
  if (NON_PHOTO_KEYWORDS.some((k) => combined.includes(k))) return false;

  // REJECT: URLs that look like Wikimedia file pages (often old illustrations)
  if (url.includes('wikimedia.org/wiki/File:') || url.includes('wikipedia.org/wiki/File:')) {
    // Only accept if it's clearly a modern photo
    if (!REAL_PHOTO_KEYWORDS.some((k) => combined.includes(k))) return false;
  }

  // REQUIRE: At least one real photo keyword
  if (!REAL_PHOTO_KEYWORDS.some((k) => combined.includes(k))) return false;

  // REQUIRE: Equipment type match if we can identify the type
  const typeKey = Object.keys(EQUIPMENT_TYPE_KEYWORDS).find((k) =>
    cleanName.includes(k) || cleanModel.includes(k) || cleanBrand.includes(k)
  );

  if (typeKey) {
    const expectedTerms = EQUIPMENT_TYPE_KEYWORDS[typeKey];
    const hasExpectedTerm = expectedTerms.some((t) => combined.includes(t));
    if (!hasExpectedTerm) {
      return false;
    }
  }

  // REQUIRE: At least brand OR model OR name in title/URL for relevance
  const hasBrand = cleanBrand && (combined.includes(cleanBrand) || combined.includes(cleanBrand.replace(/\s+/g, '')));
  const hasModel = cleanModel && (combined.includes(cleanModel) || combined.includes(cleanModel.replace(/\s+/g, '')));
  const hasName = cleanName && (combined.includes(cleanName) || combined.includes(cleanName.replace(/\s+/g, '')));

  if (!hasBrand && !hasModel && !hasName) {
    // Only accept very general medical equipment with strong photo keywords
    const strongPhotoTerms = ['product photo', 'clinical photograph', 'medical device photo', 'hospital equipment photo'];
    if (!strongPhotoTerms.some((t) => combined.includes(t))) return false;
  }

  return true;
}

function scoreImageOption(
  option: ProductImageOption,
  equipmentName: string,
  brand?: string,
  model?: string
): number {
  let score = 0;
  const title = (option.title || '').toLowerCase();
  const url = (option.url || '').toLowerCase();
  const combined = `${title} ${url}`;

  const cleanName = (equipmentName || '').toLowerCase();
  const cleanBrand = (brand || '').trim().toLowerCase();
  const cleanModel = (model || '').trim().toLowerCase();

  // Brand match: +100 points (highest priority)
  if (cleanBrand && combined.includes(cleanBrand)) score += 100;
  // Model match: +100 points
  if (cleanModel && combined.includes(cleanModel)) score += 100;
  // Name match: +60 points
  if (cleanName && combined.includes(cleanName)) score += 60;
  // Brand + Model together: +80 bonus
  if (cleanBrand && cleanModel && combined.includes(cleanBrand) && combined.includes(cleanModel)) score += 80;
  // All three: +100 bonus
  if (cleanBrand && cleanModel && cleanName &&
      combined.includes(cleanBrand) && combined.includes(cleanModel) && combined.includes(cleanName)) {
    score += 100;
  }

  // Prefer product/clinical photo keywords: +30
  if (combined.includes('product photo') || combined.includes('clinical photograph')) score += 30;
  // Prefer supplier/distributor/manufacturer: +20
  if (combined.includes('supplier') || combined.includes('distributor') || combined.includes('manufacturer')) score += 20;
  // Prefer price/buy/sale (commercial product photo): +15
  if (combined.includes('price') || combined.includes('precio') || combined.includes('buy') || combined.includes('sale')) score += 15;
  // Prefer modern years: +10
  if (/\b(2020|2021|2022|2023|2024|2025)\b/.test(combined)) score += 10;
  // Prefer larger images: +10
  if (option.width && option.width > 1024) score += 10;
  if (option.height && option.height > 768) score += 10;
  // Prefer good aspect ratio (landscape): +5
  if (option.width && option.height && option.width / option.height > 1.2 && option.width / option.height < 2.5) score += 5;

  return score;
}

import { getKnownEquipmentImage } from './knownEquipmentImages';

export async function getAutoEquipmentImageUrl(
  equipmentName: string,
  brand?: string,
  model?: string
): Promise<string | null> {
  try {
    const queries = buildSearchQueries(equipmentName, brand, model);
    if (queries.length === 0) return null;

    const triedUrls = new Set<string>();
    const candidates: Array<{ option: ProductImageOption; score: number }> = [];

    // Try each query and collect candidates
    for (const query of queries) {
      try {
        const options = await searchEquipmentImagesFromInternet(
          equipmentName,
          brand,
          model,
          query
        );

        if (options && options.length > 0) {
          for (const opt of options.slice(0, 10)) {
            if (!opt.url) continue;
            if (triedUrls.has(opt.url)) continue;
            triedUrls.add(opt.url);

            if (!isRealEquipmentPhoto(opt, equipmentName, brand, model)) continue;

            const score = scoreImageOption(opt, equipmentName, brand, model);
            // Only keep candidates with decent score
            if (score >= 30) {
              candidates.push({ option: opt, score });
            }
          }
        }
      } catch (err) {
        console.warn(`Image search failed for query "${query}":`, err);
        continue;
      }
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Try the best candidates from internet search
    for (const candidate of candidates.slice(0, 8)) {
      try {
        const b64 = await proxyAndConvertImageToBase64(candidate.option.url);
        if (b64) return b64;
      } catch (err) {
        console.warn(`Failed to convert image:`, err);
        continue;
      }
    }

    // FALLBACK: Use known equipment image catalog if internet search found nothing
    const knownImage = getKnownEquipmentImage(equipmentName, brand, model);
    if (knownImage) {
      try {
        const b64 = await proxyAndConvertImageToBase64(knownImage.url);
        if (b64) return b64;
      } catch (err) {
        console.warn(`Failed to convert known image:`, err);
      }
      // Return URL directly if proxy fails
      return knownImage.url;
    }
  } catch (err) {
    console.warn('Error in getAutoEquipmentImageUrl:', err);
  }
  return null;
}

/**
 * Proxies and downloads an internet image URL into a Base64 data URL.
 * Ensures the image can be embedded into PDFs, Word documents, and offline storage without CORS errors.
 */
export async function proxyAndConvertImageToBase64(imageUrl: string): Promise<string | null> {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('data:')) return imageUrl;

  try {
    const res = await fetch('/api/proxy-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: imageUrl }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.dataUrl) {
        return data.dataUrl;
      }
    }
  } catch (err) {
    console.warn('Error in proxyAndConvertImageToBase64:', err);
  }

  return imageUrl;
}