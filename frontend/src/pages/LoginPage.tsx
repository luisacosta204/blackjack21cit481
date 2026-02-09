import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

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

      {/* Login form side */}
      <section className="panel" aria-label="Login form">
        <h2 className="panel-header">Welcome back</h2>
        <p className="panel-subtle">
          Sign in to your Blackjack 21 account to continue.
        </p>

        {error && (
          <div className="error" role="alert" aria-live="polite">
            {error}
          </div>
        )}

        <form
          className="form"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);

            const identifier = (
              document.getElementById("email") as HTMLInputElement
            )?.value.trim();

            const password = (
              document.getElementById("password") as HTMLInputElement
            )?.value;

            if (!identifier || !password) {
              setError("Please fill out all fields.");
              return;
            }

            try {
              const res = await fetch("http://localhost:3000/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ identifier, password }),
              });

              const data = await res.json();

              if (!res.ok || !data?.ok) {
                setError(data?.error ?? "Login failed.");
                return;
              }

              localStorage.setItem("token", data.token);
              navigate("/home");
            } catch {
              setError("Could not reach server. Is it running on port 3000?");
            }
          }}
        >
          <div className="field">
            <label htmlFor="email">Email or username</label>
            <div className="input-wrap">
              <input
                id="email"
                name="email"
                type="text"
                inputMode="email"
                autoComplete="username"
                placeholder="you@casino.com"
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <div className="input-wrap">
              <input
                id="password"
                name="password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
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
                👁️
              </button>
            </div>
          </div>

          <div className="cluster" style={{ justifyContent: "space-between" }}>
            <label className="checkbox">
              <input type="checkbox" id="remember" name="remember" />
              <span>Remember me</span>
            </label>
            <a className="mutelink" href="/forgot-password">
              Forgot password?
            </a>
          </div>

          <button className="btn" type="submit">
            Sign In
          </button>

          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate("/home")}
          >
            Continue as Guest
          </button>

          <footer className="mt-4">
            No account?{" "}
            {/* We'll convert this to a Router Link when you create RegisterPage */}
            <a className="mutelink" href="/register">
              Create one
            </a>
          </footer>
        </form>
      </section>
    </main>
  );
}
