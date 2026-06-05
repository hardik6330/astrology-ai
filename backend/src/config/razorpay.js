// Razorpay client + config. Lazily instantiated so the app boots fine without
// keys (dev / dummy) — purchaseService checks isRazorpayEnabled() and falls back
// to the mock checkout when the gateway isn't configured.

import Razorpay from 'razorpay';
import { env } from './envConfig.js';

// Both keys must be present to consider the gateway live.
export function isRazorpayEnabled() {
  return Boolean(env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET);
}

// Public key id — safe to hand to the browser to open Checkout.
export const RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID || null;

let client = null;
export function razorpay() {
  if (!isRazorpayEnabled()) return null;
  if (!client) {
    client = new Razorpay({
      key_id: env.RAZORPAY_KEY_ID,
      key_secret: env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}
