// Firebase Admin SDK — verifies ID tokens issued by Firebase Phone Auth
// on the web/mobile clients. The actual phone+OTP exchange happens on the
// client; we only ever see the resulting ID token and trade it for our JWT.

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { logger } from './logger.js';
import { env } from './envConfig.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serviceAccountPath = join(__dirname, 'firebase-admin.json');

let initialized = false;

function loadServiceAccount() {
  // Prefer env var (base64-encoded JSON) — works in serverless / managed hosts
  // where committing the key file is unsafe. Fall back to local file for dev.
  const b64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  if (b64) {
    return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) return JSON.parse(raw);
  if (existsSync(serviceAccountPath)) {
    return JSON.parse(readFileSync(serviceAccountPath, 'utf8'));
  }
  throw new Error(
    'No Firebase credentials found. Set FIREBASE_SERVICE_ACCOUNT_B64 ' +
    '(base64 JSON) or place firebase-admin.json in src/config/'
  );
}

export function initFirebase() {
  if (initialized) return admin;
  try {
    const serviceAccount = loadServiceAccount();
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    logger.info('Firebase Admin initialised');
  } catch (err) {
    // L1: in production, missing/invalid Firebase credentials mean ALL auth is
    // broken — fail fast instead of silently serving an app where no one can log
    // in. In dev we still warn-and-continue so the server boots without creds.
    if (env.NODE_ENV === 'production') {
      logger.error({ err }, 'Firebase Admin failed to initialize — refusing to boot');
      throw err;
    }
    logger.warn({ err }, 'Firebase Admin not initialized — auth will not work');
    return null;
  }
  return admin;
}

export function verifyIdToken(idToken) {
  if (!initialized) initFirebase();
  return admin.auth().verifyIdToken(idToken);
}

// FCM messaging handle. Throws a clear error rather than a vague null-deref when
// credentials are missing, so the cron route can surface "push not configured".
export function getMessaging() {
  if (!initialized) initFirebase();
  if (!initialized) throw new Error('Firebase not initialised — set FIREBASE_SERVICE_ACCOUNT_B64');
  return admin.messaging();
}
