const { PdfPoppler } = require('pdf-poppler-core');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const path = require('path');
const fs = require('fs');

function randomString() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function fillForm(inputPath, outputPath, useExplicitFont = false) {
  const pdfBytes = fs.readFileSync(inputPath);
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  // Optionally embed a standard font
  let font = null;
  if (useExplicitFont) {
    font = await doc.embedFont(StandardFonts.Helvetica);
    console.log('Using explicit Helvetica font for appearances');
  }

  // Get all text fields
  const fields = form.getFields();
  const textFields = fields.filter(f => f.constructor.name === 'PDFTextField');

  console.log(`Found ${textFields.length} text fields`);

  // Fill first 3 text fields with random values
  let filled = 0;
  for (const field of textFields) {
    if (filled >= 3) break;
    const name = field.getName();
    const value = `random ${randomString()}`;
    try {
      const textField = form.getTextField(name);
      textField.setText(value);
      if (font) {
        textField.updateAppearances(font);
      }
      console.log(`  Set "${name}" = "${value}"`);
      filled++;
    } catch (err) {
      console.log(`  Skipped "${name}": ${err.message}`);
    }
  }

  // Explicitly update all field appearances
  if (!font) {
    form.updateFieldAppearances();
    console.log('Called form.updateFieldAppearances()');
  }

  const savedBytes = await doc.save();
  fs.writeFileSync(outputPath, savedBytes);
  console.log(`Saved filled form to: ${outputPath}`);
}

// Fill form and return bytes directly (no disk save)
async function fillFormToBuffer(inputPath) {
  const pdfBytes = fs.readFileSync(inputPath);
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  // Get all text fields
  const fields = form.getFields();
  const textFields = fields.filter(f => f.constructor.name === 'PDFTextField');

  console.log(`Found ${textFields.length} text fields`);

  // Fill first 3 text fields with random values
  let filled = 0;
  for (const field of textFields) {
    if (filled >= 3) break;
    const name = field.getName();
    const value = `random ${randomString()}`;
    try {
      form.getTextField(name).setText(value);
      console.log(`  Set "${name}" = "${value}"`);
      filled++;
    } catch (err) {
      console.log(`  Skipped "${name}": ${err.message}`);
    }
  }

  const savedBytes = await doc.save();
  console.log(`Got ${savedBytes.length} bytes from pdf-lib (not saved to disk)`);
  return savedBytes;
}

async function fillSampleForm(inputPath, outputPath, useExplicitFont = false) {
  const pdfBytes = fs.readFileSync(inputPath);
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  // Optionally embed a standard font
  let font = null;
  if (useExplicitFont) {
    font = await doc.embedFont(StandardFonts.Helvetica);
    console.log('Using explicit Helvetica font for appearances');
  }

  // Fill specific fields
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

  // Explicitly update all field appearances
  if (!font) {
    form.updateFieldAppearances();
    console.log('Called form.updateFieldAppearances()');
  }

  const savedBytes = await doc.save();
  fs.writeFileSync(outputPath, savedBytes);
  console.log(`Saved filled form to: ${outputPath}`);
}

async function main() {
  const poppler = new PdfPoppler({ preferXvfb: false });

  console.log('Poppler path:', poppler.getPath());
  console.log('');

  const inputPdf = '/app/sample_form.pdf';
  const filledPdf = '/app/output/filled_form.pdf';
  const outputDir = '/app/output';

  // Step 0: Fill the form with random values (default behavior)
  console.log('=== Step 0: Fill form with pdf-lib (default) ===');
  try {
    await fillSampleForm(inputPdf, filledPdf, false);
  } catch (err) {
    console.error('Error filling form:', err.message);
    return;
  }

  // Step 0b: Fill with explicit font
  const filledPdfWithFont = '/app/output/filled_form_with_font.pdf';
  console.log('');
  console.log('=== Step 0b: Fill form with explicit Helvetica font ===');
  try {
    await fillSampleForm(inputPdf, filledPdfWithFont, true);
  } catch (err) {
    console.error('Error filling form with font:', err.message);
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
  }

  console.log('');

  // Test 2b: Convert the font-embedded version
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
  }

  console.log('');
  console.log('=== Output files ===');
  const files = fs.readdirSync(outputDir);
  files.forEach(f => {
    const stats = fs.statSync(path.join(outputDir, f));
    console.log(`${f}: ${stats.size} bytes`);
  });

  console.log('');
  console.log('Compare the PNG files:');
  console.log('  direct-1.png           - Default pdf-lib, no flatten');
  console.log('  flattened-1.png        - Default pdf-lib + updateFieldAppearances(), with flatten');
  console.log('  flattened-font-1.png   - Explicit Helvetica font, with flatten');
  console.log('');
  console.log('If flattened-font-1.png shows values but others dont, the issue is font embedding.');
}

main().catch(console.error);
