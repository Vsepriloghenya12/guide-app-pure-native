import { api } from '../api/client';

type UploadKind = 'place' | 'collection' | 'category' | 'general' | 'logo';

type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось обработать изображение.'));
    };
    image.src = objectUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('Не удалось сжать изображение.'));
    }, type, quality);
  });
}

function buildFileName(originalName: string, type: string) {
  const baseName = originalName.replace(/\.[^.]+$/, '') || 'image';
  const extension = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  return `${baseName}.${extension}`;
}

export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  const image = await loadImage(file);
  const maxWidth = options.maxWidth ?? 1600;
  const maxHeight = options.maxHeight ?? 1600;
  const quality = options.quality ?? 0.82;

  const scale = Math.min(1, maxWidth / image.width, maxHeight / image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) {
    return file;
  }

  context.drawImage(image, 0, 0, width, height);

  const preferredType = file.type === 'image/png' ? 'image/webp' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, preferredType, quality).catch(async () => {
    if (preferredType !== 'image/jpeg') {
      return canvasToBlob(canvas, 'image/jpeg', quality);
    }
    throw new Error('Не удалось сжать изображение.');
  });

  const compressed = new File([blob], buildFileName(file.name, blob.type || preferredType), {
    type: blob.type || preferredType,
    lastModified: Date.now()
  });

  return compressed.size < file.size ? compressed : file;
}

export async function uploadMediaAsset(
  file: File,
  kind: UploadKind,
  options: CompressOptions = {}
): Promise<string> {
  const prepared = file.type.startsWith('image/') ? await compressImage(file, options) : file;
  const response = await api.uploadImage(prepared, { kind });
  return response.url;
}

export async function uploadImageAsset(
  file: File,
  kind: UploadKind,
  options: CompressOptions = {}
): Promise<string> {
  return uploadMediaAsset(file, kind, options);
}
