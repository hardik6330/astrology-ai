// Phone mockup with a real, scannable QR on screen (rendered inline as SVG, so
// no external request — CSP-safe). The QR encodes APP_LINK.
//
// Default-exported so LandingPage can lazy() it — this is the ONLY consumer of
// `qrcode.react`, so code-splitting it here keeps that lib out of the eager
// landing bundle (the QR is far down the page, loaded on scroll).
import { QRCodeSVG } from "qrcode.react";
import { AppStoreIcon, GooglePlayIcon } from "@/common/StoreIcons";
import Logo from "@/common/Logo";
import { APP_LINK } from "./data";

export default function PhoneMock() {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="absolute -inset-8 -z-10 rounded-[3rem] blur-2xl"
        style={{ background: "radial-gradient(circle, rgba(139,92,246,0.45), transparent 70%)" }}
      />
      <div
        className="relative w-[232px] rounded-[2.6rem] border border-white/15 bg-[#0b0b16] p-3"
        style={{ boxShadow: "0 30px 80px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)" }}
      >
        <div className="absolute left-1/2 top-3 z-10 h-5 w-24 -translate-x-1/2 rounded-full bg-black/80" />
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#12121f] to-[#0a0a14] px-5 pb-7 pt-11 text-center">
          <div className="flex items-center justify-center gap-1.5 text-sm font-extrabold">
            <Logo size={24} /> <span className="font-display">Selora</span>
          </div>
          <p className="mt-1 text-[11px] text-dim">Scan to download</p>
          <div
            className="mx-auto mt-4 w-fit rounded-2xl bg-white p-3"
            style={{ boxShadow: "0 0 30px rgba(139,92,246,0.35)" }}
          >
            <QRCodeSVG value={APP_LINK} size={140} bgColor="#ffffff" fgColor="#0b0b16" level="M" />
          </div>
          <p className="mt-4 text-[11px] leading-snug text-subtle">
            Point your camera at the code to get the app on iOS or Android.
          </p>
          <div className="mt-4 flex items-center justify-center gap-3 text-lg text-dim">
            <AppStoreIcon size={20} />
            <GooglePlayIcon size={18} />
          </div>
        </div>
      </div>
    </div>
  );
}
