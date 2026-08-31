import { useState } from "react";
import { loginAdmin } from "../services/authService";

/**
 * @param {{ onSuccess: () => void }} props
 */
export default function AdminLogin({ onSuccess }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    if (loginAdmin(username, password)) {
      setError(null);
      onSuccess();
    } else {
      setError("Incorrect username or password.");
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login__form" onSubmit={handleSubmit}>
        <h1>Admin Login</h1>
        <p>Sign in to manage the vendor and color-mapping database.</p>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <div className="field">
          <label htmlFor="admin-username" className="field__label">
            Username
          </label>
          <input
            id="admin-username"
            className="field__control"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label htmlFor="admin-password" className="field__label">
            Password
          </label>
          <input
            id="admin-password"
            type="password"
            className="field__control"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button type="submit" className="btn btn--primary admin-login__submit">
          Log In
        </button>
      </form>
    </div>
  );
}
