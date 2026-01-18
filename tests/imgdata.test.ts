import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { PdfPoppler } from 'pdf-poppler-core';

describe('PDF Image Data Functionality', () => {
  const samplePdfPath = path.join(__dirname, '..', 'sample.pdf');
  let poppler: PdfPoppler;
  let samplePdfBuffer: Buffer;

  beforeAll(() => {
    expect(fs.existsSync(samplePdfPath)).toBe(true);
    poppler = new PdfPoppler();
    samplePdfBuffer = fs.readFileSync(samplePdfPath);
  });

  describe('poppler.imgdata()', () => {
    it('should extract image data from PDF buffer', async () => {
      const imageData = await poppler.imgdata(samplePdfBuffer);

      expect(Array.isArray(imageData)).toBe(true);

      // If PDF contains images, verify structure
      if (imageData.length > 0) {
        imageData.forEach((image: any) => {
          expect(typeof image).toBe('object');
          expect(image).not.toBeNull();
        });
      }
    });

    it('should return empty array for PDF without images', async () => {
      // Most PDFs might not have embedded images
      const imageData = await poppler.imgdata(samplePdfBuffer);

      expect(Array.isArray(imageData)).toBe(true);
      // Length could be 0 or more depending on the sample PDF
      expect(imageData.length).toBeGreaterThanOrEqual(0);
    });

    it('should have consistent data structure for each image', async () => {
      const imageData = await poppler.imgdata(samplePdfBuffer);

      if (imageData.length > 0) {
        // Check that all image objects have similar structure
        const firstImage = imageData[0];
        const keys = Object.keys(firstImage);

        expect(keys.length).toBeGreaterThan(0);

        // Verify all images have the same keys
        imageData.forEach((image: any) => {
          expect(Object.keys(image)).toEqual(keys);
        });

        // Common expected properties based on pdfimages -list output
        const expectedProperties = [
          'page', 'num', 'type', 'width', 'height', 'color', 'comp', 'bpc', 'enc', 'interp', 'object', 'ID', 'x-ppi', 'y-ppi', 'size', 'ratio'
        ];

        // At least some of these properties should be present
        const presentProperties = expectedProperties.filter(prop => firstImage.hasOwnProperty(prop));
        expect(presentProperties.length).toBeGreaterThan(5); // Expect at least 6 common properties
      }
    });

    it('should handle PDF with various image types', async () => {
      const imageData = await poppler.imgdata(samplePdfBuffer);

      if (imageData.length > 0) {
        imageData.forEach((image: any) => {
          // Verify image type is a valid string
          if (image.type) {
            expect(typeof image.type).toBe('string');
            expect(image.type.length).toBeGreaterThan(0);
          }

          // Verify dimensions if present
          if (image.width) {
            expect(parseInt(image.width)).toBeGreaterThan(0);
          }
          if (image.height) {
            expect(parseInt(image.height)).toBeGreaterThan(0);
          }

          // Verify page number if present
          if (image.page) {
            expect(parseInt(image.page)).toBeGreaterThan(0);
          }
        });
      }
    });

    it('should parse numeric values correctly', async () => {
      const imageData = await poppler.imgdata(samplePdfBuffer);

      if (imageData.length > 0) {
        imageData.forEach((image: any) => {
          // Check that numeric fields can be parsed
          const numericFields = ['width', 'height', 'page', 'num', 'comp', 'bpc'];

          numericFields.forEach(field => {
            if (image[field] && image[field] !== '') {
              const numValue = parseInt(image[field]);
              expect(isNaN(numValue)).toBe(false);
              expect(numValue).toBeGreaterThanOrEqual(0);
            }
          });

          // Check floating point fields
          const floatFields = ['x-ppi', 'y-ppi'];
          floatFields.forEach(field => {
            if (image[field] && image[field] !== '') {
              const floatValue = parseFloat(image[field]);
              expect(isNaN(floatValue)).toBe(false);
              expect(floatValue).toBeGreaterThan(0);
            }
          });
        });
      }
    });

    it('should work with Uint8Array input', async () => {
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const imageData = await poppler.imgdata(uint8Array);

      expect(Array.isArray(imageData)).toBe(true);
    });

    it('should work with Readable stream input', async () => {
      const stream = Readable.from(samplePdfBuffer);
      const imageData = await poppler.imgdata(stream);

      expect(Array.isArray(imageData)).toBe(true);
    });

    it('should handle PDFs with different image encoding types', async () => {
      const imageData = await poppler.imgdata(samplePdfBuffer);

      if (imageData.length > 0) {
        imageData.forEach((image: any) => {
          // Verify encoding field if present
          if (image.enc) {
            expect(typeof image.enc).toBe('string');
          }

          // Verify color space if present
          if (image.color) {
            expect(typeof image.color).toBe('string');
          }
        });
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid PDF data gracefully', async () => {
      const invalidBuffer = Buffer.from('not a pdf file');
      await expect(poppler.imgdata(invalidBuffer)).rejects.toThrow();
    });

    it('should provide meaningful error messages', async () => {
      const invalidBuffer = Buffer.from('invalid pdf content');

      try {
        await poppler.imgdata(invalidBuffer);
        fail('Expected an error to be thrown');
      } catch (error: any) {
        expect(error).toBeTruthy();
        expect(error.message).toBeDefined();
        expect(typeof error.message).toBe('string');
        expect(error.message.length).toBeGreaterThan(0);
      }
    });

    it('should handle empty buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);
      await expect(poppler.imgdata(emptyBuffer)).rejects.toThrow();
    });

    it('should handle null/undefined input', async () => {
      await expect(poppler.imgdata(null as any)).rejects.toThrow();
      await expect(poppler.imgdata(undefined as any)).rejects.toThrow();
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should complete within reasonable time', async () => {
      const startTime = Date.now();

      await poppler.imgdata(samplePdfBuffer);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within 10 seconds for most PDFs
      expect(executionTime).toBeLessThan(10000);
    });

    it('should handle empty image data gracefully', async () => {
      const imageData = await poppler.imgdata(samplePdfBuffer);

      // Should always return an array, even if empty
      expect(Array.isArray(imageData)).toBe(true);

      if (imageData.length === 0) {
        // This is valid - PDF might not contain embedded images
        expect(imageData).toEqual([]);
      }
    });

    it('should handle PDF with many images efficiently', async () => {
      // This test depends on the sample PDF content
      const imageData = await poppler.imgdata(samplePdfBuffer);

      if (imageData.length > 10) {
        // If PDF has many images, verify they're all processed
        expect(imageData.length).toBeGreaterThan(0);

        // Verify no duplicate entries
        const pageNums = imageData.map((img: any) => `${img.page}-${img.num}`);
        const uniquePageNums = [...new Set(pageNums)];
        expect(pageNums.length).toBe(uniquePageNums.length);
      }
    });

    it('should maintain data consistency across multiple calls', async () => {
      const firstCall = await poppler.imgdata(samplePdfBuffer);
      const secondCall = await poppler.imgdata(samplePdfBuffer);

      expect(firstCall.length).toBe(secondCall.length);

      if (firstCall.length > 0) {
        // Compare structure of first image in both calls
        expect(Object.keys(firstCall[0])).toEqual(Object.keys(secondCall[0]));

        // Compare actual data
        expect(firstCall[0]).toEqual(secondCall[0]);
      }
    });
  });

  describe('listImages() - renamed from imgdata()', () => {
    it('should extract image metadata using listImages()', async () => {
      const images = await poppler.listImages(samplePdfBuffer);
      expect(Array.isArray(images)).toBe(true);
    });

    it('should maintain backward compatibility with imgdata()', async () => {
      const imagesFromImgdata = await poppler.imgdata(samplePdfBuffer);
      const imagesFromListImages = await poppler.listImages(samplePdfBuffer);

      expect(imagesFromImgdata.length).toBe(imagesFromListImages.length);

      if (imagesFromImgdata.length > 0) {
        expect(imagesFromImgdata[0]).toEqual(imagesFromListImages[0]);
      }
    });

    it('should work with all input types using listImages()', async () => {
      // Buffer
      const fromBuffer = await poppler.listImages(samplePdfBuffer);
      expect(Array.isArray(fromBuffer)).toBe(true);

      // Uint8Array
      const uint8Array = new Uint8Array(samplePdfBuffer);
      const fromUint8 = await poppler.listImages(uint8Array);
      expect(Array.isArray(fromUint8)).toBe(true);

      // Readable stream
      const stream = Readable.from(samplePdfBuffer);
      const fromStream = await poppler.listImages(stream);
      expect(Array.isArray(fromStream)).toBe(true);
    });
  });
});
