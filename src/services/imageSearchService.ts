/**
 * Service to search product and biomedical equipment images from internet sources
 * and convert them to clean Base64 data URLs via proxy.
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
 * Always seeks to return 4 selectable options.
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

/**
 * Builds multiple specific search queries to find accurate biomedical equipment images.
 * Prioritizes exact brand+model matches to ensure real equipment images, not generic ones.
 */
function buildSearchQueries(
  equipmentName: string,
  brand?: string,
  model?: string
): string[] {
  const queries: string[] = [];
  const cleanName = (equipmentName || '').trim();
  const cleanBrand = (brand || '').trim();
  const cleanModel = (model || '').trim();

  // PRIORITY 1: Most specific - Brand + Model + exact name (for real equipment photos)
  if (cleanBrand && cleanModel) {
    queries.push(`${cleanBrand} ${cleanModel} medical equipment`);
    queries.push(`${cleanBrand} ${cleanModel} hospital`);
    queries.push(`${cleanBrand} ${cleanModel}`);
  }
  // PRIORITY 2: Name + Brand + Model
  if (cleanName && cleanBrand && cleanModel) {
    queries.push(`${cleanName} ${cleanBrand} ${cleanModel} medical`);
    queries.push(`${cleanBrand} ${cleanModel} ${cleanName} medical`);
  }
  // PRIORITY 3: Name + Brand
  if (cleanName && cleanBrand) {
    queries.push(`${cleanName} ${cleanBrand} medical equipment`);
  }
  // PRIORITY 4: Name + Model
  if (cleanName && cleanModel) {
    queries.push(`${cleanName} ${cleanModel} medical equipment`);
  }
  // PRIORITY 5: Just Name + medical
  if (cleanName) {
    queries.push(`${cleanName} medical equipment`);
    queries.push(`${cleanName} hospital equipment`);
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

/**
 * Validates that an image option is likely a real photograph of biomedical equipment,
 * not an illustration, drawing, historical photo, or unrelated medical image.
 */
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
  const cleanBrand = (brand || '').toLowerCase();
  const cleanModel = (model || '').toLowerCase();

  // Reject obvious non-photo content in title
  const nonPhotoKeywords = [
    'illustration', 'drawing', 'sketch', 'diagram', 'chart', 'graph',
    'map', 'painting', 'engraving', 'etching', 'woodcut', 'lithograph',
    'blueprint', 'schematic', 'design', 'plan', 'portrait',
    'historical', 'historic', 'vintage', 'antique', 'old',
    'black and white', 'b&w', 'monochrome', 'sepia',
    'treatise', 'trabajo', 'ensayo', 'estudio',
    'radiograph', 'scan result', 'ultrasound image', 'mri scan', 'ct scan',
    'treatise on', 'diseases of', 'with their homopathi'
  ];
  if (nonPhotoKeywords.some((k) => combined.includes(k))) return false;

  // Reject if title suggests it's NOT the specific equipment type
  // For surgical tables, reject monitors, forceps, stethoscopes, etc.
  const equipmentTypeKeywords = {
    'mesa de cirugia': ['mesa', 'operating table', 'surgical table', 'hybase', 'quirurgica', 'cirugía'],
    'monitor': ['monitor', 'patient monitor', 'vital signs', 'umec'],
    'desfibrilador': ['defibrillator', 'desfibrilador'],
    'oximetro': ['oximeter', 'oxímetro', 'pulse oximeter'],
    'incubadora': ['incubator', 'incubadora', 'cunero', 'neonatal'],
    'lámpara': ['lamp', 'lampara', 'lámpara', 'examination light'],
    'estetoscopio': ['stethoscope', 'estetoscopio', 'fonendoscopio'],
    'fonendoscopio': ['stethoscope', 'estetoscopio', 'fonendoscopio'],
    'pinza': ['forceps', 'pinza', 'surgical forceps', 'hemostatic'],
    'rayos x': ['x-ray', 'rayos x', 'radiography', 'radiographic'],
    'mobieye': ['mobieye', 'mobile x-ray', 'mobile radiography'],
    'digieye': ['digieye', 'digital radiography'],
    'tallimetro': ['stadiometer', 'tallímetro', 'height rod'],
    'balanza': ['scale', 'balanza', 'báscula', 'weighing scale'],
    'infantometro': ['infantometer', 'infantómetro', 'baby measuring'],
    'cuello cisne': ['examination light', 'cuello cisne', 'gs 300'],
    'organos': ['ophthalmoscope', 'otoscope', 'órganos', '777'],
  };

  // Check if the equipment type keywords match
  const typeKey = Object.keys(equipmentTypeKeywords).find((k) =>
    cleanName.includes(k) || cleanModel.includes(k) || cleanBrand.includes(k)
  );

  if (typeKey) {
    const expectedTerms = equipmentTypeKeywords[typeKey];
    const hasExpectedTerm = expectedTerms.some((t) => combined.includes(t));
    if (!hasExpectedTerm) {
      // If we can't confirm it's the right equipment type, reject it
      return false;
    }
  }

  // Require that at least the brand OR model appears in title/URL for relevance
  const hasBrand = cleanBrand && (combined.includes(cleanBrand) || combined.includes(cleanBrand.replace(/\s+/g, '')));
  const hasModel = cleanModel && (combined.includes(cleanModel) || combined.includes(cleanModel.replace(/\s+/g, '')));
  const hasName = cleanName && (combined.includes(cleanName) || combined.includes(cleanName.replace(/\s+/g, '')));

  // At minimum, we need brand OR model OR name to be relevant
  if (!hasBrand && !hasModel && !hasName) {
    // Only accept if it's a very general medical equipment search with strong medical terms
    const strongMedicalTerms = ['surgical table', 'operating table', 'patient monitor', 'medical equipment', 'hospital equipment'];
    if (!strongMedicalTerms.some((t) => combined.includes(t))) return false;
  }

  return true;
}

/**
 * Scores an image option based on relevance to the specific equipment.
 * Higher score = more likely to be the correct image.
 */
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
  const cleanBrand = (brand || '').toLowerCase();
  const cleanModel = (model || '').toLowerCase();

  // Brand match: +50 points
  if (cleanBrand && combined.includes(cleanBrand)) score += 50;
  // Model match: +50 points  
  if (cleanModel && combined.includes(cleanModel)) score += 50;
  // Name match: +30 points
  if (cleanName && combined.includes(cleanName)) score += 30;
  // Brand + Model together: +40 bonus
  if (cleanBrand && cleanModel && combined.includes(cleanBrand) && combined.includes(cleanModel)) score += 40;
  // Brand + Name together: +30 bonus
  if (cleanBrand && cleanName && combined.includes(cleanBrand) && combined.includes(cleanName)) score += 30;
  // All three: +50 bonus
  if (cleanBrand && cleanModel && cleanName &&
      combined.includes(cleanBrand) && combined.includes(cleanModel) && combined.includes(cleanName)) {
    score += 50;
  }

  // Prefer Wikipedia/Wikimedia official sources: +20
  if (combined.includes('wikimedia') || combined.includes('wikipedia')) score += 20;
  // Prefer official catalog mentions: +10
  if (combined.includes('catalogo') || combined.includes('catalog') || combined.includes('official')) score += 10;

  // Prefer larger images (width > 800): +10
  if (option.width && option.width > 800) score += 10;
  if (option.height && option.height > 600) score += 10;

  return score;
}

/**
 * Automatically retrieves the best matching image for biomedical equipment from internet sources.
 * Tries multiple specific queries ordered by specificity to find real equipment images,
 * avoiding generic or wrong images (like control panels instead of actual equipment).
 */
export async function getAutoEquipmentImageUrl(
  equipmentName: string,
  brand?: string,
  model?: string
): Promise<string | null> {
  try {
    const queries = buildSearchQueries(equipmentName, brand, model);
    if (queries.length === 0) return null;

    // Track tried URLs to avoid duplicates
    const triedUrls = new Set<string>();
    // Collect all candidate images with scores
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
          for (const opt of options.slice(0, 8)) {
            if (!opt.url) continue;
            if (triedUrls.has(opt.url)) continue;
            triedUrls.add(opt.url);

            // Validate this is a real equipment photo
            if (!isRealEquipmentPhoto(opt, equipmentName, brand, model)) continue;

            const score = scoreImageOption(opt, equipmentName, brand, model);
            candidates.push({ option: opt, score });
          }
        }
      } catch (err) {
        console.warn(`Image search failed for query "${query}":`, err);
        continue;
      }
    }

    // Sort by score descending and try the best candidates first
    candidates.sort((a, b) => b.score - a.score);

    for (const candidate of candidates.slice(0, 10)) {
      try {
        const b64 = await proxyAndConvertImageToBase64(candidate.option.url);
        if (b64) return b64;
      } catch (err) {
        console.warn(`Failed to convert image:`, err);
        continue;
      }
    }
  } catch (err) {
    console.warn('Error in getAutoEquipmentImageUrl:', err);
  }
  return null;
}
