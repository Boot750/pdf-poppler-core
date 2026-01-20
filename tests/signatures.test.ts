import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler, InvalidPdfError, BinaryNotFoundError } from 'pdf-poppler-core';

describe('Signature Verification', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;
  let pdfsigFunctional = false;

  beforeAll(async () => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);

    // Check if pdfsig binary exists AND is functional
    // (on macOS, the binary exists but NSS libraries may be missing)
    const binPath = poppler.getPath();
    const pdfsigPath = process.platform === 'win32'
      ? path.join(binPath, 'pdfsig.exe')
      : path.join(binPath, 'pdfsig');

    if (fs.existsSync(pdfsigPath)) {
      // Actually test if pdfsig works
      try {
        await poppler.verifySignatures(samplePdfBuffer);
        pdfsigFunctional = true;
      } catch (e) {
        // If it throws BinaryNotFoundError, pdfsig is not functional
        pdfsigFunctional = !(e instanceof BinaryNotFoundError);
      }
    }
  });

  describe('verifySignatures()', () => {
    it('should return SignatureInfo object or throw BinaryNotFoundError', async () => {
      if (!pdfsigFunctional) {
        await expect(poppler.verifySignatures(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const result = await poppler.verifySignatures(samplePdfBuffer);
      expect(result).toHaveProperty('signed');
      expect(result).toHaveProperty('signatures');
      expect(typeof result.signed).toBe('boolean');
      expect(Array.isArray(result.signatures)).toBe(true);
    });

    it('should detect unsigned PDF or throw BinaryNotFoundError', async () => {
      if (!pdfsigFunctional) {
        await expect(poppler.verifySignatures(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      // sample.pdf is likely unsigned
      const result = await poppler.verifySignatures(samplePdfBuffer);
      expect(result.signed).toBe(false);
      expect(result.signatures).toEqual([]);
    });

    it('should accept Buffer input or throw BinaryNotFoundError', async () => {
      if (!pdfsigFunctional) {
        await expect(poppler.verifySignatures(samplePdfBuffer)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const result = await poppler.verifySignatures(samplePdfBuffer);
      expect(typeof result.signed).toBe('boolean');
    });

    it('should accept Uint8Array input or throw BinaryNotFoundError', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      if (!pdfsigFunctional) {
        await expect(poppler.verifySignatures(uint8Array)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const result = await poppler.verifySignatures(uint8Array);
      expect(typeof result.signed).toBe('boolean');
    });

    it('should accept Readable stream input or throw BinaryNotFoundError', async () => {
      const stream = Readable.from(samplePdfBuffer);
      if (!pdfsigFunctional) {
        await expect(poppler.verifySignatures(stream)).rejects.toThrow(BinaryNotFoundError);
        return;
      }

      const result = await poppler.verifySignatures(stream);
      expect(typeof result.signed).toBe('boolean');
    });
  });

  describe('Error Handling', () => {
    it('should throw appropriate error for invalid input', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      if (!pdfsigFunctional) {
        await expect(poppler.verifySignatures(invalidBuffer)).rejects.toThrow(BinaryNotFoundError);
      } else {
        await expect(poppler.verifySignatures(invalidBuffer)).rejects.toThrow(InvalidPdfError);
      }
    });

    it('should throw appropriate error for empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      if (!pdfsigFunctional) {
        await expect(poppler.verifySignatures(emptyBuffer)).rejects.toThrow(BinaryNotFoundError);
      } else {
        await expect(poppler.verifySignatures(emptyBuffer)).rejects.toThrow(InvalidPdfError);
      }
    });

    it('should throw error for null input', async () => {
      await expect(poppler.verifySignatures(null as any)).rejects.toThrow();
    });

    it('should throw error for undefined input', async () => {
      await expect(poppler.verifySignatures(undefined as any)).rejects.toThrow();
    });
  });

  describe.skip('Signed PDFs', () => {
    // These tests require a digitally signed PDF file
    // Skip until we have test fixtures

    it('should detect signed PDF', async () => {
      // TODO: Create signed test PDF
    });

    it('should return signature details', async () => {
      // TODO: Create signed test PDF
    });

    it('should validate signature', async () => {
      // TODO: Create signed test PDF
    });
  });
});
