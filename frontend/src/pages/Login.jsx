import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";
import LoginArt from "./LoginArt.jsx";
import "./login.css";

const DEMOS = [
  { label: "Faculty", email: "faculty@example.edu" },
  { label: "Student (Dharun)", email: "23cs001@example.edu" },
  { label: "Low contributor (Meena)", email: "23cs005@example.edu" },
  { label: "No team yet (Naveen)", email: "23cs008@example.edu" },
];

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  );
}

function CheckBadge() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" className="valid-badge">
      <circle cx="10" cy="10" r="10" fill="#1f9d55" />
      <path d="M5.5 10.5l3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("faculty@example.edu");
  const [password, setPassword] = useState("password123");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const emailLooksValid = /^\S+@\S+\.\S+$/.test(email);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await login(email, password, remember);
      navigate(user.role === "faculty" ? "/faculty" : "/student");
    } catch (err) {
      setError(err.response?.data?.error || "Sign in failed. Check that the backend is running.");
      setBusy(false);
    }
  }

  function fillDemo(demoEmail) {
    setEmail(demoEmail);
    setPassword("password123");
    setError("");
  }

  return (
    <div className="login-page">
      <div className="blob blob-a" aria-hidden="true" />
      <div className="blob blob-b" aria-hidden="true" />

      <div className="login-shell">
        <Link to="/" className="login-brand">
          <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="#3b8cf5" />
            <path d="M7 19l5-6 4 4 5-8" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Team Contribution Monitor</span>
        </Link>

        <div className="login-art-wrap">
          <LoginArt />
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <h1>Welcome back</h1>
          <p className="login-sub">
            Sign in to see contribution scores and the reasons behind them for your team project.
          </p>

          <div className="field-group">
            <div className="field-row">
              <span className="field-icon"><MailIcon /></span>
              <div className="field-body">
                <label htmlFor="login-email">Email address</label>
                <input
                  id="login-email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              {emailLooksValid && <CheckBadge />}
            </div>
            <div className="field-row">
              <span className="field-icon"><LockIcon /></span>
              <div className="field-body">
                <label htmlFor="login-password">Password</label>
                <input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          <label className="remember">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Remember me on this device
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <div className="login-actions">
            <button type="submit" className="pill primary" disabled={busy}>
              {busy ? "Signing in" : "Sign in"}
            </button>
            <Link to="/" className="pill ghost">
              Back to overview
            </Link>
          </div>

          <div className="demo-block">
            <p>Or try a demo account (password123)</p>
            <div className="demo-chips" role="group" aria-label="Demo accounts">
              {DEMOS.map((d) => (
                <button type="button" key={d.email} onClick={() => fillDemo(d.email)}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <p className="login-legal">
            <Link to="/terms">Terms of Service</Link>
            <Link to="/privacy">Privacy Policy</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
