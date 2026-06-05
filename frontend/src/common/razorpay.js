// Loads the Razorpay Checkout script on demand and resolves once window.Razorpay
// is available. Cached so repeated buys don't re-inject the tag. The script is
// only fetched when a user actually starts a purchase — it never weighs down
// the initial app load.

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let promise = null;

export function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve(true);
  if (promise) return promise;

  promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SRC;
    script.onload = () => resolve(true);
    script.onerror = () => {
      promise = null; // allow a retry on the next attempt
      reject(new Error("Failed to load payment SDK. Check your connection."));
    };
    document.body.appendChild(script);
  });
  return promise;
}
