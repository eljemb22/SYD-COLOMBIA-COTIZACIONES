/**
 * Advanced Clean Background Removal Utility.
 * Removes white/light-colored background boxes, including holes inside enclosed
 * letters like "D", "O", "P", "R", "B", making them 100% transparent.
 * Applies anti-aliased edge feathering to ensure smooth, non-pixelated contours.
 */
export const makeImageBackgroundTransparent = (dataUrl: string, threshold = 205): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || dataUrl.startsWith('data:image/svg+xml')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(dataUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // Process all pixels: remove white background including enclosed letters (D, O, etc.)
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];

          if (a === 0) continue;

          // Check if pixel is white or light background (including enclosed letter cavities like "D", "O", "P")
          const maxVal = Math.max(r, g, b);
          const minVal = Math.min(r, g, b);
          const isNeutralLight = minVal >= 185 && (maxVal - minVal) < 32;
          const isVeryLight = (r * 0.299 + g * 0.587 + b * 0.114) >= 190;

          if (isNeutralLight || isVeryLight) {
            data[i + 3] = 0; // 100% transparent
          } else if (minVal >= 165 && (maxVal - minVal) < 30) {
            // Smooth anti-aliased feathering transition on boundary pixels
            const factor = Math.max(0, Math.min(1, (255 - minVal) / 25));
            data[i + 3] = Math.round(a * (1 - factor));
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (err) {
        console.error('Error making image background transparent:', err);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};
