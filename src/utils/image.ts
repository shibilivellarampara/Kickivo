/**
 * Reads an image file and returns a small data URL that is safe to store inside a Firestore
 * document (documents are limited to 1 MiB). The image is scaled down so that its longest side
 * is at most `maxSize` pixels. PNG is kept (it preserves transparent crests) unless the result
 * is still large, in which case it falls back to JPEG on a white background.
 */
export async function fileToLogoDataUrl(file: File, maxSize = 256): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read that image. Please choose a different file.'));
      el.src = objectUrl;
    });

    // SVGs without intrinsic size report 0; treat them as maxSize x maxSize.
    const srcW = img.naturalWidth || maxSize;
    const srcH = img.naturalHeight || maxSize;
    const scale = Math.min(1, maxSize / Math.max(srcW, srcH));
    const width = Math.max(1, Math.round(srcW * scale));
    const height = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process that image in this browser.');

    ctx.drawImage(img, 0, 0, width, height);
    let dataUrl = canvas.toDataURL('image/png');

    const MAX_CHARS = 300_000; // ~225 KB of image data, far below the 1 MiB document limit
    if (dataUrl.length > MAX_CHARS) {
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
