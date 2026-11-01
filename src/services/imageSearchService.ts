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
 * Tries combinations like: "Name Brand Model medical", "Brand Model medical", "Name medical", etc.
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

  // Most specific: Name + Brand + Model + medical
  if (cleanName && cleanBrand && cleanModel) {
    queries.push(`${cleanName} ${cleanBrand} ${cleanModel} medical equipment`);
    queries.push(`${cleanBrand} ${cleanModel} ${cleanName} medical`);
  }
  // Brand + Model + medical
  if (cleanBrand && cleanModel) {
    queries.push(`${cleanBrand} ${cleanModel} medical equipment`);
    queries.push(`${cleanBrand} ${cleanModel} hospital`);
  }
  // Name + Brand + medical
  if (cleanName && cleanBrand) {
    queries.push(`${cleanName} ${cleanBrand} medical equipment`);
  }
  // Name + Model + medical
  if (cleanName && cleanModel) {
    queries.push(`${cleanName} ${cleanModel} medical equipment`);
  }
  // Just Name + medical
  if (cleanName) {
    queries.push(`${cleanName} medical equipment`);
    queries.push(`${cleanName} hospital equipment`);
  }
  // Just Brand + Model
  if (cleanBrand && cleanModel) {
    queries.push(`${cleanBrand} ${cleanModel}`);
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
 * Tries multiple specific queries to find an accurate match, avoiding wrong images.
 */
export async function getAutoEquipmentImageUrl(
  equipmentName: string,
  brand?: string,
  model?: string
): Promise<string | null> {
  try {
    const queries = buildSearchQueries(equipmentName, brand, model);
    if (queries.length === 0) return null;

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
          // Try the first 3 options from this query
          for (const opt of options.slice(0, 3)) {
            if (!opt.url) continue;
            const b64 = await proxyAndConvertImageToBase64(opt.url);
            if (b64) return b64;
          }
          // Return the first URL as proxy
          const first = options[0];
          if (first.url) {
            return first.url.startsWith('/') || first.url.startsWith('data:')
              ? first.url
              : `/api/proxy-image?url=${encodeURIComponent(first.url)}`;
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
