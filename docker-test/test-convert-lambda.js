const { PdfPoppler } = require('pdf-poppler-core');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

function randomString() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function fillSampleForm(inputPath, outputPath, useExplicitFont = false, flattenWithPdfLib = false) {
  const pdfBytes = fs.readFileSync(inputPath);
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  let font = null;
  if (useExplicitFont) {
    font = await doc.embedFont(StandardFonts.Helvetica);
    console.log('Using explicit Helvetica font for appearances');
  }

  const randomName = `User ${randomString()}`;
  const currentDateTime = new Date().toISOString();

  try {
    const nameField = form.getTextField('name');
    nameField.setText(randomName);
    if (font) nameField.updateAppearances(font);
    console.log(`  Set "name" = "${randomName}"`);
  } catch (err) {
    console.log(`  Error setting "name": ${err.message}`);
  }

  try {
    const dateField = form.getTextField('currentDateTime');
    dateField.setText(currentDateTime);
    if (font) dateField.updateAppearances(font);
    console.log(`  Set "currentDateTime" = "${currentDateTime}"`);
  } catch (err) {
    console.log(`  Error setting "currentDateTime": ${err.message}`);
  }

  if (!font) {
    form.updateFieldAppearances();
    console.log('Called form.updateFieldAppearances()');
  }

  // Flatten with pdf-lib (bakes form values into PDF content)
  if (flattenWithPdfLib) {
    form.flatten();
    console.log('Called form.flatten() - form fields baked into content');
  }

  const savedBytes = await doc.save();
  fs.writeFileSync(outputPath, savedBytes);
  console.log(`Saved filled form to: ${outputPath}`);
}

async function runCommand(cmd, args, env = {}) {
  const { execFile } = require('child_process');
  return new Promise((resolve, reject) => {
    execFile(cmd, args, {
      env: { ...process.env, ...env },
      maxBuffer: 5000 * 1024
    }, (error, stdout, stderr) => {
      if (error) {
        resolve({ error: error.message, stderr, stdout });
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

async function main() {
  console.log('=== Lambda Environment Simulation ===');
  console.log('');

  // Use Lambda configuration
  const poppler = PdfPoppler.forLambda();

  console.log('Poppler path:', poppler.getPath());
  console.log('Is Lambda:', poppler.isLambdaEnvironment());

  const execEnv = poppler.getExecOptions().env || {};
  console.log('LD_LIBRARY_PATH:', execEnv.LD_LIBRARY_PATH || 'not set');
  console.log('FONTCONFIG_PATH:', execEnv.FONTCONFIG_PATH || 'not set');
  console.log('FONTCONFIG_FILE:', execEnv.FONTCONFIG_FILE || 'not set');
  console.log('FC_CACHEDIR:', execEnv.FC_CACHEDIR || 'not set');
  console.log('');

  const inputPdf = '/var/task/sample_form.pdf';
  const filledPdf = '/var/task/output/filled_form.pdf';
  const outputDir = '/var/task/output';

  // Step 0: Fill the form
  console.log('=== Step 0: Fill form with pdf-lib (default) ===');
  try {
    await fillSampleForm(inputPdf, filledPdf, false);
  } catch (err) {
    console.error('Error filling form:', err.message);
    return;
  }

  // Step 0b: Fill with explicit font
  const filledPdfWithFont = path.join(outputDir, 'filled_form_with_font.pdf');
  console.log('');
  console.log('=== Step 0b: Fill form with explicit Helvetica font ===');
  try {
    await fillSampleForm(inputPdf, filledPdfWithFont, true, false);
  } catch (err) {
    console.error('Error filling form with font:', err.message);
  }

  // Step 0c: Fill AND flatten with pdf-lib (not pdftocairo)
  const filledPdfLibFlattened = path.join(outputDir, 'filled_pdflib_flattened.pdf');
  console.log('');
  console.log('=== Step 0c: Fill form AND flatten with pdf-lib ===');
  try {
    await fillSampleForm(inputPdf, filledPdfLibFlattened, true, true);
  } catch (err) {
    console.error('Error filling/flattening form:', err.message);
  }

  console.log('');

  // Test 1: Direct convert (without flatten)
  console.log('=== Test 1: Direct Convert (no flatten) ===');
  try {
    await poppler.convert(filledPdf, {
      format: 'png',
      out_dir: outputDir,
      out_prefix: 'direct',
      page: 1,
      scale: 1024
    });
    console.log('Created: direct-1.png');
    const stats = fs.statSync(path.join(outputDir, 'direct-1.png'));
    console.log('Size:', stats.size, 'bytes');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }

  console.log('');

  // Test 2: Flatten then convert
  console.log('=== Test 2: Flatten then Convert ===');
  try {
    const flattenedPdf = path.join(outputDir, 'flattened.pdf');
    await poppler.flatten(filledPdf, flattenedPdf);
    console.log('Flattened PDF created');

    await poppler.convert(flattenedPdf, {
      format: 'png',
      out_dir: outputDir,
      out_prefix: 'flattened',
      page: 1,
      scale: 1024
    });
    console.log('Created: flattened-1.png');
    const stats = fs.statSync(path.join(outputDir, 'flattened-1.png'));
    console.log('Size:', stats.size, 'bytes');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }

  console.log('');

  // Test 2b: Flatten with font version
  console.log('=== Test 2b: Flatten + Convert (with explicit font) ===');
  try {
    const flattenedPdfFont = path.join(outputDir, 'flattened-font.pdf');
    await poppler.flatten(filledPdfWithFont, flattenedPdfFont);
    console.log('Flattened PDF created');

    await poppler.convert(flattenedPdfFont, {
      format: 'png',
      out_dir: outputDir,
      out_prefix: 'flattened-font',
      page: 1,
      scale: 1024
    });
    console.log('Created: flattened-font-1.png');
    const stats = fs.statSync(path.join(outputDir, 'flattened-font-1.png'));
    console.log('Size:', stats.size, 'bytes');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }

  console.log('');

  // Test 3: Convert pdf-lib flattened PDF directly (no pdftocairo flatten)
  console.log('=== Test 3: Convert pdf-lib flattened PDF (KEY TEST) ===');
  try {
    await poppler.convert(filledPdfLibFlattened, {
      format: 'png',
      out_dir: outputDir,
      out_prefix: 'pdflib-flattened',
      page: 1,
      scale: 1024
    });
    console.log('Created: pdflib-flattened-1.png');
    const stats = fs.statSync(path.join(outputDir, 'pdflib-flattened-1.png'));
    console.log('Size:', stats.size, 'bytes');
  } catch (err) {
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
  }

  console.log('');

  // Debug: Check pdftocairo help for form-related options
  console.log('=== Debug: pdftocairo options ===');
  const popplerBin = poppler.getPath();
  const pdftocairo = path.join(popplerBin, 'pdftocairo');
  const libPath = popplerBin.replace(/\/bin$/, '/lib');

  const helpResult = await runCommand(pdftocairo, ['--help'], { LD_LIBRARY_PATH: libPath });
  if (helpResult.stdout) {
    // Look for form/annotation related options
    const lines = helpResult.stdout.split('\n');
    const relevantLines = lines.filter(l =>
      l.includes('print') || l.includes('annot') || l.includes('form') ||
      l.includes('appear') || l.includes('render') || l.includes('flatten')
    );
    console.log('Relevant options found:');
    relevantLines.forEach(l => console.log('  ' + l.trim()));
    if (relevantLines.length === 0) {
      console.log('  (none found)');
    }
  } else {
    console.log('Help output:', helpResult.stderr || helpResult.error);
  }

  console.log('');

  // Test: Try pdfinfo to see form field info
  console.log('=== Debug: pdfinfo on filled_form.pdf ===');
  const pdfinfo = path.join(popplerBin, 'pdfinfo');
  const infoResult = await runCommand(pdfinfo, [filledPdf], { LD_LIBRARY_PATH: libPath });
  console.log(infoResult.stdout || infoResult.stderr || infoResult.error);

  console.log('');
  console.log('=== Output files ===');
  const files = fs.readdirSync(outputDir);
  files.forEach(f => {
    const stats = fs.statSync(path.join(outputDir, f));
    console.log(`${f}: ${stats.size} bytes`);
  });

  console.log('');
  console.log('Compare the PNG files in docker-test/output/');
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  console.error('Stack:', err.stack);
  process.exit(1);
});
