import sharp from 'sharp';
import jsQR from 'jsqr';
import { logger } from '../logger.js';

export interface BarcodeResult {
  fileName: string;
  assetGroupId: string;
  barcodeValue?: string;
  error?: string;
}

export class BarcodeScanner {
  async scanImage(buffer: Buffer, fileName: string, assetGroupId: string): Promise<BarcodeResult> {
    try {
      // Skip video files
      if (this.isVideoFile(fileName)) {
        logger.debug('Skipping video file', { fileName });
        return {
          fileName,
          assetGroupId,
        };
      }

      // Convert image to raw pixel data for jsQR
      const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      // Try to decode QR code (supports inventory numbers in QR format)
      const qrResult = jsQR(new Uint8ClampedArray(data), info.width, info.height);

      if (qrResult && qrResult.data) {
        logger.info('QR code detected', {
          fileName,
          assetGroupId,
          barcodeValue: qrResult.data,
        });

        return {
          fileName,
          assetGroupId,
          barcodeValue: qrResult.data.trim(),
        };
      }

      // No barcode found - this is normal, not an error
      logger.debug('No barcode found in image', { fileName, assetGroupId });
      return {
        fileName,
        assetGroupId,
      };
    } catch (error) {
      // Actual error during scanning
      logger.warn('Error scanning image for barcode', {
        fileName,
        assetGroupId,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        fileName,
        assetGroupId,
        error: error instanceof Error ? error.message : 'Unknown scanning error',
      };
    }
  }

  private isVideoFile(fileName: string): boolean {
    const ext = fileName.toLowerCase().split('.').pop();
    const videoExtensions = ['mp4', 'mov', 'avi', 'webm', 'mkv', 'm4v', 'wmv'];
    return videoExtensions.includes(ext || '');
  }
}

