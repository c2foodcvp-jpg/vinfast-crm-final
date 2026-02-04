import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const templatePath = path.join(rootDir, 'public', 'firebase-messaging-sw.template.js');
const outputPath = path.join(rootDir, 'public', 'firebase-messaging-sw.js');

// Check if template exists
if (!fs.existsSync(templatePath)) {
    console.error('❌ Template file not found:', templatePath);
    process.exit(1);
}

// Read template
let content = fs.readFileSync(templatePath, 'utf8');

// Replace placeholders
const placeholders = {
    'YOUR_API_KEY': process.env.VITE_FIREBASE_API_KEY,
    'YOUR_AUTH_DOMAIN': process.env.VITE_FIREBASE_AUTH_DOMAIN,
    'YOUR_PROJECT_ID': process.env.VITE_FIREBASE_PROJECT_ID,
    'YOUR_STORAGE_BUCKET': process.env.VITE_FIREBASE_STORAGE_BUCKET,
    'YOUR_MESSAGING_SENDER_ID': process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    'YOUR_APP_ID': process.env.VITE_FIREBASE_APP_ID
};

let missingKeys = [];

for (const [placeholder, value] of Object.entries(placeholders)) {
    if (!value) {
        missingKeys.push(placeholder);
    }
    // Use a global replace for the placeholder
    const regex = new RegExp(placeholder, 'g');
    content = content.replace(regex, value || '');
}

if (missingKeys.length > 0) {
    console.warn('⚠️ Warning: The following environment variables are missing:', missingKeys.join(', '));
    console.warn('   Service Worker generation might be incomplete.');
}

// Write generated file
fs.writeFileSync(outputPath, content);

console.log('✅ Generated public/firebase-messaging-sw.js from template.');
