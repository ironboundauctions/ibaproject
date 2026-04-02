import {
  BrowserMultiFormatReader,
  DecodeHintType,
  BarcodeFormat,
  Result
} from '@zxing/library';

export class BarcodeScanner {
  private static reader: BrowserMultiFormatReader;

  private static getReader(): BrowserMultiFormatReader {
    if (!this.reader) {
      const hints = new Map();

      // Enable all common barcode formats
      const formats = [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.CODE_93,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
        BarcodeFormat.CODABAR,
        BarcodeFormat.DATA_MATRIX,
        BarcodeFormat.PDF_417,
        BarcodeFormat.AZTEC
      ];

      hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
      hints.set(DecodeHintType.TRY_HARDER, true);

      this.reader = new BrowserMultiFormatReader(hints);
      console.log('[BARCODE] Reader initialized with formats:', formats.map(f => BarcodeFormat[f]));
    }
    return this.reader;
  }

  /**
   * Scans a barcode from an image file
   * @param file Image file containing the barcode
   * @returns Decoded barcode text or null if no barcode found
   */
  static async scanFile(file: File): Promise<string | null> {
    try {
      console.log('[BARCODE] Scanning file:', file.name, 'Size:', file.size, 'Type:', file.type);

      const imageUrl = URL.createObjectURL(file);

      try {
        const reader = this.getReader();
        const result: Result = await reader.decodeFromImageUrl(imageUrl);
        console.log('[BARCODE] Scan successful! Format:', BarcodeFormat[result.getBarcodeFormat()], 'Text:', result.getText());
        return result.getText();
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
   * Scans a barcode from an image URL
   * @param url Image URL containing the barcode
   * @returns Decoded barcode text or null if no barcode found
   */
  static async scanUrl(url: string): Promise<string | null> {
    try {
      console.log('[BARCODE] Scanning URL:', url);
      const reader = this.getReader();
      const result: Result = await reader.decodeFromImageUrl(url);
      console.log('[BARCODE] Scan successful! Format:', BarcodeFormat[result.getBarcodeFormat()], 'Text:', result.getText());
      return result.getText();
    } catch (error) {
      console.error('[BARCODE] Scan failed:', error);
      console.log('[BARCODE] Tip: Ensure the barcode is clear, well-lit, and takes up a significant portion of the image');
      return null;
    }
  }
}
