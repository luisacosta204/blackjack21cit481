import { Outlet } from "react-router-dom";

export default function AppLayout() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Pages render their header + main inside Outlet */}
      <div style={{ flex: 1 }}>
        <Outlet />
      </div>

      <footer className="footer container" style={{ textAlign: "center", padding: "24px 0" }}>
        <p>© 2025 Blackjack 21. All rights reserved.</p>
      </footer>
    </div>
  );
}
