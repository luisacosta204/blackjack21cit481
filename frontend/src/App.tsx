import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./components/AppLayout";

import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";
import BlackjackPage from "./pages/BlackjackPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import ProfilePage from "./pages/ProfilePage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />

      {/* Everything except login uses the shared layout + footer */}
      <Route element={<AppLayout />}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/blackjack" element={<BlackjackPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
