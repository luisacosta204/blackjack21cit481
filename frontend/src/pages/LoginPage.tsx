import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { updateCredits } from "../api/credits";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const BANK_KEY = "bjBank";
  const START_BANK = 500;

  function loadBank(): number {
    const stored = localStorage.getItem(BANK_KEY);
    return stored ? parseInt(stored, 10) : START_BANK;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    try {
      if (mode === "login") {
        const identifier = formData.get("identifier")?.toString().trim();
        const password = formData.get("password")?.toString();

        if (!identifier || !password) {
          setError("Please fill out all fields.");
          setBusy(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ identifier, password }),
        });

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          setError(data?.error ?? "Login failed.");
          setBusy(false);
          return;
        }

        localStorage.setItem("token", data.token);

        const bankValue = loadBank();
        updateCredits(bankValue).catch((err) => {
          console.error("Failed to sync credits on login", err);
        });

        navigate("/home");
      } else {
        const username = formData.get("username")?.toString().trim();
        const email = formData.get("email")?.toString().trim();
        const password = formData.get("password")?.toString();
        const confirmPassword = formData.get("confirmPassword")?.toString();

        if (!username || !email || !password || !confirmPassword) {
          setError("Please fill out all fields.");
          setBusy(false);
          return;
        }

        if (password.length < 8) {
          setError("Password must be at least 8 characters.");
          setBusy(false);
          return;
        }

        if (password !== confirmPassword) {
          setError("Passwords do not match.");
          setBusy(false);
          return;
        }

        const res = await fetch(`${API_BASE_URL}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, email, password }),
        });

        const data = await res.json();

        if (!res.ok || !data?.ok) {
          setError(data?.error ?? "Registration failed.");
          setBusy(false);
          return;
        }

        localStorage.setItem("token", data.token);

        const bankValue = loadBank();
        updateCredits(bankValue).catch((err) => {
          console.error("Failed to sync credits on registration:", err);
        });

        navigate("/home");
      }
    } catch {
      setError("Could not reach server. Is it running on port 3000?");
      setBusy(false);
    }
  }

  return (
    <main className="login-page" aria-labelledby="page-title">
      <div className="login-shell">
        <section className="login-hero" aria-hidden="true">
          <div className="login-brand">
            <div className="login-brand-badge">21</div>
            <div>
              <h1 className="login-brand-title">Blackjack 21</h1>
              <p className="login-brand-subtitle">Play smart. Hit the table.</p>
            </div>
          </div>

          <div className="card-fan animate-float">
            <img
              className="card-img is-1"
              src="/assets/decks/style_1/Ace of Spades.png"
              alt=""
            />
            <img
              className="card-img is-2"
              src="/assets/decks/style_1/King of Hearts.png"
              alt=""
            />
            <img
              className="card-img is-3"
              src="/assets/decks/style_1/Jack of Clubs.png"
              alt=""
            />
          </div>
        </section>

        <section className="login-panel" aria-labelledby="page-title">
          <div className="login-card">
            <h2 id="page-title" className="login-title">
              {mode === "login" ? "Welcome back" : "Create account"}
            </h2>

            <p className="login-subtitle">
              {mode === "login"
                ? "Sign in to your Blackjack 21 account to continue."
                : "Create your Blackjack 21 account."}
            </p>

            {error && (
              <div className="login-error" role="alert" aria-live="polite">
                {error}
              </div>
            )}

            <form className="login-form" noValidate onSubmit={handleSubmit}>
              {mode === "login" ? (
                <div className="form-group">
                  <label htmlFor="identifier">Email or username</label>
                  <input
                    id="identifier"
                    name="identifier"
                    type="text"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="you@casino.com"
                    required
                    aria-required="true"
                  />
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                      id="username"
                      name="username"
                      type="text"
                      autoComplete="username"
                      placeholder="playerOne"
                      required
                      aria-required="true"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@casino.com"
                      required
                      aria-required="true"
                    />
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="password">
                  Password
                  {mode === "register" && (
                    <span className="field-hint"> (8+ characters)</span>
                  )}
                </label>

                <div className="password-wrap">
                  <input
                    id="password"
                    name="password"
                    type={showPw ? "text" : "password"}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={8}
                    placeholder="••••••••"
                    required
                    aria-required="true"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    aria-label={showPw ? "Hide password" : "Show password"}
                    title={showPw ? "Hide password" : "Show password"}
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>

              {mode === "register" && (
                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm Password</label>
                  <div className="password-wrap">
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPw ? "text" : "password"}
                      autoComplete="new-password"
                      minLength={8}
                      placeholder="••••••••"
                      required
                      aria-required="true"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      aria-label={
                        showConfirmPw ? "Hide password" : "Show password"
                      }
                      title={showConfirmPw ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirmPw((v) => !v)}
                    >
                      {showConfirmPw ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              )}

              <div className="login-row">
                {mode === "login" ? (
                  <label className="checkbox-wrap">
                    <input type="checkbox" id="remember" name="remember" />
                    <span>Remember me</span>
                  </label>
                ) : (
                  <div />
                )}

                <button
                  type="button"
                  className="text-link text-button"
                  onClick={() => {
                    setMode((m) => (m === "login" ? "register" : "login"));
                    setError(null);
                  }}
                >
                  {mode === "login" ? "Create one" : "Have an account? Log in"}
                </button>
              </div>

              <button className="btn btn-primary" type="submit" disabled={busy}>
                {busy
                  ? mode === "login"
                    ? "Signing in..."
                    : "Creating account..."
                  : mode === "login"
                  ? "Sign In"
                  : "Create Account"}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate("/home")}
              >
                Continue as Guest
              </button>
            </form>

            {mode === "login" && (
              <p className="login-footer">
                No account?{" "}
                <button
                  type="button"
                  className="text-link text-button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                >
                  Create one
                </button>
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}