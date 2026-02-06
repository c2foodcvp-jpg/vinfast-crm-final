
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, '../package.json');
const versionFilePath = path.join(__dirname, '../public/version.json');

// Read version from package.json
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

const versionData = {
    version: packageJson.version,
    buildTime: new Date().getTime()
};

fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2));

console.log(`✅ Version file updated: ${versionFilePath} (Version: ${versionData.version}, Timestamp: ${versionData.buildTime})`);
