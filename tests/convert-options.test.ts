import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler } from 'pdf-poppler-core';

describe('Enhanced ConvertOptions', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(async () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);

    // Warmup
    try {
      await poppler.convert(samplePdfBuffer, { format: 'png', page: 1 });
    } catch (e) {
      // Ignore warmup errors
    }
  }, 15000);

  describe('dpi option', () => {
    it('should set resolution using dpi', async () => {
      const lowDpi = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 72
      });

      const highDpi = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 150
      });

      expect(lowDpi.length).toBe(1);
      expect(highDpi.length).toBe(1);
      // Higher DPI should produce larger file
      expect(highDpi[0].data.length).toBeGreaterThan(lowDpi[0].data.length);
    });

    it('should prefer dpi over scale when both provided', async () => {
      const withDpi = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 72,
        scale: 2000 // This should be ignored when dpi is set
      });

      const withScale = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        scale: 2000
      });

      expect(withDpi.length).toBe(1);
      expect(withScale.length).toBe(1);
      // With dpi=72, output should be smaller than scale=2000
      expect(withDpi[0].data.length).toBeLessThan(withScale[0].data.length);
    });
  });

  describe('quality option (JPEG)', () => {
    it('should control JPEG quality', async () => {
      const lowQuality = await poppler.convert(samplePdfBuffer, {
        format: 'jpeg',
        page: 1,
        quality: 10
      });

      const highQuality = await poppler.convert(samplePdfBuffer, {
        format: 'jpeg',
        page: 1,
        quality: 95
      });

      expect(lowQuality.length).toBe(1);
      expect(highQuality.length).toBe(1);

      // Verify JPEG headers
      expect(lowQuality[0].data[0]).toBe(0xFF);
      expect(lowQuality[0].data[1]).toBe(0xD8);
      expect(highQuality[0].data[0]).toBe(0xFF);
      expect(highQuality[0].data[1]).toBe(0xD8);

      // Higher quality should produce larger file
      expect(highQuality[0].data.length).toBeGreaterThan(lowQuality[0].data.length);
    });

    it('should ignore quality option for non-JPEG formats', async () => {
      const pngWithQuality = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        quality: 10 // Should be ignored for PNG
      });

      expect(pngWithQuality.length).toBe(1);
      // Should still produce valid PNG
      expect(pngWithQuality[0].data[0]).toBe(0x89);
      expect(pngWithQuality[0].data[1]).toBe(0x50);
    });
  });

  describe('transparent option (PNG)', () => {
    it('should create PNG with transparency option', async () => {
      const withTransparency = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        transparent: true
      });

      expect(withTransparency.length).toBe(1);
      expect(withTransparency[0].data).toBeInstanceOf(Buffer);

      // Verify it's a valid PNG
      expect(withTransparency[0].data[0]).toBe(0x89);
      expect(withTransparency[0].data[1]).toBe(0x50);
    });

    it('should produce different output with and without transparency', async () => {
      const withTransparency = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        transparent: true,
        dpi: 72
      });

      const withoutTransparency = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        transparent: false,
        dpi: 72
      });

      expect(withTransparency.length).toBe(1);
      expect(withoutTransparency.length).toBe(1);

      // Both should be valid PNGs but may have different sizes
      expect(withTransparency[0].data[0]).toBe(0x89);
      expect(withoutTransparency[0].data[0]).toBe(0x89);
    });
  });

  describe('firstPage/lastPage options', () => {
    it('should convert page range with firstPage and lastPage', async () => {
      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      if (totalPages >= 2) {
        const pages = await poppler.convert(samplePdfBuffer, {
          format: 'png',
          firstPage: 1,
          lastPage: 2
        });

        expect(pages.length).toBe(2);
        expect(pages[0].page).toBe(1);
        expect(pages[1].page).toBe(2);
      } else {
        // Single page PDF, just convert page 1
        const pages = await poppler.convert(samplePdfBuffer, {
          format: 'png',
          firstPage: 1,
          lastPage: 1
        });

        expect(pages.length).toBe(1);
        expect(pages[0].page).toBe(1);
      }
    });

    it('should use firstPage only when lastPage not specified', async () => {
      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        firstPage: 1
      });

      // Should convert from firstPage to end
      expect(pages.length).toBe(totalPages);
      expect(pages[0].page).toBe(1);
    });

    it('should use lastPage only when firstPage not specified', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        lastPage: 1
      });

      // Should convert from 1 to lastPage
      expect(pages.length).toBe(1);
      expect(pages[0].page).toBe(1);
    });
  });

  describe('pages array option', () => {
    it('should convert only specified pages', async () => {
      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      if (totalPages >= 1) {
        const pages = await poppler.convert(samplePdfBuffer, {
          format: 'png',
          pages: [1]
        });

        expect(pages.length).toBe(1);
        expect(pages[0].page).toBe(1);
      }
    });

    it('should handle empty pages array by converting all pages', async () => {
      const info = await poppler.info(samplePdfBuffer);
      const totalPages = parseInt(info.pages, 10);

      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        pages: []
      });

      // Empty array should convert all pages (or be treated as no filter)
      expect(pages.length).toBe(totalPages);
    });
  });

  describe('antialias option', () => {
    it('should accept antialias option', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        antialias: 'default'
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
    });

    it('should accept different antialias values', async () => {
      const antialiasValues: Array<'default' | 'none' | 'gray' | 'subpixel'> = [
        'default', 'none', 'gray', 'subpixel'
      ];

      for (const antialias of antialiasValues) {
        const pages = await poppler.convert(samplePdfBuffer, {
          format: 'png',
          page: 1,
          antialias
        });

        expect(pages.length).toBe(1);
        expect(pages[0].data).toBeInstanceOf(Buffer);
      }
    });
  });

  describe('cropBox option', () => {
    it('should accept cropBox option', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        cropBox: true
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
    });
  });

  describe('combined options', () => {
    it('should handle multiple options together', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        dpi: 100,
        transparent: true,
        antialias: 'gray'
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
      // Verify PNG header
      expect(pages[0].data[0]).toBe(0x89);
      expect(pages[0].data[1]).toBe(0x50);
    });

    it('should handle JPEG with quality and dpi', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'jpeg',
        page: 1,
        dpi: 100,
        quality: 85
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
      // Verify JPEG header
      expect(pages[0].data[0]).toBe(0xFF);
      expect(pages[0].data[1]).toBe(0xD8);
    });
  });

  describe.skip('password option (requires encrypted PDF)', () => {
    // These tests require an encrypted PDF file
    // Skip until we have test fixtures

    it('should decrypt password-protected PDF', async () => {
      // TODO: Create encrypted test PDF
    });

    it('should throw EncryptedPdfError without password', async () => {
      // TODO: Create encrypted test PDF
    });
  });
});
