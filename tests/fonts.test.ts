import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, InvalidPdfError } from 'pdf-poppler-core';

describe('Font Listing', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('listFonts()', () => {
    it('should list fonts in PDF', async () => {
      const fonts = await poppler.listFonts(samplePdfBuffer);

      expect(Array.isArray(fonts)).toBe(true);
    });

    it('should parse font properties correctly', async () => {
      const fonts = await poppler.listFonts(samplePdfBuffer);

      if (fonts.length > 0) {
        expect(fonts[0]).toHaveProperty('name');
        expect(fonts[0]).toHaveProperty('type');
        expect(fonts[0]).toHaveProperty('encoding');
        expect(fonts[0]).toHaveProperty('embedded');
        expect(fonts[0]).toHaveProperty('subset');
        expect(fonts[0]).toHaveProperty('unicode');
      }
    });

    it('should have correct property types', async () => {
      const fonts = await poppler.listFonts(samplePdfBuffer);

      if (fonts.length > 0) {
        fonts.forEach(font => {
          expect(typeof font.name).toBe('string');
          expect(typeof font.type).toBe('string');
          expect(typeof font.encoding).toBe('string');
          expect(typeof font.embedded).toBe('boolean');
          expect(typeof font.subset).toBe('boolean');
          expect(typeof font.unicode).toBe('boolean');
        });
      }
    });

    it('should accept Buffer input', async () => {
      const fonts = await poppler.listFonts(samplePdfBuffer);
      expect(Array.isArray(fonts)).toBe(true);
    });

    it('should accept Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const fonts = await poppler.listFonts(uint8Array);
      expect(Array.isArray(fonts)).toBe(true);
    });

    it('should accept Readable stream input', async () => {
      const stream = Readable.from(samplePdfBuffer);
      const fonts = await poppler.listFonts(stream);
      expect(Array.isArray(fonts)).toBe(true);
    });

    it('should return consistent results across multiple calls', async () => {
      const fonts1 = await poppler.listFonts(samplePdfBuffer);
      const fonts2 = await poppler.listFonts(samplePdfBuffer);

      expect(fonts1).toEqual(fonts2);
    });
  });

  describe('Error Handling', () => {
    it('should throw InvalidPdfError for invalid input', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.listFonts(invalidBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw InvalidPdfError for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(poppler.listFonts(emptyBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw error for null input', async () => {
      await expect(poppler.listFonts(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined input', async () => {
      await expect(poppler.listFonts(undefined as any)).rejects.toThrow();
    });
  });

  describe.skip('Password protected PDFs', () => {
    // These tests require an encrypted PDF file
    // Skip until we have test fixtures

    it('should list fonts with correct password', async () => {
      // TODO: Create encrypted test PDF
    });

    it('should throw EncryptedPdfError without password', async () => {
      // TODO: Create encrypted test PDF
    });
  });
});
