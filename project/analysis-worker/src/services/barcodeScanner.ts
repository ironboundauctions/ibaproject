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
        { name: 'grayscale-normalized', process: (buf: Buffer) => sharp(buf).grayscale().normalise().toBuffer() },
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
          const rgbaData = new Uint8ClampedArray(imageData.data);

          const rgbData = new Uint8ClampedArray(img.width * img.height * 4);
          for (let i = 0; i < rgbaData.length; i += 4) {
            rgbData[i] = rgbaData[i];
            rgbData[i + 1] = rgbaData[i + 1];
            rgbData[i + 2] = rgbaData[i + 2];
            rgbData[i + 3] = 255;
          }

          const luminanceSource = new RGBLuminanceSource(rgbData, img.width, img.height);
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
            logger.debug(`ZXing detection failed with strategy ${strategy.name}`, {
              fileName,
              error: zxingError instanceof Error ? zxingError.message : String(zxingError),
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

