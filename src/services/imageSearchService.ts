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

    // Try each query until we find a valid image
    for (const query of queries) {
      try {
        const options = await searchEquipmentImagesFromInternet(
          equipmentName,
          brand,
          model,
          query
        );

        if (options && options.length > 0) {
          // Try options from most relevant to least
          for (const opt of options.slice(0, 5)) {
            if (!opt.url) continue;
            if (triedUrls.has(opt.url)) continue;
            triedUrls.add(opt.url);

            const b64 = await proxyAndConvertImageToBase64(opt.url);
            if (b64) return b64;
          }
        }
      } catch (err) {
        console.warn(`Image search failed for query "${query}":`, err);
        continue;
      }
    }
  } catch (err) {
    console.warn('Error in getAutoEquipmentImageUrl:', err);
  }
  return null;
}
