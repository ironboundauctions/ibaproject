#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const fetch = require('node-fetch');

async function testBarcodeScanning() {
  const workerUrl = process.env.WORKER_URL || 'http://localhost:8080';

  console.log('Testing barcode scanning at:', workerUrl);
  console.log('');

  // Check if test images directory exists
  const testImagesDir = process.argv[2] || './test-images';

  if (!fs.existsSync(testImagesDir)) {
    console.error(`Error: Test images directory not found: ${testImagesDir}`);
    console.error('Usage: node test-barcode-local.js [path-to-images-directory]');
    process.exit(1);
  }

  // Get all image files
  const files = fs.readdirSync(testImagesDir)
    .filter(f => /\.(jpg|jpeg|png|gif|bmp)$/i.test(f))
    .slice(0, 6); // Limit to 6 files for testing

  if (files.length === 0) {
    console.error('No image files found in:', testImagesDir);
    process.exit(1);
  }

  console.log(`Found ${files.length} image files`);
  console.log('');

  // Create form data
  const formData = new FormData();
  files.forEach(fileName => {
    const filePath = path.join(testImagesDir, fileName);
    const fileBuffer = fs.readFileSync(filePath);
    formData.append('files', fileBuffer, { filename: fileName });
  });

  // Send request
  console.log('Sending request to worker...');
  const startTime = Date.now();

  try {
    const response = await fetch(`${workerUrl}/api/analyze-batch`, {
      method: 'POST',
      body: formData,
      headers: formData.getHeaders(),
    });

    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Error: ${response.status} - ${errorText}`);
      process.exit(1);
    }

    const result = await response.json();

    console.log(`\nResponse received in ${duration}ms\n`);
    console.log('=== RESULTS ===\n');

    console.log(`Total files analyzed: ${files.length}`);
    console.log(`Grouped items: ${result.grouped.length}`);
    console.log(`Ungrouped files: ${result.ungrouped.length}`);
    console.log(`Errors: ${result.errors.length}`);
    console.log('');

    if (result.grouped.length > 0) {
      console.log('Grouped by barcode:');
      result.grouped.forEach(group => {
        console.log(`  ${group.inv_number}:`);
        group.files.forEach(file => {
          console.log(`    - ${file.fileName}`);
        });
      });
      console.log('');
    }

    if (result.ungrouped.length > 0) {
      console.log('Ungrouped (no barcode detected):');
      result.ungrouped.forEach(file => {
        console.log(`  - ${file.fileName}`);
      });
      console.log('');
    }

    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach(err => {
        console.log(`  - ${err.fileName}: ${err.error}`);
      });
      console.log('');
    }

  } catch (error) {
    console.error('Request failed:', error.message);
    process.exit(1);
  }
}

testBarcodeScanning().catch(console.error);
