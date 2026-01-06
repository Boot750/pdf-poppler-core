/**
 * pdf-poppler - Legacy entry point
 *
 * This package has been refactored into modular packages:
 * - pdf-poppler-core: Core library (this wrapper)
 * - pdf-poppler-binaries-linux: Linux binaries
 * - pdf-poppler-binaries-win32: Windows binaries
 * - pdf-poppler-binaries-darwin: macOS binaries
 *
 * Please migrate to pdf-poppler-core for better modularity and smaller package sizes.
 *
 * Usage:
 *   npm install pdf-poppler-core
 *   const poppler = require('pdf-poppler-core');
 */

// Re-export everything from pdf-poppler-core
module.exports = require('pdf-poppler-core');
