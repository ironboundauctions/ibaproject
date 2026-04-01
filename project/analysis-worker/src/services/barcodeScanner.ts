import sharp from 'sharp';
import jsQR from 'jsqr';
import { createCanvas, loadImage } from 'canvas';
import Quagga from '@ericblade/quagga2';
import { logger } from '../logger.js';
import type { BarcodeResult } from '../types.js';

export class BarcodeScanner {
  constructor() {
    // Quagga doesn't need initialization
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

            const canvas = createCanvas(img.width, img.height);
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);

            if (rotation === 0) {
              logger.debug('Canvas ImageData for detection', {
                fileName,
                dataLength: imageData.data.length,
                width: imageData.width,
                height: imageData.height,
              });
            }

            // Try jsQR for QR codes
            const qrResult = jsQR(imageData.data, imageData.width, imageData.height, {
              inversionAttempts: 'dontInvert',
            });

            if (qrResult) {
              logger.info('QR code detected via jsQR', {
                fileName,
                assetGroupId,
                barcodeValue: qrResult.data,
                strategy: strategy.name,
                rotation,
              });

              return {
                fileName,
                assetGroupId,
                barcodeValue: qrResult.data.trim(),
              };
            }

            // Try Quagga2 for 1D barcodes (CODE_128, CODE_39, etc.)
            try {
              const result = await new Promise<any>((resolve, reject) => {
                Quagga.decodeSingle(
                  {
                    src: canvas.toDataURL(),
                    numOfWorkers: 0,
                    locate: true,
                    decoder: {
                      readers: [
                        'code_128_reader',
                        'code_39_reader',
                        'code_93_reader',
                        'ean_reader',
                        'upc_reader',
                        'codabar_reader',
                        'i2of5_reader',
                      ] as any,
                    },
                  },
                  (res: any) => {
                    if (res && res.codeResult) {
                      resolve(res);
                    } else {
                      reject(new Error('No barcode found'));
                    }
                  }
                );
              });

              if (result && result.codeResult && result.codeResult.code) {
                const barcodeValue = result.codeResult.code.trim();
                logger.info('Barcode detected via Quagga2', {
                  fileName,
                  assetGroupId,
                  barcodeValue,
                  format: result.codeResult.format,
                  strategy: strategy.name,
                  rotation,
                });

                return {
                  fileName,
                  assetGroupId,
                  barcodeValue,
                };
              }
            } catch (quaggaError) {
              // Continue to next strategy/rotation
            }
          } catch (detectionError) {
            logger.warn(`Detection error with strategy ${strategy.name}, rotation ${rotation}°`, {
              fileName,
              strategy: strategy.name,
              rotation,
              error: detectionError instanceof Error ? detectionError.message : String(detectionError),
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

