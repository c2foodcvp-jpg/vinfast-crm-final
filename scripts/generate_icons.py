import os
import base64

def create_icons():
    # Base64 for a simple blue PNG (1x1 pixel) - scaling it up effectively
    # Ideally we'd use PIL but we can't guarantee it's installed.
    # This is a 1x1 blue pixel.
    blue_pixel = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0dIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01\x01\x00\x18\xdd\x8d\xb0\x00\x00\x00\x00IEND\xaeB`\x82'
    
    # Try using PIL if available for better icons
    try:
        from PIL import Image, ImageDraw, ImageFont
        print("PIL available, creating distinct icons...")
        
        # 512x512
        img = Image.new('RGB', (512, 512), color='#2462bd')
        # We can't easily draw nice text without fonts, so just a simple box
        draw = ImageDraw.Draw(img)
        # Draw a white V shape manually
        # V points: (100, 150), (256, 450), (412, 150)
        draw.line([(100, 150), (256, 450), (412, 150)], fill='white', width=40)
        
        img.save('public/pwa-512x512.png')
        img.resize((192, 192)).save('public/pwa-192x192.png')
        print("Real icons generated.")
        return
    except ImportError:
        print("PIL not found. Using fallback 1x1 pixel icons.")
        pass

    # Fallback
    with open('public/pwa-512x512.png', 'wb') as f:
        f.write(blue_pixel)
    with open('public/pwa-192x192.png', 'wb') as f:
        f.write(blue_pixel)

if __name__ == '__main__':
    # Ensure public dir exists
    if not os.path.exists('public'):
        os.makedirs('public')
    create_icons()
