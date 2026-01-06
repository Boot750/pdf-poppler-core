import * as path from 'path';
import * as fs from 'fs';

// Use pdf-poppler-core package (linked locally in CI/CD)
const poppler = require('pdf-poppler-core');

describe('PDF Info Functionality', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
  });

  describe('poppler.info()', () => {
    it('should extract basic PDF information', async () => {
      const info = await poppler.info(samplePdfPath);

      expect(info).toBeDefined();
      expect(typeof info).toBe('object');

      // Check for essential properties that are always present
      expect(info).toHaveProperty('pages');
      expect(info).toHaveProperty('page_size');
      expect(info).toHaveProperty('width_in_pts');
      expect(info).toHaveProperty('height_in_pts');

      // Optional properties that may or may not be present
      // expect(info).toHaveProperty('title'); // Not all PDFs have titles
    });

    it('should parse page dimensions correctly', async () => {
      const info = await poppler.info(samplePdfPath);

      expect(info.width_in_pts).toBeGreaterThan(0);
      expect(info.height_in_pts).toBeGreaterThan(0);
      expect(typeof info.width_in_pts).toBe('number');
      expect(typeof info.height_in_pts).toBe('number');
    });

    it('should parse page count correctly', async () => {
      const info = await poppler.info(samplePdfPath);

      expect(info.pages).toBeDefined();
      expect(parseInt(info.pages)).toBeGreaterThan(0);
    });

    it('should handle non-existent file gracefully', async () => {
      const nonExistentPath = path.join(__dirname, 'non-existent.pdf');

      await expect(poppler.info(nonExistentPath)).rejects.toThrow();
    });

    it('should handle invalid file type gracefully', async () => {
      const textFilePath = path.join(__dirname, '..', 'package.json');

      await expect(poppler.info(textFilePath)).rejects.toThrow();
    });

    it('should return consistent data structure', async () => {
      const info = await poppler.info(samplePdfPath);

      // Verify expected property names (lowercase with underscores)
      const requiredProperties = [
        'pages', 'page_size', 'width_in_pts', 'height_in_pts'
      ];

      requiredProperties.forEach(prop => {
        expect(info).toHaveProperty(prop);
      });

      // Common optional properties
      const optionalProperties = ['title', 'creator', 'producer', 'pdf_version'];
      // These may or may not be present depending on the PDF

      // Check that property names follow the expected format
      Object.keys(info).forEach(key => {
        expect(key).toMatch(/^[a-z_]+$/);
      });
    });

    it('should handle relative and absolute paths', async () => {
      // Test with relative path
      const relativeInfo = await poppler.info('sample.pdf');
      expect(relativeInfo).toBeDefined();

      // Test with absolute path
      const absoluteInfo = await poppler.info(path.resolve('sample.pdf'));
      expect(absoluteInfo).toBeDefined();

      // Results should be the same
      expect(relativeInfo.pages).toBe(absoluteInfo.pages);
      expect(relativeInfo.width_in_pts).toBe(absoluteInfo.width_in_pts);
      expect(relativeInfo.height_in_pts).toBe(absoluteInfo.height_in_pts);
    });

    it('should parse metadata fields correctly', async () => {
      const info = await poppler.info(samplePdfPath);

      // Check that all string values are properly trimmed
      Object.values(info).forEach(value => {
        if (typeof value === 'string') {
          expect(value).toBe(value.trim());
          expect(value).not.toMatch(/^\s+|\s+$/);
        }
      });
    });

    it('should handle PDF with different page sizes consistently', async () => {
      const info = await poppler.info(samplePdfPath);

      // Ensure dimensions are positive numbers
      expect(info.width_in_pts).toBeGreaterThan(0);
      expect(info.height_in_pts).toBeGreaterThan(0);

      // Ensure page_size format is consistent
      expect(info.page_size).toMatch(/^\d+(\.\d+)?\s*x\s*\d+(\.\d+)?/);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      await expect(poppler.info('non-existent-file.pdf')).rejects.toThrow();

      try {
        await poppler.info('non-existent-file.pdf');
        fail('Expected an error to be thrown');
      } catch (error: any) {
        expect(error).toBeTruthy();
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty file path', async () => {
      await expect(poppler.info('')).rejects.toThrow();
    });

    it('should handle null/undefined input', async () => {
      await expect(poppler.info(null as any)).rejects.toThrow();
      await expect(poppler.info(undefined as any)).rejects.toThrow();
    });
  });
});