/**
 * Simple integration test script to verify that CSV files are properly
 * classified as documents by our file type detection system.
 */
import fs from 'fs';
import path from 'path';
import { determineContentType } from '../server/utils/file-type-settings';

// Create a test CSV file in memory (not written to disk)
const csvContent = 'id,name,email\n1,John Doe,john@example.com\n2,Jane Smith,jane@example.com';
const csvFilename = 'test.csv';
const csvMimeType = 'text/csv';

// Determine the content type using our function
const contentType = determineContentType(
  path.extname(csvFilename).slice(1).toLowerCase(),
  csvMimeType
);

// Check if it's classified correctly
if (contentType === 'document') {
  console.log('✅ Success: CSV files are correctly classified as "document" type');
} else {
  console.error(`❌ Error: CSV files are incorrectly classified as "${contentType}" type`);
  process.exit(1);
}

// Additional test for case-insensitivity
const upperCaseContentType = determineContentType('CSV', 'TEXT/CSV');
if (upperCaseContentType === 'document') {
  console.log('✅ Success: Case-insensitive detection works for CSV files');
} else {
  console.error(`❌ Error: Case-insensitive detection failed for CSV files: "${upperCaseContentType}"`);
  process.exit(1);
}

console.log('All tests passed successfully!');