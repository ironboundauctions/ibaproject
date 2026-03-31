export interface ReducedImage {
  reducedFile: File;
  originalFile: File;
  fileName: string;
  originalSize: number;
  reducedSize: number;
}

export interface ImageReductionProgress {
  current: number;
  total: number;
  currentFile: string;
}

export class ImageReducer {
  private static readonly MAX_DIMENSION = 1600;
  private static readonly JPEG_QUALITY = 0.8;
  private static readonly TARGET_SIZE_MB = 1;

  static async reduceImagesForAnalysis(
    files: File[],
    onProgress?: (progress: ImageReductionProgress) => void
  ): Promise<ReducedImage[]> {
    const results: ReducedImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: files.length,
          currentFile: file.name,
        });
      }

      try {
        const reduced = await this.reduceImage(file);
        results.push(reduced);
      } catch (error) {
        console.error(`Failed to reduce image ${file.name}:`, error);
        results.push({
          reducedFile: file,
          originalFile: file,
          fileName: file.name,
          originalSize: file.size,
          reducedSize: file.size,
        });
      }
    }

    return results;
  }

  private static async reduceImage(file: File): Promise<ReducedImage> {
    const originalSize = file.size;

    if (originalSize < this.TARGET_SIZE_MB * 1024 * 1024) {
      const dimensions = await this.getImageDimensions(file);
      const maxDim = Math.max(dimensions.width, dimensions.height);

      if (maxDim <= this.MAX_DIMENSION) {
        return {
          reducedFile: file,
          originalFile: file,
          fileName: file.name,
          originalSize,
          reducedSize: originalSize,
        };
      }
    }

    const dimensions = await this.getImageDimensions(file);
    const scale = this.MAX_DIMENSION / Math.max(dimensions.width, dimensions.height);

    if (scale >= 1) {
      return {
        reducedFile: file,
        originalFile: file,
        fileName: file.name,
        originalSize,
        reducedSize: originalSize,
      };
    }

    const newWidth = Math.round(dimensions.width * scale);
    const newHeight = Math.round(dimensions.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const img = await this.loadImage(file);
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    const reducedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        this.JPEG_QUALITY
      );
    });

    const reducedFile = new File(
      [reducedBlob],
      file.name.replace(/\.[^.]+$/, '.jpg'),
      { type: 'image/jpeg' }
    );

    return {
      reducedFile,
      originalFile: file,
      fileName: file.name,
      originalSize,
      reducedSize: reducedFile.size,
    };
  }

  private static loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  private static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    const img = await this.loadImage(file);
    return { width: img.width, height: img.height };
  }

  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  static calculateSavings(results: ReducedImage[]): { originalTotal: number; reducedTotal: number; savingsPercent: number } {
    const originalTotal = results.reduce((sum, r) => sum + r.originalSize, 0);
    const reducedTotal = results.reduce((sum, r) => sum + r.reducedSize, 0);
    const savingsPercent = ((originalTotal - reducedTotal) / originalTotal) * 100;

    return { originalTotal, reducedTotal, savingsPercent };
  }
}
