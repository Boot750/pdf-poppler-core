import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler, InvalidPdfError } from 'pdf-poppler-core';

describe('PDF Flatten Functionality', () => {
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
  });

  beforeEach(() => {
    if (!fs.existsSync(testOutputDir)) {
      fs.mkdirSync(testOutputDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    try {
      const testFiles = fs.readdirSync(testOutputDir);
      testFiles.forEach(file => {
        if (file.startsWith('flatten-test')) {
          fs.unlinkSync(path.join(testOutputDir, file));
        }
      });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('poppler.flatten()', () => {
    it('should flatten a PDF and return buffer', async () => {
      const result = await poppler.flatten(samplePdfBuffer);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should create a valid PDF after flattening', async () => {
      const result = await poppler.flatten(samplePdfBuffer);

      // Check PDF header
      const header = result.slice(0, 5).toString();
      expect(header).toBe('%PDF-');
    });

    it('should be able to get info from flattened PDF', async () => {
      const flattenedBuffer = await poppler.flatten(samplePdfBuffer);
      const info = await poppler.info(flattenedBuffer);

      expect(info).toBeDefined();
      expect(info.pages).toBeDefined();
      expect(parseInt(info.pages)).toBeGreaterThan(0);
    });

    it('should preserve page count after flattening', async () => {
      const originalInfo = await poppler.info(samplePdfBuffer);
      const flattenedBuffer = await poppler.flatten(samplePdfBuffer);
      const flattenedInfo = await poppler.info(flattenedBuffer);

      expect(flattenedInfo.pages).toBe(originalInfo.pages);
    });

    it('should handle invalid PDF data', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');

      await expect(poppler.flatten(invalidBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(poppler.flatten(emptyBuffer)).rejects.toThrow(InvalidPdfError);
    });
  });

  describe('poppler.flattenToStream()', () => {
    it('should return a readable stream', async () => {
      const stream = await poppler.flattenToStream(samplePdfBuffer);

      expect(stream).toBeDefined();
      expect(typeof stream.pipe).toBe('function');
      expect(typeof stream.on).toBe('function');

      // Consume and destroy stream to prevent open handles
      stream.destroy();
    });

    it('should stream valid PDF data', async () => {
      const stream = await poppler.flattenToStream(samplePdfBuffer);
      const chunks: Buffer[] = [];

      await new Promise<void>((resolve, reject) => {
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });

      const result = Buffer.concat(chunks);
      const header = result.slice(0, 5).toString();
      expect(header).toBe('%PDF-');
    });
  });

  describe('Flatten and Convert workflow', () => {
    it('should flatten then convert to PNG', async () => {
      // Step 1: Flatten
      const flattenedBuffer = await poppler.flatten(samplePdfBuffer);
      expect(flattenedBuffer.length).toBeGreaterThan(0);

      // Step 2: Convert to PNG
      const pages = await poppler.convert(flattenedBuffer, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);
      expect(pages[0].page).toBe(1);
      expect(pages[0].data).toBeInstanceOf(Buffer);

      // Verify it's a valid PNG
      const pngBuffer = pages[0].data;
      expect(pngBuffer[0]).toBe(0x89);
      expect(pngBuffer[1]).toBe(0x50); // P
      expect(pngBuffer[2]).toBe(0x4E); // N
      expect(pngBuffer[3]).toBe(0x47); // G
    });

    it('should produce reasonable sized image', async () => {
      // Flatten and convert
      const flattenedBuffer = await poppler.flatten(samplePdfBuffer);
      const pages = await poppler.convert(flattenedBuffer, {
        format: 'png',
        page: 1
      });

      expect(pages.length).toBe(1);
      // Just verify we got a reasonable sized image
      expect(pages[0].data.length).toBeGreaterThan(1000);
    });

    it('should be able to save converted image to file', async () => {
      const flattenedBuffer = await poppler.flatten(samplePdfBuffer);
      const pages = await poppler.convert(flattenedBuffer, {
        format: 'png',
        page: 1
      });

      // Save to file
      const outputPath = path.join(testOutputDir, 'flatten-test-output.png');
      fs.writeFileSync(outputPath, pages[0].data);

      expect(fs.existsSync(outputPath)).toBe(true);
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBe(pages[0].data.length);
    });
  });
});
