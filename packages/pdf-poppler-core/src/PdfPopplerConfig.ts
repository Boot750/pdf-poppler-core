import { PdfPopplerConfig, Platform } from './types';

/**
 * Builder class for PdfPoppler configuration
 *
 * @example
 * ```typescript
 * const config = PdfPoppler.configure()
 *   .withOsBinary()
 *   .withPreferXvfb(false)
 *   .withVersion('24.02')
 *   .build();
 * ```
 */
export class PdfPopplerConfigBuilder {
  private config: Partial<PdfPopplerConfig> = {};

  /**
   * Use OS-detected binaries (auto-detects platform).
   * This clears any explicit binary path or package settings.
   */
  withOsBinary(): this {
    delete this.config.binaryPath;
    delete this.config.binaryPackage;
    return this;
  }

  /**
   * Set explicit path to poppler bin directory
   */
  withBinaryPath(binaryPath: string): this {
    this.config.binaryPath = binaryPath;
    delete this.config.binaryPackage; // Path takes precedence
    return this;
  }

  /**
   * Use a custom npm package for binaries
   */
  withBinaryPackage(packageName: string): this {
    this.config.binaryPackage = packageName;
    delete this.config.binaryPath; // Package setting clears explicit path
    return this;
  }

  /**
   * Set xvfb preference for headless environments
   * @param prefer - Whether to prefer xvfb variant (default: true)
   */
  withPreferXvfb(prefer: boolean = true): this {
    this.config.preferXvfb = prefer;
    return this;
  }

  /**
   * Set specific poppler version
   * @param version - Version string (e.g., "24.02", "0.26")
   */
  withVersion(version: string): this {
    this.config.version = version;
    return this;
  }

  /**
   * Override platform detection
   */
  withPlatform(platform: Platform): this {
    this.config.platform = platform;
    return this;
  }

  /**
   * Mark this instance as running in Lambda
   * @param isLambda - Whether running in Lambda (default: true)
   */
  withLambda(isLambda: boolean = true): this {
    this.config.isLambda = isLambda;
    return this;
  }

  /**
   * Mark this instance as running in CI
   * @param isCI - Whether running in CI (default: true)
   */
  withCI(isCI: boolean = true): this {
    this.config.isCI = isCI;
    return this;
  }

  /**
   * Set custom environment variables for exec
   */
  withEnv(env: NodeJS.ProcessEnv): this {
    this.config.execOptions = {
      ...this.config.execOptions,
      env: { ...this.config.execOptions?.env, ...env },
    };
    return this;
  }

  /**
   * Set max buffer size for exec
   * @param bytes - Max buffer size in bytes
   */
  withMaxBuffer(bytes: number): this {
    this.config.execOptions = {
      ...this.config.execOptions,
      maxBuffer: bytes,
    };
    return this;
  }

  /**
   * Set timeout for exec operations
   * @param ms - Timeout in milliseconds
   */
  withTimeout(ms: number): this {
    this.config.execOptions = {
      ...this.config.execOptions,
      timeout: ms,
    };
    return this;
  }

  /**
   * Set custom exec options
   */
  withExecOptions(options: PdfPopplerConfig['execOptions']): this {
    this.config.execOptions = { ...this.config.execOptions, ...options };
    return this;
  }

  /**
   * Build the final config object
   */
  build(): PdfPopplerConfig {
    return { ...this.config };
  }
}

/**
 * Create a new configuration builder
 *
 * @example
 * ```typescript
 * import { configure } from 'pdf-poppler-core';
 *
 * const config = configure()
 *   .withOsBinary()
 *   .withPreferXvfb(false)
 *   .build();
 * ```
 */
export function configure(): PdfPopplerConfigBuilder {
  return new PdfPopplerConfigBuilder();
}
