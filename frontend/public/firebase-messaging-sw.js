/* Firebase Cloud Messaging service worker — handles web push while the tab is
 * closed or backgrounded. Served at the site root (public/ → /firebase-messaging-sw.js)
 * so its scope covers the whole app; that path is where the SDK looks by default.
 *
 * A service worker can't import ES modules, so it loads the Firebase "compat"
 * builds via importScripts and hardcodes the config (keep in sync with
 * src/features/auth/firebaseConfig.js).
 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyDphpDaRfEPouJYcvHF8sh5QLh-Gt21P3A",
  authDomain: "future-ai-b05ad.firebaseapp.com",
  projectId: "future-ai-b05ad",
  storageBucket: "future-ai-b05ad.firebasestorage.app",
  messagingSenderId: "897985872810",
  appId: "1:897985872810:web:4855f2853a4636fe9aa1d3",
  measurementId: "G-RXYJL7N99L",
});

const messaging = firebase.messaging();

// Background messages: render a native notification. (Foreground messages are
// handled in-page by onMessage in webPush.js so we don't double-notify.)
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || "Astrology AI", {
    body: body || "",
    icon: "/icon.svg",
    data: payload.data || {},
  });
});

// Focus or open the app when the user taps the notification.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const screen = event.notification?.data?.screen;
  const url = screen ? `/${screen}` : "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
