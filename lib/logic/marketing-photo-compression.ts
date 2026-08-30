export const PHOTO_COMPRESSION_PROFILES = {
  compact: {
    id: "compact",
    label: "데이터 절약",
    maxDimension: 1600,
    targetBytes: 1024 * 1024,
    quality: 0.76,
  },
  recommended: {
    id: "recommended",
    label: "권장",
    maxDimension: 2048,
    targetBytes: 2 * 1024 * 1024,
    quality: 0.82,
  },
  detail: {
    id: "detail",
    label: "고화질",
    maxDimension: 2560,
    targetBytes: 4 * 1024 * 1024,
    quality: 0.9,
  },
} as const;

export type PhotoCompressionProfileId = keyof typeof PHOTO_COMPRESSION_PROFILES;
export type PhotoCompressionProfile = typeof PHOTO_COMPRESSION_PROFILES[PhotoCompressionProfileId];

export const MAX_SOURCE_PHOTO_BYTES = 30 * 1024 * 1024;
const MAX_DECODED_PIXELS = 80_000_000;
const MIN_JPEG_QUALITY = 0.55;

export function selectPhotoCompressionProfile(value: string): PhotoCompressionProfile {
  if (value in PHOTO_COMPRESSION_PROFILES) {
    return PHOTO_COMPRESSION_PROFILES[value as PhotoCompressionProfileId];
  }
  return PHOTO_COMPRESSION_PROFILES.recommended;
}

export type CompressedMarketingPhoto = {
  originalFile: File;
  uploadFile: File;
  originalBytes: number;
  uploadBytes: number;
  originalWidth: number;
  originalHeight: number;
  uploadWidth: number;
  uploadHeight: number;
  optimized: boolean;
};

export async function compressMarketingPhoto(
  file: File,
  profileId: PhotoCompressionProfileId,
): Promise<CompressedMarketingPhoto> {
  if (!file.type.startsWith("image/")) throw new Error("사진 파일만 선택할 수 있습니다.");
  if (file.size > MAX_SOURCE_PHOTO_BYTES) throw new Error("원본 사진 한 장은 30MB 이하여야 합니다.");

  const profile = selectPhotoCompressionProfile(profileId);
  const decoded = await decodeImage(file);
  try {
    if (decoded.width * decoded.height > MAX_DECODED_PIXELS) {
      throw new Error("사진 해상도가 너무 큽니다. 휴대폰에서 크기를 줄인 뒤 다시 선택해 주세요.");
    }
    const shouldOptimize = file.size > profile.targetBytes
      || Math.max(decoded.width, decoded.height) > profile.maxDimension
      || !["image/jpeg", "image/png"].includes(file.type);
    if (!shouldOptimize) {
      return {
        originalFile: file,
        uploadFile: file,
        originalBytes: file.size,
        uploadBytes: file.size,
        originalWidth: decoded.width,
        originalHeight: decoded.height,
        uploadWidth: decoded.width,
        uploadHeight: decoded.height,
        optimized: false,
      };
    }

    const scale = Math.min(1, profile.maxDimension / Math.max(decoded.width, decoded.height));
    let width = Math.max(1, Math.round(decoded.width * scale));
    let height = Math.max(1, Math.round(decoded.height * scale));
    let quality: number = profile.quality;
    let blob = await renderJpeg(decoded.source, width, height, quality);

    while (blob.size > profile.targetBytes && quality > MIN_JPEG_QUALITY) {
      quality = Math.max(MIN_JPEG_QUALITY, quality - 0.07);
      blob = await renderJpeg(decoded.source, width, height, quality);
    }
    while (blob.size > profile.targetBytes && Math.max(width, height) > 1200) {
      width = Math.max(1, Math.round(width * 0.84));
      height = Math.max(1, Math.round(height * 0.84));
      blob = await renderJpeg(decoded.source, width, height, MIN_JPEG_QUALITY);
    }

    const uploadFile = new File([blob], jpegName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
    return {
      originalFile: file,
      uploadFile,
      originalBytes: file.size,
      uploadBytes: uploadFile.size,
      originalWidth: decoded.width,
      originalHeight: decoded.height,
      uploadWidth: width,
      uploadHeight: height,
      optimized: true,
    };
  } finally {
    decoded.close();
  }
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      // Safari and some mobile formats need the HTMLImageElement fallback.
    }
  }
  if (typeof document === "undefined") throw new Error("이 환경에서는 사진을 처리할 수 없습니다.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("사진 형식을 읽을 수 없습니다. JPEG 또는 PNG로 다시 선택해 주세요.");
  }
}

async function renderJpeg(source: CanvasImageSource, width: number, height: number, quality: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("사진 압축 화면을 준비하지 못했습니다.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("사진 용량을 줄이지 못했습니다."));
    }, "image/jpeg", quality);
  });
}

function jpegName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").trim() || "repair-photo";
  return `${base.slice(0, 100)}-optimized.jpg`;
}

export function formatPhotoBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}
