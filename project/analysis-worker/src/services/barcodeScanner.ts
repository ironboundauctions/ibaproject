import sharp from 'sharp';
import jsQR from 'jsqr';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } from '@zxing/library';
import { logger } from '../logger.js';

export interface BarcodeResult {
  fileName: string;
  assetGroupId: string;
  barcodeValue?: string;
  error?: string;
}

export class BarcodeScanner {
  private zxingReader: BrowserMultiFormatReader;

  constructor() {
    const hints = new Map();
    const formats = [
      BarcodeFormat.CODE_128,
      BarcodeFormat.CODE_39,
      BarcodeFormat.CODE_93,
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.QR_CODE,
      BarcodeFormat.DATA_MATRIX,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);

    this.zxingReader = new BrowserMultiFormatReader(hints);
  }

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

      // Convert image to grayscale PNG for better barcode detection
      const processedBuffer = await sharp(buffer)
        .grayscale()
        .normalise()
        .png()
        .toBuffer();

      // Try ZXing first for all barcode types including 1D barcodes
      try {
        const base64 = `data:image/png;base64,${processedBuffer.toString('base64')}`;
        const result = await this.zxingReader.decodeFromImageUrl(base64);

        if (result && result.getText()) {
          const barcodeValue = result.getText().trim();
          logger.info('Barcode detected via ZXing', {
            fileName,
            assetGroupId,
            barcodeValue,
            format: result.getBarcodeFormat(),
          });

          return {
            fileName,
            assetGroupId,
            barcodeValue,
          };
        }
      } catch (zxingError) {
        // ZXing failed, try jsQR as fallback for QR codes
        logger.debug('ZXing detection failed, trying jsQR', { fileName });
      }

      // Fallback to jsQR for QR codes
      const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const qrResult = jsQR(new Uint8ClampedArray(data), info.width, info.height);

      if (qrResult && qrResult.data) {
        logger.info('QR code detected via jsQR', {
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

