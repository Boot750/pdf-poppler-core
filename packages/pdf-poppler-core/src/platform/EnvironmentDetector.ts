/**
 * Utility class for detecting runtime environments
 */
export class EnvironmentDetector {
  /**
   * Detect if running in AWS Lambda environment
   */
  isLambda(): boolean {
    return !!(
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.AWS_LAMBDA_RUNTIME_API ||
      process.env.LAMBDA_RUNTIME_DIR ||
      process.env._LAMBDA_SERVER_PORT
    );
  }

  /**
   * Detect if running in a CI environment
   */
  isCI(): boolean {
    return !!(
      process.env.CI === 'true' ||
      process.env.GITHUB_ACTIONS === 'true' ||
      process.env.TRAVIS ||
      process.env.CIRCLECI ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_URL ||
      process.env.BUILDKITE ||
      process.env.TF_BUILD // Azure DevOps
    );
  }

  /**
   * Detect if running in Electron
   */
  isElectron(): boolean {
    return !!(process.versions as Record<string, string>).electron;
  }

  /**
   * Detect if running in a Jest test environment
   */
  isJest(): boolean {
    return !!process.env.JEST_WORKER_ID;
  }

  /**
   * Detect if a virtual display is needed
   * (headless Linux environments without DISPLAY set)
   */
  needsVirtualDisplay(): boolean {
    return (
      !process.env.DISPLAY &&
      process.platform === 'linux' &&
      (this.isLambda() || this.isCI() || this.isJest())
    );
  }
}
