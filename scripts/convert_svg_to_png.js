import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, '../public');
const svgPath = path.join(publicDir, 'app-icon.svg');

async function convertIcons() {
    console.log('🔄 Đang chuyển đổi Icon Vector (SVG) sang PNG chất lượng cao cho iOS...');

    if (!fs.existsSync(svgPath)) {
        console.error('❌ Không tìm thấy file app-icon.svg!');
        return;
    }

    try {
        // Tạo apple-touch-icon (180x180) cho iOS
        await sharp(svgPath)
            .resize(180, 180)
            .png()
            .toFile(path.join(publicDir, 'apple-touch-icon.png'));
        console.log('✅ Đã tạo: apple-touch-icon.png (180x180)');

        // Tạo PWA icon 192x192
        await sharp(svgPath)
            .resize(192, 192)
            .png()
            .toFile(path.join(publicDir, 'pwa-192x192.png'));
        console.log('✅ Đã tạo: pwa-192x192.png');

        // Tạo PWA icon 512x512
        await sharp(svgPath)
            .resize(512, 512)
            .png()
            .toFile(path.join(publicDir, 'pwa-512x512.png'));
        console.log('✅ Đã tạo: pwa-512x512.png');

        console.log('🎉 Hoàn tất! Icon của bạn giờ đã chuẩn HD trên mọi thiết bị.');

    } catch (error) {
        console.error('❌ Lỗi khi convert ảnh:', error);
    }
}

convertIcons();
