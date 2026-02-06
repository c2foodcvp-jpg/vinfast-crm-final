
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');

// Read package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Parse version (MAJOR.MINOR.PATCH)
let [major, minor, patch] = packageJson.version.split('.').map(Number);

// Increment logic: "tăng lên 0.1" implies incrementing minor version.
// e.g., 1.0.0 -> 1.1.0
minor += 1;
patch = 0;

const newVersion = `${major}.${minor}.${patch}`;

packageJson.version = newVersion;

// Write back to package.json
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

console.log(`🚀 Bumped version to ${newVersion}`);
