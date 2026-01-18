import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler } from 'pdf-poppler-core';
import {
  PdfPopplerError,
  InvalidPdfError,
  EncryptedPdfError,
  PageOutOfRangeError,
  BinaryNotFoundError,
} from 'pdf-poppler-core';

describe('Custom Error Types', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('InvalidPdfError', () => {
    it('should throw InvalidPdfError for corrupted PDF', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.info(invalidBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw InvalidPdfError for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(poppler.info(emptyBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should throw InvalidPdfError for random bytes', async () => {
      const randomBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
      await expect(poppler.info(randomBuffer)).rejects.toThrow(InvalidPdfError);
    });

    it('should include stderr in InvalidPdfError', async () => {
      const invalidBuffer = Buffer.from('invalid content');
      try {
        await poppler.info(invalidBuffer);
        fail('Expected an error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(InvalidPdfError);
        expect((e as InvalidPdfError).stderr).toBeDefined();
      }
    });
  });

  describe('PageOutOfRangeError', () => {
    it('should throw PageOutOfRangeError for page number beyond total pages', async () => {
      await expect(
        poppler.convert(samplePdfBuffer, { page: 999 })
      ).rejects.toThrow(PageOutOfRangeError);
    });

    it('should throw PageOutOfRangeError for page 0', async () => {
      await expect(
        poppler.convert(samplePdfBuffer, { page: 0 })
      ).rejects.toThrow(PageOutOfRangeError);
    });

    it('should throw PageOutOfRangeError for negative page', async () => {
      await expect(
        poppler.convert(samplePdfBuffer, { page: -1 })
      ).rejects.toThrow(PageOutOfRangeError);
    });

    it('should include page info in error message', async () => {
      try {
        await poppler.convert(samplePdfBuffer, { page: 999 });
        fail('Expected an error to be thrown');
      } catch (e) {
        expect(e).toBeInstanceOf(PageOutOfRangeError);
        expect((e as PageOutOfRangeError).message).toContain('999');
        expect((e as PageOutOfRangeError).message).toContain('out of range');
      }
    });
  });

  describe('PdfPopplerError base class', () => {
    it('should have correct error name', () => {
      const error = new PdfPopplerError('test error');
      expect(error.name).toBe('PdfPopplerError');
    });

    it('should store stderr', () => {
      const error = new PdfPopplerError('test error', 'some stderr output');
      expect(error.stderr).toBe('some stderr output');
    });

    it('should have correct inheritance chain', () => {
      const error = new InvalidPdfError();
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PdfPopplerError);
      expect(error).toBeInstanceOf(InvalidPdfError);
    });
  });

  describe('BinaryNotFoundError', () => {
    it('should have correct error name', () => {
      const error = new BinaryNotFoundError('pdfinfo');
      expect(error.name).toBe('BinaryNotFoundError');
      expect(error.message).toContain('pdfinfo');
    });
  });

  describe('Error types are exported', () => {
    it('should export PdfPopplerError', () => {
      expect(PdfPopplerError).toBeDefined();
    });

    it('should export InvalidPdfError', () => {
      expect(InvalidPdfError).toBeDefined();
    });

    it('should export EncryptedPdfError', () => {
      expect(EncryptedPdfError).toBeDefined();
    });

    it('should export PageOutOfRangeError', () => {
      expect(PageOutOfRangeError).toBeDefined();
    });

    it('should export BinaryNotFoundError', () => {
      expect(BinaryNotFoundError).toBeDefined();
    });
  });
});
