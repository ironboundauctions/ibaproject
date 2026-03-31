import sharp from 'sharp';
import jsQR from 'jsqr';
import { createCanvas, loadImage } from 'canvas';
import {
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
  DecodeHintType,
  BarcodeFormat,
  NotFoundException,
} from '@zxing/library';
import { logger } from '../logger.js';
import type { BarcodeResult } from '../types.js';

export class BarcodeScanner {
  private zxingReader: MultiFormatReader;

  constructor() {
    this.zxingReader = new MultiFormatReader();

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
      BarcodeFormat.ITF,
      BarcodeFormat.CODABAR,
    ];
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
    hints.set(DecodeHintType.TRY_HARDER, true);

    this.zxingReader.setHints(hints);
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

      // Get image info for debugging
      const imageInfo = await sharp(buffer).metadata();
      logger.debug('Processing image for barcode detection', {
        fileName,
        width: imageInfo.width,
        height: imageInfo.height,
        format: imageInfo.format,
        size: buffer.length,
      });

      const strategies = [
        { name: 'original', process: (buf: Buffer) => sharp(buf).toBuffer() },
        { name: 'grayscale', process: (buf: Buffer) => sharp(buf).grayscale().toBuffer() },
        { name: 'grayscale-normalized', process: (buf: Buffer) => sharp(buf).grayscale().normalise().toBuffer() },
        // Focused on barcode area - crop bottom third where barcodes typically are
        { name: 'bottom-crop-enhanced', process: async (buf: Buffer) => {
          const metadata = await sharp(buf).metadata();
          const height = metadata.height || 1200;
          const width = metadata.width || 1600;
          return sharp(buf)
            .extract({ left: 0, top: Math.floor(height * 0.4), width, height: Math.floor(height * 0.6) })
            .resize({ width: 2000, fit: 'inside' })
            .grayscale()
            .normalise()
            .sharpen()
            .toBuffer();
        }},
        { name: 'enhanced', process: (buf: Buffer) => sharp(buf).resize({ width: 1200, height: 1200, fit: 'inside' }).grayscale().normalise().sharpen().toBuffer() },
        // High contrast strategies
        { name: 'high-contrast', process: (buf: Buffer) => sharp(buf).grayscale().normalise().linear(1.5, -(128 * 0.5)).toBuffer() },
        { name: 'threshold', process: (buf: Buffer) => sharp(buf).grayscale().normalise().threshold(128).toBuffer() },
        // Larger size for small barcodes
        { name: 'upscaled', process: (buf: Buffer) => sharp(buf).resize({ width: 2400, height: 2400, fit: 'inside' }).grayscale().normalise().sharpen({ sigma: 2 }).toBuffer() },
      ];

      for (const strategy of strategies) {
        try {
          const processedBuffer = await strategy.process(buffer);

          const pngBuffer = await sharp(processedBuffer).png().toBuffer();
          const img = await loadImage(pngBuffer);

          logger.debug(`Trying strategy: ${strategy.name}`, {
            fileName,
            imageWidth: img.width,
            imageHeight: img.height,
          });

          const canvas = createCanvas(img.width, img.height);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const imageData = ctx.getImageData(0, 0, img.width, img.height);
          const rgbaData = imageData.data;

          // Create proper RGBA array for RGBLuminanceSource
          const luminanceSource = new RGBLuminanceSource(
            new Uint8ClampedArray(rgbaData),
            img.width,
            img.height
          );
          const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));

          const result = this.zxingReader.decode(binaryBitmap);

          if (result && result.getText()) {
            const barcodeValue = result.getText().trim();
            logger.info('Barcode detected via ZXing', {
              fileName,
              assetGroupId,
              barcodeValue,
              format: BarcodeFormat[result.getBarcodeFormat()],
              strategy: strategy.name,
            });

            return {
              fileName,
              assetGroupId,
              barcodeValue,
            };
          }
        } catch (zxingError) {
          if (!(zxingError instanceof NotFoundException)) {
            logger.warn(`ZXing detection error with strategy ${strategy.name}`, {
              fileName,
              strategy: strategy.name,
              error: zxingError instanceof Error ? zxingError.message : String(zxingError),
              stack: zxingError instanceof Error ? zxingError.stack : undefined,
            });
          }
        }
      }

      // Fallback to jsQR for QR codes
      logger.debug('Trying jsQR fallback', { fileName });
      const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const qrResult = jsQR(new Uint8ClampedArray(data), info.width, info.height, {
        inversionAttempts: 'attemptBoth',
      });

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
      logger.debug('No barcode found in image after all strategies', { fileName, assetGroupId });
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

