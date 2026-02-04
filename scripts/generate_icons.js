const fs = require('fs');
const path = require('path');

// 1x1 Blue Pixel PNG
const bluePixelBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const buffer = Buffer.from(bluePixelBase64, 'base64');

const publicDir = path.join(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir);
}

// Write icons
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), buffer);
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), buffer);

// Also create apple-touch-icon if not present
if (!fs.existsSync(path.join(publicDir, 'apple-touch-icon.png'))) {
    fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), buffer);
}

console.log('Icons generated successfully (1x1 placeholders)');
