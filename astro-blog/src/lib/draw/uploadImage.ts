export type UploadImage = { blob: Blob; contentType: 'image/png' | 'image/webp'; dataUrl: string };

export async function prepareUpload(dataUrl: string): Promise<UploadImage> {
  const png = await (await fetch(dataUrl)).blob();
  const fallback: UploadImage = { blob: png, contentType: 'image/png', dataUrl };
  try {
    const image = new Image();
    image.src = dataUrl;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d');
    if (!context) return fallback;
    context.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob || blob.type !== 'image/webp' || blob.size >= png.size) return fallback;
    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
    return { blob, contentType: 'image/webp', dataUrl: preview };
  } catch {
    return fallback;
  }
}
