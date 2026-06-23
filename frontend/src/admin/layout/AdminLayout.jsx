// Shared chrome for every back-office page: composes Sidebar + Header + Footer
// around the active page, which renders into <Outlet>. Each piece owns its own
// markup + styles; this file is just the frame.

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

export default function AdminLayout() {
  return (
    // Lock the frame to the viewport height so the sidebar (with its pinned
    // Profile/Logout) and the Footer stay put — only <main> scrolls on tall
    // pages. min-h-0 lets the flex children actually shrink so overflow works.
    <div className="full-screen flex overflow-hidden text-body">
      {/* full-screen (not h-screen): its height divides out the body `zoom`, so
          this fixed-height shell fills exactly one visible viewport instead of
          overflowing by the zoom factor. */}
      {/* Animated cosmic backdrop — same as the rest of the app (index.css).
          These are position:fixed, so they sit behind the chrome. */}
      <div className="cosmos" />
      <div className="stars" />
      <div className="shooting-star" />

      <Sidebar />
      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        <Header />
        <main className="min-h-0 flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
