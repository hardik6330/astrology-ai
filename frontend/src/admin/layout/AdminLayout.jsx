// Shared chrome for every back-office page: composes Sidebar + Header + Footer
// around the active page, which renders into <Outlet>. Each piece owns its own
// markup + styles; this file is just the frame.

import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";
import Footer from "./Footer";

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen text-body">
      {/* Animated cosmic backdrop — same as the rest of the app (index.css).
          These are position:fixed, so they sit behind the chrome. */}
      <div className="cosmos" />
      <div className="stars" />
      <div className="shooting-star" />

      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
}
