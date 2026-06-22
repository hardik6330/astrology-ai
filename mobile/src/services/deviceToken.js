// In-memory cache of THIS device's FCM push token. Set by the push module after
// registration (and on rotation), read by the API layer so reading/palm request
// bodies can carry `deviceToken` — letting the backend target the "insight
// ready" push to the one device that asked, not every device on the account
// (see backend pushService.notifyInsightReady). Null in Expo Go or before
// registration; the backend simply skips the push then.
//
// Lives in its own module (not push.js) to avoid a circular import: push.js
// already imports from services/api, and the API layer needs to read this.

let currentToken = null;

export function setDeviceToken(token) {
  currentToken = token || null;
}

export function getDeviceToken() {
  return currentToken;
}
