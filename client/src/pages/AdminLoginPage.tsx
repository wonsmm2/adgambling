import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { adminLogin, saveAdminToken } from "../api/admin";

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const token = await adminLogin(password);
      saveAdminToken(token);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-card">
      <h1>관리자 로그인</h1>
      <form onSubmit={onSubmit}>
        {error && <div className="auth-error">{error}</div>}
        <input
          type="password"
          placeholder="관리자 비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          autoFocus
          required
        />
        <button type="submit" disabled={submitting}>
          로그인
        </button>
      </form>
    </div>
  );
}
