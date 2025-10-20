import { useState } from "react";
import "./Login.css";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simple authentication - you can customize these credentials
    // In production, this should connect to a real backend API
    const validUsername = import.meta.env.VITE_AUTH_USERNAME || "admin";
    const validPassword = import.meta.env.VITE_AUTH_PASSWORD || "pompeii2025";

    setTimeout(() => {
      if (username === validUsername && password === validPassword) {
        // Store authentication in sessionStorage
        sessionStorage.setItem("isAuthenticated", "true");
        onLogin();
      } else {
        setError("Invalid username or password");
        setIsLoading(false);
      }
    }, 500);
  };

  return (
    <div className="login-container">
      <div className="login-background">
        <div className="login-overlay"></div>
      </div>

      <div className="login-card">
        <div className="login-header">
          <h1>🏛️ Pompeii Food and Drink Research</h1>
          <p className="login-subtitle">Archaeological Survey Data Archive</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username"
              required
              autoFocus
              disabled={isLoading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              required
              disabled={isLoading}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="login-footer">
          <p>Access restricted to authorized researchers</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
