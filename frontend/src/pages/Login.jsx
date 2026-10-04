import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("faculty@example.edu");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const user = await login(email, password);
      navigate(user.role === "faculty" ? "/faculty" : "/student");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  }

  return (
    <div className="centered-page">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Smart Team Contribution Monitoring</h1>
        <p className="subtitle">Continuous effort verification &amp; free-riding detection</p>

        <label>Email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />

        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit">Sign in</button>

        <div className="hint">
          Demo accounts (after running the seed script):
          <br />
          faculty@example.edu / password123
          <br />
          23cs001@example.edu ... 23cs004@example.edu / password123
        </div>

        <div className="hint">
          <Link to="/">Back to overview</Link> &nbsp; <Link to="/terms">Terms of Service</Link> &nbsp;{" "}
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </form>
    </div>
  );
}
