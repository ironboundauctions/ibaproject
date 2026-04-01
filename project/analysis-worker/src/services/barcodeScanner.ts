import sharp from 'sharp';
import jsQR from 'jsqr';
import { createCanvas, loadImage } from 'canvas';
import {
  BinaryBitmap,
  HybridBinarizer,
  GlobalHistogramBinarizer,
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
        // Start with very aggressive preprocessing for printed barcodes
        { name: 'mega-upscale-sharp', process: (buf: Buffer) =>
          sharp(buf)
            .resize({ width: 3000, fit: 'inside' })
            .grayscale()
            .normalise()
            .sharpen({ sigma: 3 })
            .linear(2.0, -128)
            .toBuffer()
        },
        { name: 'extreme-contrast', process: (buf: Buffer) =>
          sharp(buf)
            .grayscale()
            .normalise()
            .linear(3.0, -255)
            .sharpen({ sigma: 2 })
            .toBuffer()
        },
        { name: 'binary-adaptive', process: (buf: Buffer) =>
          sharp(buf)
            .resize({ width: 2000, fit: 'inside' })
            .grayscale()
            .normalise()
            .threshold(140)
            .toBuffer()
        },
        { name: 'inverted-high-contrast', process: (buf: Buffer) =>
          sharp(buf)
            .grayscale()
            .normalise()
            .negate()
            .linear(2.0, -100)
            .toBuffer()
        },
        // Bottom crop - where barcodes usually are on labels
        { name: 'bottom-crop-mega', process: async (buf: Buffer) => {
          const metadata = await sharp(buf).metadata();
          const height = metadata.height || 1200;
          const width = metadata.width || 1600;
          return sharp(buf)
            .extract({ left: 0, top: Math.floor(height * 0.5), width, height: Math.floor(height * 0.5) })
            .resize({ width: 3000, fit: 'inside' })
            .grayscale()
            .normalise()
            .sharpen({ sigma: 3 })
            .linear(2.5, -150)
            .toBuffer();
        }},
        // Original simple strategies
        { name: 'original', process: (buf: Buffer) => sharp(buf).toBuffer() },
        { name: 'grayscale-normalized', process: (buf: Buffer) => sharp(buf).grayscale().normalise().toBuffer() },
        { name: 'upscaled', process: (buf: Buffer) => sharp(buf).resize({ width: 2400, fit: 'inside' }).grayscale().normalise().sharpen({ sigma: 2 }).toBuffer() },
      ];

      for (const strategy of strategies) {
        // Try each strategy with 0, 90, 180, 270 degree rotations
        const rotations = [0, 90, 180, 270];

        for (const rotation of rotations) {
          try {
            let processedBuffer = await strategy.process(buffer);

            // Apply rotation if needed
            if (rotation > 0) {
              processedBuffer = await sharp(processedBuffer).rotate(rotation).toBuffer();
            }

            const pngBuffer = await sharp(processedBuffer).png().toBuffer();
            const img = await loadImage(pngBuffer);

            logger.debug(`Trying strategy: ${strategy.name} with rotation: ${rotation}°`, {
              fileName,
              imageWidth: img.width,
              imageHeight: img.height,
            });

            // Use Sharp to get raw pixel data directly instead of canvas
            const rawData = await sharp(processedBuffer)
              .ensureAlpha()
              .raw()
              .toBuffer();

            // Log first few pixels to debug (only for first rotation to reduce log spam)
            if (rotation === 0) {
              logger.debug('Raw pixel data for ZXing', {
                fileName,
                bufferLength: rawData.length,
                expectedLength: img.width * img.height * 4,
                firstPixels: Array.from(rawData.slice(0, 20)),
              });
            }

            // Create luminance source - RGBLuminanceSource expects RGBA interleaved data
            const luminanceSource = new RGBLuminanceSource(
              new Uint8ClampedArray(rawData),
              img.width,
              img.height
            );

            // Try BOTH binarizers - GlobalHistogram is often better for 1D barcodes
            const binarizers = [
              { name: 'GlobalHistogram', create: () => new GlobalHistogramBinarizer(luminanceSource) },
              { name: 'Hybrid', create: () => new HybridBinarizer(luminanceSource) },
            ];

            for (const binarizer of binarizers) {
              try {
                const binaryBitmap = new BinaryBitmap(binarizer.create());

                logger.debug('About to decode with ZXing', {
                  fileName,
                  strategy: strategy.name,
                  rotation,
                  binarizer: binarizer.name,
                  imageWidth: img.width,
                  imageHeight: img.height,
                });

                const result = this.zxingReader.decode(binaryBitmap);

                logger.debug('ZXing decode succeeded', {
                  fileName,
                  strategy: strategy.name,
                  rotation,
                  binarizer: binarizer.name,
                  resultText: result?.getText(),
                });

                if (result && result.getText()) {
                  const barcodeValue = result.getText().trim();
                  logger.info('Barcode detected via ZXing', {
                    fileName,
                    assetGroupId,
                    barcodeValue,
                    format: BarcodeFormat[result.getBarcodeFormat()],
                    strategy: strategy.name,
                    rotation,
                    binarizer: binarizer.name,
                  });

                  return {
                    fileName,
                    assetGroupId,
                    barcodeValue,
                  };
                }
              } catch (binarizerError) {
                if (!(binarizerError instanceof NotFoundException)) {
                  logger.warn(`ZXing detection error with ${binarizer.name}`, {
                    fileName,
                    strategy: strategy.name,
                    rotation,
                    binarizer: binarizer.name,
                    error: binarizerError instanceof Error ? binarizerError.message : String(binarizerError),
                  });
                }
              }
            }
          } catch (zxingError) {
            if (!(zxingError instanceof NotFoundException)) {
              logger.warn(`ZXing detection error with strategy ${strategy.name}, rotation ${rotation}°`, {
                fileName,
                strategy: strategy.name,
                rotation,
                error: zxingError instanceof Error ? zxingError.message : String(zxingError),
                stack: zxingError instanceof Error ? zxingError.stack : undefined,
              });
            }
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

