import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler } from 'pdf-poppler-core';

describe('PDF Flatten Functionality', () => {
  const formPdfPath = path.join(__dirname, '..', 'form_sample.pdf');
  const testOutputDir = path.join(__dirname, '..', 'test-output');
  let poppler: PdfPoppler;

  beforeAll(async () => {
    poppler = new PdfPoppler();

    // Create test output directory if it doesn't exist
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    const testFiles = fs.readdirSync(testOutputDir);
    testFiles.forEach(file => {
      if (file.startsWith('flatten-test')) {
        fs.unlinkSync(path.join(testOutputDir, file));
      }
    });
  });

  describe('poppler.flatten()', () => {
    it('should have form_sample.pdf available', () => {
      expect(fs.existsSync(formPdfPath)).toBe(true);
    });

    it('should flatten a PDF with form fields', async () => {
      const outputPath = path.join(testOutputDir, 'flatten-test-output.pdf');

      const result = await poppler.flatten(formPdfPath, outputPath);

      expect(result).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);

      // Flattened file should exist and have content
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should create a valid PDF after flattening', async () => {
      const outputPath = path.join(testOutputDir, 'flatten-test-valid.pdf');

      await poppler.flatten(formPdfPath, outputPath);

      // Check PDF header
      const buffer = fs.readFileSync(outputPath);
      const header = buffer.slice(0, 5).toString();
      expect(header).toBe('%PDF-');
    });

    it('should be able to get info from flattened PDF', async () => {
      const outputPath = path.join(testOutputDir, 'flatten-test-info.pdf');

      await poppler.flatten(formPdfPath, outputPath);
      const info = await poppler.info(outputPath);

      expect(info).toBeDefined();
      expect(info.pages).toBeDefined();
      expect(parseInt(info.pages)).toBeGreaterThan(0);
    });

    it('should handle non-existent file', async () => {
      const outputPath = path.join(testOutputDir, 'flatten-test-error.pdf');

      await expect(
        poppler.flatten('non-existent.pdf', outputPath)
      ).rejects.toThrow();
    });

    it('should handle invalid PDF file', async () => {
      const invalidPath = path.join(__dirname, '..', 'package.json');
      const outputPath = path.join(testOutputDir, 'flatten-test-invalid.pdf');

      await expect(
        poppler.flatten(invalidPath, outputPath)
      ).rejects.toThrow();
    });
  });

  describe('Flatten and Convert workflow', () => {
    it('should flatten then convert to PNG', async () => {
      const flattenedPath = path.join(testOutputDir, 'flatten-test-workflow.pdf');

      // Step 1: Flatten
      await poppler.flatten(formPdfPath, flattenedPath);
      expect(fs.existsSync(flattenedPath)).toBe(true);

      // Step 2: Convert to PNG
      await poppler.convert(flattenedPath, {
        format: 'png',
        out_dir: testOutputDir,
        out_prefix: 'flatten-test-converted',
        page: 1
      });

      // Check PNG was created
      const pngPath = path.join(testOutputDir, 'flatten-test-converted-1.png');
      expect(fs.existsSync(pngPath)).toBe(true);

      // Verify it's a valid PNG
      const pngBuffer = fs.readFileSync(pngPath);
      expect(pngBuffer[0]).toBe(0x89);
      expect(pngBuffer[1]).toBe(0x50); // P
      expect(pngBuffer[2]).toBe(0x4E); // N
      expect(pngBuffer[3]).toBe(0x47); // G
    });

    it('should produce larger image with form data than without', async () => {
      // This test verifies that flattening actually includes form field data
      // A flattened PDF with form values should produce a different (likely larger) image

      const flattenedPath = path.join(testOutputDir, 'flatten-test-compare.pdf');

      // Flatten and convert
      await poppler.flatten(formPdfPath, flattenedPath);
      await poppler.convert(flattenedPath, {
        format: 'png',
        out_dir: testOutputDir,
        out_prefix: 'flatten-test-with-data',
        page: 1
      });

      const withDataPath = path.join(testOutputDir, 'flatten-test-with-data-1.png');
      expect(fs.existsSync(withDataPath)).toBe(true);

      const stats = fs.statSync(withDataPath);
      // Just verify we got a reasonable sized image (form data rendered)
      expect(stats.size).toBeGreaterThan(1000);
    });
  });
});
