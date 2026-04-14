import Quagga from '@ericblade/quagga2';

export class BarcodeScanner {
  /**
   * Scans multiple files sequentially using Quagga2 on the main thread
   * Note: Quagga2 doesn't work in Web Workers, so we process sequentially
   * @param files Array of image files to scan
   * @param onProgress Progress callback (current, total)
   * @returns Array of results with fileName and barcode
   */
  static async scanBatch(
    files: File[],
    onProgress?: (current: number, total: number) => void
  ): Promise<Array<{ fileName: string; barcode: string | null }>> {
    console.log(`[BARCODE-BATCH] Starting sequential scan for ${files.length} files`);

    const results: Array<{ fileName: string; barcode: string | null }> = [];

    // Process files sequentially to avoid overwhelming the browser
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const barcode = await this.scanFile(file);
        results.push({ fileName: file.name, barcode });

        if (onProgress) {
          onProgress(i + 1, files.length);
        }

        console.log(`[BARCODE-BATCH] File #${i + 1}/${files.length}: ${file.name} → ${barcode ? `"${barcode}"` : 'NO BARCODE'}`);
      } catch (error) {
        console.error(`[BARCODE-BATCH] Failed to scan ${file.name}:`, error);
        results.push({ fileName: file.name, barcode: null });

        if (onProgress) {
          onProgress(i + 1, files.length);
        }
      }
    }

    console.log(`[BARCODE-BATCH] Scan complete:`, {
      total: files.length,
      withBarcode: results.filter(r => r.barcode).length,
      withoutBarcode: results.filter(r => !r.barcode).length,
    });

    return results;
  }

  /**
   * Scans a barcode from an image file using Quagga2
   * @param file Image file containing the barcode
   * @returns Decoded barcode text or null if no barcode found
   */
  static async scanFile(file: File): Promise<string | null> {
    try {
      console.log('[BARCODE] Scanning file:', file.name, 'Size:', file.size, 'Type:', file.type);

      const imageUrl = URL.createObjectURL(file);

      try {
        const result = await this.scanImageUrl(imageUrl);
        if (result) {
          console.log('[BARCODE] Scan successful! Text:', result);
        }
        return result;
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (error) {
      console.error('[BARCODE] Scan failed:', error);
      console.log('[BARCODE] Tip: Ensure the barcode is clear, well-lit, and takes up a significant portion of the image');
      return null;
    }
  }

  /**
   * Scans a barcode from an image URL using Quagga2
   * @param url Image URL containing the barcode
   * @returns Decoded barcode text or null if no barcode found
   */
  static async scanUrl(url: string): Promise<string | null> {
    let objectUrl: string | null = null;
    try {
      console.log('[BARCODE] Scanning URL:', url);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const proxyUrl = `${supabaseUrl}/functions/v1/image-proxy?url=${encodeURIComponent(url)}`;
      const response = await fetch(proxyUrl, {
        headers: { Authorization: `Bearer ${anonKey}` },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      const result = await this.scanImageUrl(objectUrl);
      if (result) {
        console.log('[BARCODE] Scan successful! Text:', result);
      }
      return result;
    } catch (error) {
      console.error('[BARCODE] Scan failed:', error);
      return null;
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }
  }

  /**
   * Internal method to scan using Quagga2
   */
  private static scanImageUrl(imageUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
      Quagga.decodeSingle(
        {
          src: imageUrl,
          numOfWorkers: 0,
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
            console.log('[BARCODE] Quagga2 detected:', result.codeResult.code, 'Format:', result.codeResult.format);
            resolve(result.codeResult.code.trim());
          } else {
            console.log('[BARCODE] No barcode detected by Quagga2');
            resolve(null);
          }
        }
      );
    });
  }
}
