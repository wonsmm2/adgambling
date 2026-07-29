import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

interface LocationState {
  from?: { pathname: string };
}

export default function LoginPage() {
  const { doLogin, authNotice, clearAuthNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await doLogin(username, password);
      const from = (location.state as LocationState | null)?.from?.pathname ?? "/";
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>온라인 섯다</h1>
      <form onSubmit={onSubmit}>
        {authNotice && <div className="auth-notice">{authNotice}</div>}
        {error && <div className="auth-error">{error}</div>}
        <input
          placeholder="아이디"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onFocus={clearAuthNotice}
          autoComplete="username"
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        <button type="submit" disabled={submitting}>
          로그인
        </button>
      </form>
      <p className="auth-hint">계정은 관리자가 발급합니다. 아이디/비밀번호를 모르면 관리자에게 문의하세요.</p>
    </div>
  );
}
