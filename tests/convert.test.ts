import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, PageResult } from 'pdf-poppler-core';

describe('PDF Convert Functionality', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  const testOutputDir = path.join(__dirname, '..', 'test-output');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(async () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);

    // Create test output directory if it doesn't exist
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // Warmup: Run a quick conversion to initialize pdftocairo/libraries
    try {
      await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });
    } catch (e) {
      console.warn('Warmup conversion failed:', e);
    }
  }, 15000);

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  describe('poppler.convert() - Basic Conversion', () => {
    it('should convert PDF to PNG format and return buffers', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png'
      });

      expect(pages.length).toBeGreaterThan(0);
      pages.forEach(page => {
        expect(page.page).toBeGreaterThan(0);
        expect(page.data).toBeInstanceOf(Buffer);
        expect(page.data.length).toBeGreaterThan(1000);
      });
    }, 10000);

    it('should convert PDF to JPEG format', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'jpeg'
      });

      expect(pages.length).toBeGreaterThan(0);
      pages.forEach(page => {
        expect(page.data).toBeInstanceOf(Buffer);
        expect(page.data.length).toBeGreaterThan(500);
        // JPEG magic bytes
        expect(page.data[0]).toBe(0xFF);
        expect(page.data[1]).toBe(0xD8);
      });
    });

    it('should convert single page when page option is specified', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);
      expect(pages[0].page).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
    });

    it('should handle different scale options', async () => {
      const pagesSmall = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        scale: 256
      });

      const pagesLarge = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1,
        scale: 1024
      });

      expect(pagesSmall.length).toBe(1);
      expect(pagesLarge.length).toBe(1);
      // Larger scale should produce larger file
      expect(pagesLarge[0].data.length).toBeGreaterThan(pagesSmall[0].data.length);
    });
  });

  describe('poppler.convert() - Format Support', () => {
    const reliableScalableFormats: Array<'png' | 'jpeg'> = ['png', 'jpeg'];

    reliableScalableFormats.forEach(format => {
      it(`should support ${format} format`, async () => {
        const pages = await poppler.convert(samplePdfBuffer, {
          format: format,
          page: 1,
          scale: 512
        });

        expect(pages.length).toBe(1);
        expect(pages[0].data).toBeInstanceOf(Buffer);
        expect(pages[0].data.length).toBeGreaterThan(100);
      });
    });

    it('should support tiff format (with platform considerations)', async () => {
      try {
        const pages = await poppler.convert(samplePdfBuffer, {
          format: 'tiff',
          page: 1,
          scale: 512
        });
        expect(pages.length).toBe(1);
        expect(pages[0].data).toBeInstanceOf(Buffer);
      } catch (error: any) {
        if (process.platform === 'win32' && error.message.includes('Error writing TIFF header')) {
          console.warn('TIFF format not fully supported on this Windows poppler build');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    });

    it('should fallback to default format (png) for unsupported format', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'unsupported_format' as any,
        page: 1
      });

      expect(pages.length).toBe(1);
      // Should produce PNG (default)
      expect(pages[0].data[0]).toBe(0x89);
      expect(pages[0].data[1]).toBe(0x50); // P
    });
  });

  describe('poppler.convert() - Input Types', () => {
    it('should accept Buffer input', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
    });

    it('should accept Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const pages = await poppler.convert(uint8Array, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
    });

    it('should accept Readable stream input', async () => {
      const stream = Readable.from(samplePdfBuffer);
      const pages = await poppler.convert(stream, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);
    });
  });

  describe('poppler.convertToStream()', () => {
    it('should return array of page streams', async () => {
      const streams = await poppler.convertToStream(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      expect(streams.length).toBe(1);
      expect(streams[0].page).toBe(1);
      expect(typeof streams[0].stream.pipe).toBe('function');

      // Clean up stream to prevent open handles
      streams[0].stream.destroy();
    });

    it('should stream valid PNG data', async () => {
      const streams = await poppler.convertToStream(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        streams[0].stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        streams[0].stream.on('end', () => resolve());
        streams[0].stream.on('error', reject);
      });

      const result = Buffer.concat(chunks);
      // PNG magic bytes
      expect(result[0]).toBe(0x89);
      expect(result[1]).toBe(0x50);
      expect(result[2]).toBe(0x4E);
      expect(result[3]).toBe(0x47);
    });
  });

  describe('poppler.convert() - Error Handling', () => {
    it('should handle invalid PDF data', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');

      await expect(poppler.convert(invalidBuffer, {
        format: 'png',
        page: 1
      })).rejects.toThrow();
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(poppler.convert(emptyBuffer, {
        format: 'png',
        page: 1
      })).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      const invalidBuffer = Buffer.from('invalid pdf content');

      try {
        await poppler.convert(invalidBuffer, { format: 'png', page: 1 });
        fail('Expected an error to be thrown');
      } catch (error: any) {
        expect(error).toBeTruthy();
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('poppler.convert() - Output Verification', () => {
    it('should return correct page numbers', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png'
      });

      // Pages should be numbered sequentially starting from 1
      pages.forEach((page, index) => {
        expect(page.page).toBe(index + 1);
      });
    });

    it('should verify PNG file integrity by checking headers', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);

      const buffer = pages[0].data;
      // PNG files start with specific magic bytes
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // 'P'
      expect(buffer[2]).toBe(0x4E); // 'N'
      expect(buffer[3]).toBe(0x47); // 'G'
    });

    it('should be able to save output to file', async () => {
      const pages = await poppler.convert(samplePdfBuffer, {
        format: 'png',
        page: 1
      });

      const outputPath = path.join(testOutputDir, 'test-save-output.png');
      fs.writeFileSync(outputPath, pages[0].data);

      expect(fs.existsSync(outputPath)).toBe(true);
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBe(pages[0].data.length);

      // Clean up
      fs.unlinkSync(outputPath);
    });
  });
});
