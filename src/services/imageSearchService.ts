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
 * Automatically retrieves the best matching image for biomedical equipment from catalog/internet sources.
 */
export async function getAutoEquipmentImageUrl(
  equipmentName: string,
  brand?: string,
  model?: string
): Promise<string | null> {
  try {
    const options = await searchEquipmentImagesFromInternet(equipmentName, brand, model);
    if (options && options.length > 0) {
      for (const opt of options.slice(0, 3)) {
        if (!opt.url) continue;
        const b64 = await proxyAndConvertImageToBase64(opt.url);
        if (b64) return b64;
      }
      const first = options[0];
      if (first.url) {
        return first.url.startsWith('/') || first.url.startsWith('data:')
          ? first.url
          : `/api/proxy-image?url=${encodeURIComponent(first.url)}`;
      }
    }
  } catch (err) {
    console.warn('Error in getAutoEquipmentImageUrl:', err);
  }
  return null;
}
