import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";
import { updateCredits } from "../api/credits";


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
        // Login flow
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

        // Sync localStorage bank to database credits
        const bankValue = loadBank();
        updateCredits(bankValue).catch((err) => {
          console.error("Failed to sync credits on login", err)
        })
        navigate("/home");
      } else {
        // Register flow
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

        // Auto-login after successful registration
        localStorage.setItem("token", data.token);

        // Sync localStorage bank to database credits
        const bankValue = loadBank();
        updateCredits(bankValue).catch((err) => {
          console.error("Failed to sync credits on registration:", err)
        })
        navigate("/home");
      }
    } catch {
      setError("Could not reach server. Is it running on port 3000?");
      setBusy(false);
    }
  }

  return (
    <main className="login-shell" aria-labelledby="page-title">
      {/* Brand / Visual side */}
      <section className="brand-panel" aria-label="Blackjack 21 branding">
        <div className="brand-grid" aria-hidden="true"></div>

        <div className="logo" role="img" aria-label="Blackjack 21 logo">
          <div className="chip">21</div>
          <div>
            <h1 id="page-title" className="logo-title">
              Blackjack 21
            </h1>
            <div className="logo-sub">Play smart. Hit the table.</div>
          </div>
        </div>

        <div className="card-fan animate-float" aria-hidden="true">
          <div className="card is-1">
            <div className="corner">
              <span className="pip">A♠</span>
            </div>
            <div className="center">♠</div>
            <div className="bottom">
              <span className="pip">A♠</span>
            </div>
          </div>

          <div className="card is-2">
            <div className="corner">
              <span className="pip red">K♥</span>
            </div>
            <div className="center">♥</div>
            <div className="bottom">
              <span className="pip red">K♥</span>
            </div>
          </div>

          <div className="card is-3">
            <div className="corner">
              <span className="pip">J♣</span>
            </div>
            <div className="center">♣</div>
            <div className="bottom">
              <span className="pip">J♣</span>
            </div>
          </div>
        </div>
      </section>

      {/* Login/Register form side */}
      <section className="panel" aria-label="Login form">
        <h2 className="panel-header">
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <p className="panel-subtle">
          {mode === "login"
            ? "Sign in to your Blackjack 21 account to continue."
            : "Create your Blackjack 21 account."}
        </p>

        {error && (
          <div className="error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form className="form" noValidate onSubmit={handleSubmit}>
          {mode === "login" ? (
            <>
              {/* Login Mode Fields */}
              <div className="field">
                <label htmlFor="identifier">Email or username</label>
                <div className="input-wrap">
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
              </div>
            </>
          ) : (
            <>
              {/* Register Mode Fields */}
              <div className="field">
                <label htmlFor="username">Username</label>
                <div className="input-wrap">
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
              </div>

              <div className="field">
                <label htmlFor="email">Email</label>
                <div className="input-wrap">
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
              </div>
            </>
          )}

          {/* Password field (both modes) */}
          <div className="field">
            <label htmlFor="password">
              Password
              {mode === "register" && (
                <span className="muted" style={{ fontSize: "0.85em", marginLeft: 8 }}>
                  (8+ characters)
                </span>
              )}
            </label>
            <div className="input-wrap">
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={8}
                placeholder="••••••••"
                required
                aria-required="true"
              />
              <button
                className="icon"
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                title={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((v) => !v)}
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Confirm Password (register mode only) */}
          {mode === "register" && (
            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="input-wrap">
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
                  className="icon"
                  type="button"
                  aria-label={showConfirmPw ? "Hide password" : "Show password"}
                  title={showConfirmPw ? "Hide password" : "Show password"}
                  onClick={() => setShowConfirmPw((v) => !v)}
                >
                  {showConfirmPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
          )}

          {/* Remember me / Mode toggle */}
          <div className="cluster" style={{ justifyContent: "space-between" }}>
            {mode === "login" ? (
              <label className="checkbox">
                <input type="checkbox" id="remember" name="remember" />
                <span>Remember me</span>
              </label>
            ) : (
              <div></div>
            )}

            <a
              className="mutelink"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setMode((m) => (m === "login" ? "register" : "login"));
                setError(null);
              }}
            >
              {mode === "login" ? "Create one" : "Have an account? Log in"}
            </a>
          </div>

          {/* Submit button */}
          <button className="btn" type="submit" disabled={busy}>
            {busy
              ? mode === "login"
                ? "Signing in…"
                : "Creating account…"
              : mode === "login"
              ? "Sign In"
              : "Create Account"}
          </button>

          {/* Guest button */}
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate("/home")}
          >
            Continue as Guest
          </button>

          {/* Footer text (login mode only) */}
          {mode === "login" && (
            <footer className="mt-4">
              No account?{" "}
              <a
                className="mutelink"
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setMode("register");
                  setError(null);
                }}
              >
                Create one
              </a>
            </footer>
          )}
        </form>
      </section>
    </main>
  );
}