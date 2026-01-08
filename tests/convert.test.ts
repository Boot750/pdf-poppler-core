import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler } from 'pdf-poppler-core';

describe('PDF Convert Functionality', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  const testOutputDir = path.join(__dirname, '..', 'test-output');
  let poppler: PdfPoppler;

  beforeAll(async () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();

    // Create test output directory if it doesn't exist
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }

    // Warmup: Run a quick conversion to initialize pdftocairo/libraries
    try {
      await poppler.convert(samplePdfPath, {
        format: 'png',
        out_dir: testOutputDir,
        out_prefix: 'warmup',
        page: 1
      });
      // Clean up warmup file
      const warmupFile = path.join(testOutputDir, 'warmup-1.png');
      if (fs.existsSync(warmupFile)) {
        fs.unlinkSync(warmupFile);
      }
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
    it('should convert PDF to PNG format', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-png-page',
        page: null
      };

      // Clean up any existing test files first
      const existingFiles = fs.readdirSync(testOutputDir);
      const existingTestFiles = existingFiles.filter(f => f.startsWith('test-png-page'));
      existingTestFiles.forEach(f => {
        fs.unlinkSync(path.join(testOutputDir, f));
      });

      await poppler.convert(samplePdfPath, options);

      await new Promise(resolve => setTimeout(resolve, 100));

      const files = fs.readdirSync(testOutputDir);
      const pngFiles = files.filter(file => file.startsWith('test-png-page') && file.endsWith('.png'));

      expect(pngFiles.length).toBeGreaterThan(0);

      pngFiles.forEach(file => {
        const filePath = path.join(testOutputDir, file);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(1000);
      });
    }, 10000);

    it('should convert PDF to JPEG format', async () => {
      const options = {
        format: 'jpeg' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-jpeg-page',
        page: null
      };

      await poppler.convert(samplePdfPath, options);

      const files = fs.readdirSync(testOutputDir);
      const jpegFiles = files.filter(file => file.startsWith('test-jpeg-page') && file.endsWith('.jpg'));

      expect(jpegFiles.length).toBeGreaterThan(0);

      jpegFiles.forEach(file => {
        const filePath = path.join(testOutputDir, file);
        const stats = fs.statSync(filePath);
        expect(stats.size).toBeGreaterThan(500);
      });
    });

    it('should convert single page when page option is specified', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-single-page',
        page: 1
      };

      await poppler.convert(samplePdfPath, options);

      const files = fs.readdirSync(testOutputDir);
      const pngFiles = files.filter(file => file.startsWith('test-single-page') && file.endsWith('.png'));

      expect(pngFiles.length).toBe(1);
      expect(pngFiles[0]).toBe('test-single-page-1.png');
    });

    it('should handle different scale options', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-scale-512',
        page: 1,
        scale: 512
      };

      await poppler.convert(samplePdfPath, options);

      const files = fs.readdirSync(testOutputDir);
      const pngFiles = files.filter(file => file.startsWith('test-scale-512') && file.endsWith('.png'));

      expect(pngFiles.length).toBe(1);

      const filePath = path.join(testOutputDir, pngFiles[0]);
      const stats = fs.statSync(filePath);
      expect(stats.size).toBeGreaterThan(1000);
    });
  });

  describe('poppler.convert() - Format Support', () => {
    const reliableScalableFormats: Array<'png' | 'jpeg'> = ['png', 'jpeg'];

    reliableScalableFormats.forEach(format => {
      it(`should support ${format} format`, async () => {
        const options = {
          format: format,
          out_dir: testOutputDir,
          out_prefix: `test-format-${format}`,
          page: 1,
          scale: 1024
        };

        await expect(poppler.convert(samplePdfPath, options)).resolves.not.toThrow();
      });
    });

    it('should support tiff format (with platform considerations)', async () => {
      const options = {
        format: 'tiff' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-format-tiff',
        page: 1,
        scale: 1024
      };

      try {
        await poppler.convert(samplePdfPath, options);
        expect(true).toBe(true);
      } catch (error: any) {
        if (process.platform === 'win32' && error.message.includes('Error writing TIFF header')) {
          console.warn('TIFF format not fully supported on this Windows poppler build');
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    });

    const nonScalableFormats: Array<'pdf' | 'ps' | 'eps' | 'svg'> = ['pdf', 'ps', 'eps', 'svg'];

    nonScalableFormats.forEach(format => {
      it(`should support ${format} format (without scaling)`, async () => {
        const options = {
          format: format,
          out_dir: testOutputDir,
          out_prefix: `test-format-${format}`,
          page: 1,
          scale: null
        };

        await expect(poppler.convert(samplePdfPath, options)).resolves.not.toThrow();
      });
    });

    it('should fallback to default format for unsupported format', async () => {
      const options = {
        format: 'unsupported_format' as any,
        out_dir: testOutputDir,
        out_prefix: 'test-unsupported',
        page: 1
      };

      await expect(poppler.convert(samplePdfPath, options)).resolves.not.toThrow();

      const files = fs.readdirSync(testOutputDir);
      const jpegFiles = files.filter(file => file.startsWith('test-unsupported') && file.endsWith('.jpg'));

      expect(jpegFiles.length).toBe(1);
    });
  });

  describe('poppler.convert() - Options Handling', () => {
    it('should use default values when options are not provided', async () => {
      const minimalOptions = {
        out_dir: testOutputDir,
        out_prefix: 'test-defaults'
      };

      await poppler.convert(samplePdfPath, minimalOptions);

      const files = fs.readdirSync(testOutputDir);
      const jpegFiles = files.filter(file => file.startsWith('test-defaults') && file.endsWith('.jpg'));

      expect(jpegFiles.length).toBeGreaterThan(0);
    });

    it('should handle missing out_dir by using default', async () => {
      const options = {
        format: 'png' as const,
        out_dir: '.',
        out_prefix: 'test-no-dir',
        page: 1
      };

      await expect(poppler.convert(samplePdfPath, options)).resolves.not.toThrow();
    });

    it('should handle numeric page values correctly', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-numeric-page',
        page: '1' as any
      };

      await poppler.convert(samplePdfPath, options);

      const files = fs.readdirSync(testOutputDir);
      const pngFiles = files.filter(file => file.startsWith('test-numeric-page') && file.endsWith('.png'));

      expect(pngFiles.length).toBe(1);
    });
  });

  describe('poppler.convert() - Error Handling', () => {
    it('should handle non-existent PDF file', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-error',
        page: 1
      };

      const nonExistentPath = path.join(__dirname, 'non-existent.pdf');

      await expect(poppler.convert(nonExistentPath, options)).rejects.toThrow();
    });

    it('should handle invalid PDF file', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-invalid',
        page: 1
      };

      const textFilePath = path.join(__dirname, '..', 'package.json');

      await expect(poppler.convert(textFilePath, options)).rejects.toThrow();
    });

    it('should handle invalid output directory gracefully', async () => {
      const options = {
        format: 'png' as const,
        out_dir: '/invalid/directory/path',
        out_prefix: 'test-invalid-dir',
        page: 1
      };

      await expect(poppler.convert(samplePdfPath, options)).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-error',
        page: 1
      };

      await expect(poppler.convert('non-existent-file.pdf', options)).rejects.toThrow();

      try {
        await poppler.convert('non-existent-file.pdf', options);
        fail('Expected an error to be thrown');
      } catch (error: any) {
        expect(error).toBeTruthy();
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('poppler.convert() - File Output Verification', () => {
    it('should create files with correct naming pattern', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-naming',
        page: null
      };

      await poppler.convert(samplePdfPath, options);

      const files = fs.readdirSync(testOutputDir);
      const pngFiles = files.filter(file => file.startsWith('test-naming') && file.endsWith('.png'));

      pngFiles.forEach(file => {
        expect(file).toMatch(/^test-naming-\d+\.png$/);
      });
    });

    it('should handle special characters in output prefix', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-special_chars-123',
        page: 1
      };

      await poppler.convert(samplePdfPath, options);

      const files = fs.readdirSync(testOutputDir);
      const pngFiles = files.filter(file => file.startsWith('test-special_chars-123') && file.endsWith('.png'));

      expect(pngFiles.length).toBe(1);
    });

    it('should verify file integrity by checking file headers', async () => {
      const options = {
        format: 'png' as const,
        out_dir: testOutputDir,
        out_prefix: 'test-integrity',
        page: 1
      };

      await poppler.convert(samplePdfPath, options);

      const files = fs.readdirSync(testOutputDir);
      const pngFiles = files.filter(file => file.startsWith('test-integrity') && file.endsWith('.png'));

      expect(pngFiles.length).toBe(1);

      const pngPath = path.join(testOutputDir, pngFiles[0]);
      const buffer = fs.readFileSync(pngPath);

      // PNG files start with specific magic bytes
      expect(buffer[0]).toBe(0x89);
      expect(buffer[1]).toBe(0x50); // 'P'
      expect(buffer[2]).toBe(0x4E); // 'N'
      expect(buffer[3]).toBe(0x47); // 'G'
    });
  });
});
