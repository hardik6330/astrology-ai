// Firebase Admin SDK — verifies ID tokens issued by Firebase Phone Auth
// on the web/mobile clients. The actual phone+OTP exchange happens on the
// client; we only ever see the resulting ID token and trade it for our JWT.

import admin from 'firebase-admin';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'firebase-admin.json');

let initialized = false;

export function initFirebase() {
  if (initialized) return admin;
  try {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    logger.info('Firebase Admin initialised');
  } catch (err) {
    logger.fatal({ err }, 'Failed to init Firebase Admin — auth will not work');
    throw err;
  }
  return admin;
}

export function verifyIdToken(idToken) {
  if (!initialized) initFirebase();
  return admin.auth().verifyIdToken(idToken);
}
