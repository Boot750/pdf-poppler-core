import * as path from 'path';
import * as fs from 'fs';
import { Platform, VersionInfo, ResolvedConfig } from '../types';

/**
 * Resolves the path to poppler binaries based on configuration
 */
export class BinaryResolver {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  /**
   * Resolve the binary path based on configuration priority:
   * 1. Explicit binaryPath
   * 2. Custom binaryPackage
   * 3. Platform-specific default package
   */
  resolve(): string {
    // Priority 1: Explicit binary path
    if (this.config.binaryPath) {
      return this.resolveCustomPath(this.config.binaryPath);
    }

    // Priority 2: Custom binary package
    if (this.config.binaryPackage) {
      return this.resolvePackage(this.config.binaryPackage);
    }

    // Priority 3: Platform-specific package
    return this.resolvePlatformDefault();
  }

  /**
   * Discover all available poppler versions
   */
  discoverVersions(basePath?: string): VersionInfo[] {
    try {
      const searchPath = basePath || this.getBasePath();
      if (!searchPath) return [];
      return this.scanVersions(searchPath);
    } catch {
      return [];
    }
  }

  /**
   * Resolve a custom binary path
   */
  private resolveCustomPath(customPath: string): string {
    const resolved = path.resolve(customPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Custom binary path not found: ${resolved}`);
    }
    return this.handleAsar(resolved);
  }

  /**
   * Resolve binary path from a custom npm package
   */
  private resolvePackage(packageName: string): string {
    try {
      const pkg = require(packageName);
      if (typeof pkg.getBinaryPath === 'function') {
        return this.handleAsar(pkg.getBinaryPath());
      }
      // Package doesn't export getBinaryPath, use package directory
      const packageDir = path.dirname(require.resolve(packageName));
      return this.handleAsar(packageDir);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Failed to load binary package '${packageName}': ${errorMessage}`
      );
    }
  }

  /**
   * Resolve platform-specific default binary package
   */
  private resolvePlatformDefault(): string {
    const platform = this.config.platform;

    // Package candidates by platform (fonts package first for Linux)
    const packageMap: Record<Platform, string[]> = {
      linux: ['pdf-poppler-binaries-linux-fonts', 'pdf-poppler-binaries-aws-2', 'pdf-poppler-binaries-linux'],
      win32: ['pdf-poppler-binaries-win32'],
      darwin: ['pdf-poppler-binaries-darwin'],
    };

    const packages = packageMap[platform];
    if (!packages) {
      throw new Error(
        `Unsupported platform: ${platform}. ` +
          `Set binaryPath or binaryPackage to use custom binaries.`
      );
    }

    // Try each package in order
    for (const pkgName of packages) {
      try {
        const pkg = require(pkgName);
        if (typeof pkg.getBinaryPath !== 'function') {
          continue;
        }
        const basePath = pkg.getBinaryPath();
        return this.selectVersion(basePath);
      } catch {
        continue;
      }
    }

    throw new Error(
      `No binary package found for platform: ${platform}. ` +
        `Install one of: ${packages.join(', ')}`
    );
  }

  /**
   * Select the appropriate version folder from a base path
   */
  private selectVersion(basePath: string): string {
    const versions = this.scanVersions(basePath);
    const preferXvfb = this.config.preferXvfb;
    const requestedVersion = this.config.version;

    // If specific version requested, find it
    if (requestedVersion) {
      // Prefer matching xvfb preference
      const exactMatch = versions.find(
        (v) => v.version === requestedVersion && v.hasXvfb === preferXvfb
      );
      if (exactMatch) {
        return this.handleAsar(path.join(exactMatch.path, 'bin'));
      }

      // Accept any variant of the requested version
      const anyMatch = versions.find((v) => v.version === requestedVersion);
      if (anyMatch) {
        return this.handleAsar(path.join(anyMatch.path, 'bin'));
      }

      const availableVersions = [...new Set(versions.map((v) => v.version))];
      throw new Error(
        `Requested poppler version ${requestedVersion} not found. ` +
          `Available: ${availableVersions.length > 0 ? availableVersions.join(', ') : 'none'}`
      );
    }

    // Auto-select: prefer matching xvfb preference, highest version
    for (const v of versions) {
      if (v.hasXvfb === preferXvfb) {
        return this.handleAsar(path.join(v.path, 'bin'));
      }
    }

    // Fallback to any available version
    if (versions.length > 0) {
      return this.handleAsar(path.join(versions[0].path, 'bin'));
    }

    // Legacy fallback for old folder structures
    return this.legacyFallback(basePath);
  }

  /**
   * Legacy fallback for old folder structures (poppler-latest, poppler-xvfb-latest)
   */
  private legacyFallback(basePath: string): string {
    const preferXvfb = this.config.preferXvfb;
    const isWindows = this.config.platform === 'win32';
    const binaryName = isWindows ? 'pdftocairo.exe' : 'pdftocairo';

    const candidates = preferXvfb
      ? ['poppler-xvfb-latest', 'poppler-latest', 'poppler-0.51']
      : ['poppler-latest', 'poppler-xvfb-latest', 'poppler-0.51', 'poppler-0.66'];

    for (const folder of candidates) {
      const binPath = path.join(basePath, folder, 'bin', binaryName);
      if (fs.existsSync(binPath)) {
        return this.handleAsar(path.join(basePath, folder, 'bin'));
      }
    }

    // Last resort: return base path and hope for the best
    return this.handleAsar(basePath);
  }

  /**
   * Scan a directory for versioned poppler folders
   */
  private scanVersions(basePath: string): VersionInfo[] {
    const versions: VersionInfo[] = [];
    const isWindows = this.config.platform === 'win32';
    const binaryName = isWindows ? 'pdftocairo.exe' : 'pdftocairo';

    try {
      const entries = fs.readdirSync(basePath);

      for (const entry of entries) {
        // Match versioned folders: poppler-X.XX or poppler-X.XX-xvfb
        const match = entry.match(/^poppler-(\d+\.\d+)(-xvfb)?$/);
        if (match) {
          const versionPath = path.join(basePath, entry);
          const binPath = path.join(versionPath, 'bin', binaryName);

          if (fs.existsSync(binPath)) {
            versions.push({
              version: match[1],
              hasXvfb: match[2] === '-xvfb',
              path: versionPath,
            });
          }
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    // Sort by version descending (highest first)
    return versions.sort((a, b) => {
      const [aMajor, aMinor] = a.version.split('.').map(Number);
      const [bMajor, bMinor] = b.version.split('.').map(Number);
      return bMajor - aMajor || bMinor - aMinor;
    });
  }

  /**
   * Get the base path for version scanning
   */
  private getBasePath(): string | null {
    if (this.config.binaryPath) {
      // If binaryPath points to bin folder, go up one level
      const parentDir = path.dirname(this.config.binaryPath);
      if (this.config.binaryPath.endsWith('bin')) {
        return path.dirname(parentDir);
      }
      return parentDir;
    }

    // Try to load platform package
    const platform = this.config.platform;
    const packages: Record<Platform, string> = {
      linux: 'pdf-poppler-binaries-linux',
      win32: 'pdf-poppler-binaries-win32',
      darwin: 'pdf-poppler-binaries-darwin',
    };

    try {
      const pkg = require(packages[platform]);
      if (typeof pkg.getBinaryPath === 'function') {
        return pkg.getBinaryPath();
      }
    } catch {
      // Package not installed
    }

    return null;
  }

  /**
   * Handle Electron ASAR paths
   */
  private handleAsar(p: string): string {
    return p.replace('.asar', '.asar.unpacked');
  }

  /**
   * Get fontconfig environment variables if using fonts package
   */
  getFontconfigEnv(): Record<string, string> | null {
    try {
      const pkg = require('pdf-poppler-binaries-linux-fonts');
      if (typeof pkg.getFontconfigEnv === 'function') {
        return pkg.getFontconfigEnv();
      }
    } catch {
      // Fonts package not installed
    }
    return null;
  }
}
