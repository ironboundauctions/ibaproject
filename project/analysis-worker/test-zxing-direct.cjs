const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const {
  BinaryBitmap,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
  DecodeHintType,
  BarcodeFormat,
  NotFoundException,
} = require('@zxing/library');
const fs = require('fs');

async function testBarcode() {
  // Test with a simple synthetic barcode first
  console.log('Creating test barcode image...');

  // Create a simple black and white test image with bars
  const testWidth = 200;
  const testHeight = 100;
  const testCanvas = createCanvas(testWidth, testHeight);
  const testCtx = testCanvas.getContext('2d');

  // White background
  testCtx.fillStyle = 'white';
  testCtx.fillRect(0, 0, testWidth, testHeight);

  // Draw some black bars (simulating a barcode pattern)
  testCtx.fillStyle = 'black';
  const barWidth = 5;
  for (let i = 0; i < testWidth; i += barWidth * 2) {
    testCtx.fillRect(i, 20, barWidth, 60);
  }

  const testImageData = testCtx.getImageData(0, 0, testWidth, testHeight);
  console.log('Test image created:', {
    width: testWidth,
    height: testHeight,
    dataLength: testImageData.data.length,
    firstPixels: Array.from(testImageData.data.slice(0, 20)),
  });

  // Try to scan it
  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.QR_CODE,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  try {
    const luminanceSource = new RGBLuminanceSource(
      new Uint8ClampedArray(testImageData.data),
      testWidth,
      testHeight
    );
    const binaryBitmap = new BinaryBitmap(new HybridBinarizer(luminanceSource));
    const result = reader.decode(binaryBitmap);
    console.log('Test barcode detected:', result.getText());
  } catch (error) {
    if (error instanceof NotFoundException) {
      console.log('Test barcode not found (expected - this is just a pattern)');
    } else {
      console.error('Test error:', error.message);
      console.error('Stack:', error.stack);
    }
  }

  console.log('\n=== ZXing library loaded and working ===\n');
  console.log('RGBLuminanceSource available:', typeof RGBLuminanceSource);
  console.log('MultiFormatReader available:', typeof MultiFormatReader);
  console.log('BarcodeFormat.CODE_128:', BarcodeFormat.CODE_128);
}

testBarcode().catch(console.error);
