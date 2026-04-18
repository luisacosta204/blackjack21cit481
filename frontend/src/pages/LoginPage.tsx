import React, { useState } from "react";
import { Link } from "react-router-dom";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

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
              Welcome back
            </h2>
            <p className="login-subtitle">
              Sign in to your Blackjack 21 account to continue.
            </p>

            <form className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email or username</label>
                <input
                  id="email"
                  name="email"
                  type="text"
                  placeholder="you@casino.com"
                  autoComplete="username"
                />
              </div>

              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="password-wrap">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁"}
                  </button>
                </div>
              </div>

              <div className="login-row">
                <label className="checkbox-wrap">
                  <input type="checkbox" name="remember" />
                  <span>Remember me</span>
                </label>

                <Link to="/register" className="text-link">
                  Create one
                </Link>
              </div>

              <button type="submit" className="btn btn-primary">
                Sign In
              </button>

              <button type="button" className="btn btn-secondary">
                Continue as Guest
              </button>
            </form>

            <p className="login-footer">
              No account?{" "}
              <Link to="/register" className="text-link">
                Create one
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}