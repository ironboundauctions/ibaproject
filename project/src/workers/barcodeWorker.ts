/**
 * Web Worker for parallel barcode scanning using Quagga2
 * Runs in a separate thread to avoid blocking the main UI
 */
import Quagga from '@ericblade/quagga2';

interface ScanRequest {
  fileName: string;
  imageDataUrl: string;
}

interface ScanResponse {
  fileName: string;
  barcode: string | null;
  error?: string;
}

// Listen for messages from the main thread
self.onmessage = async (e: MessageEvent<ScanRequest>) => {
  const { fileName, imageDataUrl } = e.data;

  console.log(`[BARCODE-WORKER] 🔍 Scanning file: ${fileName}`);

  try {
    const barcode = await scanImage(imageDataUrl);

    if (barcode) {
      console.log(`[BARCODE-WORKER] ✅ BARCODE FOUND in ${fileName}: "${barcode}"`);
    } else {
      console.log(`[BARCODE-WORKER] ❌ NO BARCODE in ${fileName}`);
    }

    const response: ScanResponse = {
      fileName,
      barcode,
    };
    self.postMessage(response);
  } catch (error) {
    console.error(`[BARCODE-WORKER] ⚠️ ERROR scanning ${fileName}:`, error);
    const response: ScanResponse = {
      fileName,
      barcode: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    self.postMessage(response);
  }
};

function scanImage(imageDataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    Quagga.decodeSingle(
      {
        src: imageDataUrl,
        numOfWorkers: 0, // Disabled - we're already in a Web Worker
        locate: true,
        decoder: {
          readers: [
            'code_128_reader',
            'code_39_reader',
            'code_93_reader',
            'ean_reader',
            'ean_8_reader',
            'upc_reader',
            'upc_e_reader',
            'codabar_reader',
            'i2of5_reader',
          ],
        },
      },
      (result) => {
        if (result && result.codeResult && result.codeResult.code) {
          resolve(result.codeResult.code.trim());
        } else {
          resolve(null);
        }
      }
    );
  });
}
