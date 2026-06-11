import Jimp from 'jimp';
import { logger } from '../config/logger.js';

/**
 * Extracts a unique texture and line signature from a palm image.
 * This is used for high-accuracy biometric matching (Level 2/3).
 */
export async function extractPalmSignatures(base64Image) {
  try {
    const t0 = Date.now();
    const buffer = Buffer.from(base64Image, 'base64');
    const image = await Jimp.read(buffer);

    // 1. Pre-process: Grayscale and Contrast for better line detection
    image.greyscale().contrast(0.2);

    // 2. Texture Signature: Average color/intensity of central palm area
    // We take a sample from the center of the image
    const width = image.getWidth();
    const height = image.getHeight();
    const sampleSize = Math.floor(Math.min(width, height) * 0.2);
    const centerX = Math.floor(width / 2 - sampleSize / 2);
    const centerY = Math.floor(height / 2 - sampleSize / 2);
    
    const textureSample = image.clone().crop(centerX, centerY, sampleSize, sampleSize);
    const textureHash = textureSample.hash(); // Perceptual hash of the texture

    // 3. Line Signature: Simplified edge detection logic
    // We use a small blurred version to get the "main" lines flow
    const lineSample = image.clone().resize(64, 64).blur(1);
    const lineData = [];
    lineSample.scan(0, 0, lineSample.getWidth(), lineSample.getHeight(), function(x, y, idx) {
      // Get brightness
      const brightness = this.bitmap.data[idx]; 
      lineData.push(brightness > 128 ? 1 : 0); // Simplified binary map of lines
    });

    logger.info({ 
      ms: Date.now() - t0,
      textureHash 
    }, 'palm signature extraction complete');

    return {
      textureSignature: textureHash,
      lineSignature: lineData.slice(0, 100) // Store a subset as signature
    };
  } catch (error) {
    logger.error({ error }, 'failed to extract palm signatures');
    return { textureSignature: null, lineSignature: null };
  }
}
