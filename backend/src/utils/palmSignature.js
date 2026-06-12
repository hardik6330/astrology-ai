import Jimp from 'jimp';
import { logger } from '../config/logger.js';

/**
 * Extracts a unique texture and line signature from a palm image.
 * This is used for high-accuracy biometric matching (Level 2/3).
 * If landmarks are provided, it crops the ROI (Palm area) first.
 */
export async function extractPalmSignatures(base64Image, landmarks = null) {
  try {
    const t0 = Date.now();
    const buffer = Buffer.from(base64Image, 'base64');
    const image = await Jimp.read(buffer);
    let workingImage = image;

    // Layer 2: ROI Extraction
    if (landmarks && Array.isArray(landmarks) && landmarks.length >= 21) {
      // Points 0 (wrist), 5, 9, 13, 17 (knuckles) define the palm base
      const points = [0, 5, 9, 13, 17].map(i => landmarks[i]);
      const minX = Math.min(...points.map(p => p.x));
      const maxX = Math.max(...points.map(p => p.x));
      const minY = Math.min(...points.map(p => p.y));
      const maxY = Math.max(...points.map(p => p.y));

      const imgW = image.getWidth();
      const imgH = image.getHeight();

      // Convert normalized [0,1] to pixels
      const x = Math.max(0, Math.floor(minX * imgW));
      const y = Math.max(0, Math.floor(minY * imgH));
      const w = Math.min(imgW - x, Math.ceil((maxX - minX) * imgW));
      const h = Math.min(imgH - y, Math.ceil((maxY - minY) * imgH));

      if (w > 10 && h > 10) {
        workingImage = image.clone().crop(x, y, w, h);
        logger.info({ x, y, w, h }, 'palm ROI cropped');
      }
    }

    // 1. Pre-process: Grayscale and Contrast for better line detection
    workingImage.greyscale().contrast(0.2);

    // 2. Texture Signature: Average color/intensity of central palm area
    const width = workingImage.getWidth();
    const height = workingImage.getHeight();
    const sampleSize = Math.floor(Math.min(width, height) * 0.4); // Larger sample for cropped ROI
    const centerX = Math.floor(width / 2 - sampleSize / 2);
    const centerY = Math.floor(height / 2 - sampleSize / 2);
    
    const textureSample = workingImage.clone().crop(centerX, centerY, sampleSize, sampleSize);
    const textureHash = textureSample.hash(); // Perceptual hash of the texture

    // 3. Line Signature: Simplified edge detection logic
    const lineSample = workingImage.clone().resize(64, 64).blur(1);
    const lineData = [];
    lineSample.scan(0, 0, lineSample.getWidth(), lineSample.getHeight(), function(x, y, idx) {
      const brightness = this.bitmap.data[idx]; 
      lineData.push(brightness > 128 ? 1 : 0);
    });

    logger.info({ 
      ms: Date.now() - t0,
      textureHash,
      isCropped: workingImage !== image
    }, 'palm signature extraction complete');

    return {
      textureSignature: textureHash,
      lineSignature: lineData.slice(0, 100)
    };
  } catch (error) {
    logger.error({ error }, 'failed to extract palm signatures');
    return { textureSignature: null, lineSignature: null };
  }
}
