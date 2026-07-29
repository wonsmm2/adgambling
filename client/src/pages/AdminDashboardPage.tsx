import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  clearAdminToken,
  createUser,
  deleteUser,
  fetchUsers,
  resetPassword,
  updateUserChips,
  type AdminUser,
} from "../api/admin";

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chipDrafts, setChipDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newChips, setNewChips] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchUsers();
      setUsers(list);
      setChipDrafts(Object.fromEntries(list.map((u) => [u.id, String(u.chips)])));
    } catch (err) {
      if (err instanceof Error && err.message.includes("관리자 인증")) {
        clearAdminToken();
        navigate("/admin/login", { replace: true });
        return;
      }
      setError(err instanceof Error ? err.message : "회원 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onCreateUser(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const chips = newChips.trim() === "" ? undefined : Number(newChips);
      const user = await createUser(newUsername.trim(), newPassword, chips);
      setUsers((prev) => [...prev, user]);
      setChipDrafts((prev) => ({ ...prev, [user.id]: String(user.chips) }));
      setNewUsername("");
      setNewPassword("");
      setNewChips("");
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "회원 추가에 실패했습니다.");
    } finally {
      setCreating(false);
    }
  }

  async function onSaveChips(id: string) {
    const raw = chipDrafts[id];
    const chips = Number(raw);
    if (!Number.isInteger(chips) || chips < 0) {
      setError("칩은 0 이상의 정수여야 합니다.");
      return;
    }
    setSavingId(id);
    setError(null);
    try {
      const updated = await updateUserChips(id, chips);
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "칩 수정에 실패했습니다.");
    } finally {
      setSavingId(null);
    }
  }

  async function onDeleteUser(u: AdminUser) {
    if (!window.confirm(`정말 "${u.username}" 회원을 삭제할까요? 되돌릴 수 없습니다.`)) return;
    setDeletingId(u.id);
    setError(null);
    try {
      await deleteUser(u.id);
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
      setChipDrafts((prev) => {
        const next = { ...prev };
        delete next[u.id];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "회원 삭제에 실패했습니다.");
    } finally {
      setDeletingId(null);
    }
  }

  async function onResetPassword(u: AdminUser) {
    const newPw = window.prompt(`"${u.username}"의 새 비밀번호를 입력하세요 (4자 이상):`);
    if (newPw === null) return; // 취소
    if (newPw.length < 4) {
      setError("비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    setResettingId(u.id);
    setError(null);
    try {
      await resetPassword(u.id, newPw);
      window.alert(`"${u.username}"의 비밀번호가 초기화되었습니다.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "비밀번호 초기화에 실패했습니다.");
    } finally {
      setResettingId(null);
    }
  }

  function logout() {
    clearAdminToken();
    navigate("/admin/login", { replace: true });
  }

  return (
    <div className="admin-page">
      <div className="admin-topbar">
        <h1>관리자 페이지</h1>
        <span className="logout-link" onClick={logout}>
          로그아웃
        </span>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <section className="admin-card">
        <h2>회원 추가</h2>
        <form className="admin-add-form" onSubmit={onCreateUser}>
          {createError && <div className="auth-error">{createError}</div>}
          <input
            placeholder="아이디"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="비밀번호"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <input
            type="number"
            placeholder="시작 칩 (기본 10,000)"
            value={newChips}
            onChange={(e) => setNewChips(e.target.value)}
            min={0}
          />
          <button type="submit" disabled={creating}>
            추가
          </button>
        </form>
      </section>

      <section className="admin-card">
        <h2>회원 목록</h2>
        {loading ? (
          <p>불러오는 중...</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>아이디</th>
                <th>칩</th>
                <th>가입일</th>
                <th></th>
                <th></th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.username}</td>
                  <td>
                    <input
                      type="number"
                      className="admin-chip-input"
                      value={chipDrafts[u.id] ?? ""}
                      onChange={(e) =>
                        setChipDrafts((prev) => ({ ...prev, [u.id]: e.target.value }))
                      }
                      min={0}
                    />
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString("ko-KR")}</td>
                  <td>
                    <button
                      className="admin-save-btn"
                      disabled={savingId === u.id || chipDrafts[u.id] === String(u.chips)}
                      onClick={() => onSaveChips(u.id)}
                    >
                      저장
                    </button>
                  </td>
                  <td>
                    <button
                      className="admin-reset-btn"
                      disabled={resettingId === u.id}
                      onClick={() => onResetPassword(u)}
                    >
                      비밀번호 초기화
                    </button>
                  </td>
                  <td>
                    <button
                      className="admin-delete-btn"
                      disabled={deletingId === u.id}
                      onClick={() => onDeleteUser(u)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
