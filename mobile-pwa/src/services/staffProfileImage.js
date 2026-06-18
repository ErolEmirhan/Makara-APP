function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', () => reject(new Error('Görsel yüklenemedi')));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

/** Dosyayı crop öncesi ham data URL olarak okur */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) {
      reject(new Error('Geçersiz dosya türü'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Dosya okunamadı'));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

/** Kare crop alanını JPEG data URL'e dönüştürür */
export async function getCroppedProfileDataUrl(imageSrc, pixelCrop, maxSize = 320) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Görsel işlenemedi');

  const size = Math.min(maxSize, Math.round(pixelCrop.width));
  canvas.width = size;
  canvas.height = size;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    size,
    size
  );

  return canvas.toDataURL('image/jpeg', 0.85);
}
