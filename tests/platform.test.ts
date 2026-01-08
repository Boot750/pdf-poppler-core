import * as path from 'path';
import * as fs from 'fs';
import { PdfPoppler } from 'pdf-poppler-core';

describe('Platform-Specific Functionality', () => {
  const originalPlatform = process.platform;

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform });
    jest.resetModules();
  });

  describe('Platform Detection', () => {
    it('should detect Windows platform correctly', () => {
      if (originalPlatform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const poppler = new PdfPoppler();

      expect(poppler.getPath()).toContain('win');
      expect(poppler.getPath()).toMatch(/poppler-\d+\.\d+/);
    });

    it.skip('should detect macOS platform correctly', () => {
      // TODO: Enable when macOS binaries are available
      if (originalPlatform === 'win32') {
        expect(true).toBe(true);
        return;
      }

      const poppler = new PdfPoppler();
      expect(poppler.getPath()).toContain('osx');
    });

    it('should detect Linux platform correctly', () => {
      if (originalPlatform === 'win32') {
        expect(true).toBe(true);
        return;
      }

      const poppler = new PdfPoppler();

      expect(poppler.getPath()).toContain('linux');
      expect(poppler.getPath()).toMatch(/poppler-(\d+\.\d+(-xvfb)?|xvfb-latest|latest)/);
    });
  });

  describe('Windows Platform Specific', () => {
    it('should set up correct paths for Windows', () => {
      if (originalPlatform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const poppler = new PdfPoppler();

      expect(poppler.getPath()).toContain('win');
      expect(poppler.getPath()).toMatch(/poppler-\d+\.\d+/);
      expect(poppler.getPath()).toContain('bin');
    });

    it('should detect Windows version correctly', () => {
      if (originalPlatform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const poppler = new PdfPoppler();

      expect(poppler.getVersion()).toBeDefined();
      expect(typeof poppler.getVersion()).toBe('string');
      expect(poppler.getVersion()).toMatch(/^\d+\.\d+$/);
    });

    it('should return available versions on Windows', () => {
      if (originalPlatform !== 'win32') {
        expect(true).toBe(true);
        return;
      }

      const poppler = new PdfPoppler();
      const versions = poppler.getAvailableVersions();

      expect(Array.isArray(versions)).toBe(true);
      expect(versions.length).toBeGreaterThan(0);

      versions.forEach((v) => {
        expect(typeof v.version).toBe('string');
        expect(v.hasXvfb).toBe(false);
        expect(typeof v.path).toBe('string');
        expect(v.path).toContain('win');
      });
    });
  });

  describe('Binary Availability', () => {
    it('should have required binaries for current platform', () => {
      const poppler = new PdfPoppler();

      expect(poppler.getPath()).toBeDefined();
      expect(typeof poppler.getPath()).toBe('string');
      expect(poppler.getPath().length).toBeGreaterThan(0);
      expect(poppler.getPath()).toContain('bin');

      if (originalPlatform === 'win32') {
        expect(poppler.getPath()).toContain('win');
      } else if (originalPlatform === 'linux') {
        expect(poppler.getPath()).toContain('linux');
      }
    });
  });

  describe('Version Selection', () => {
    afterEach(() => {
      delete process.env.POPPLER_VERSION;
      delete process.env.POPPLER_PREFER_XVFB;
      jest.resetModules();
    });

    it('should export version information', () => {
      const poppler = new PdfPoppler();

      expect(typeof poppler.getVersion).toBe('function');
      expect(typeof poppler.getAvailableVersions).toBe('function');

      if (originalPlatform === 'linux' || originalPlatform === 'win32') {
        expect(poppler.getVersion()).toBeDefined();
      }
    });

    it('should return versions array on supported platforms', () => {
      const poppler = new PdfPoppler();
      const versions = poppler.getAvailableVersions();

      expect(Array.isArray(versions)).toBe(true);

      if (originalPlatform === 'darwin') {
        expect(versions.length).toBe(0);
      } else {
        versions.forEach((v) => {
          expect(typeof v.version).toBe('string');
          expect(typeof v.hasXvfb).toBe('boolean');
          expect(typeof v.path).toBe('string');
        });
      }
    });
  });

  describe('Factory Methods', () => {
    it('should create instance with forLambda()', () => {
      const poppler = PdfPoppler.forLambda();

      expect(poppler).toBeInstanceOf(PdfPoppler);
      expect(poppler.isLambdaEnvironment()).toBe(true);
    });

    it('should create instance with forCI()', () => {
      const poppler = PdfPoppler.forCI();

      expect(poppler).toBeInstanceOf(PdfPoppler);
      expect(poppler.getConfig().isCI).toBe(true);
    });

    it('should create instance with autoDetect()', () => {
      const poppler = PdfPoppler.autoDetect();

      expect(poppler).toBeInstanceOf(PdfPoppler);
      expect(poppler.getPath()).toBeDefined();
    });
  });

  describe('Builder Pattern', () => {
    it('should create instance with builder pattern', () => {
      const config = PdfPoppler.configure()
        .withOsBinary()
        .withPreferXvfb(false)
        .build();

      const poppler = new PdfPoppler(config);

      expect(poppler).toBeInstanceOf(PdfPoppler);
      expect(poppler.getPath()).toBeDefined();
    });

    it('should create instance with fromConfig()', () => {
      const builder = PdfPoppler.configure()
        .withMaxBuffer(10 * 1024 * 1024);

      const poppler = PdfPoppler.fromConfig(builder);

      expect(poppler).toBeInstanceOf(PdfPoppler);
      expect(poppler.getExecOptions().maxBuffer).toBe(10 * 1024 * 1024);
    });
  });

  describe('Configuration', () => {
    it('should return resolved config', () => {
      const poppler = new PdfPoppler();
      const config = poppler.getConfig();

      expect(config).toBeDefined();
      expect(typeof config.platform).toBe('string');
      expect(typeof config.isLambda).toBe('boolean');
      expect(typeof config.isCI).toBe('boolean');
      expect(typeof config.preferXvfb).toBe('boolean');
    });

    it('should respect explicit config over defaults', () => {
      const poppler = new PdfPoppler({
        isLambda: true,
        preferXvfb: false
      });

      expect(poppler.isLambdaEnvironment()).toBe(true);
      expect(poppler.getConfig().preferXvfb).toBe(false);
    });
  });
});
