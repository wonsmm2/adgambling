import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { getSocket } from "../socket";
import type { RoomStatePayload } from "../types";

export default function LobbyPage() {
  const { user, doLogout } = useAuth();
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onState = (payload: RoomStatePayload) => {
      setBusy(false);
      navigate(`/room/${payload.code}`);
    };
    const onError = (payload: { message: string }) => {
      setBusy(false);
      setError(payload.message);
    };

    socket.on("room:state", onState);
    socket.on("error", onError);
    return () => {
      socket.off("room:state", onState);
      socket.off("error", onError);
    };
  }, [navigate]);

  function createRoom() {
    const socket = getSocket();
    if (!socket) return;
    setError(null);
    setBusy(true);
    socket.emit("room:create");
  }

  function joinRoom() {
    const socket = getSocket();
    if (!socket || !joinCode.trim()) return;
    setError(null);
    setBusy(true);
    socket.emit("room:join", { code: joinCode.trim().toUpperCase() });
  }

  return (
    <div className="lobby">
      <h1>온라인 섯다</h1>
      <p>
        {user?.username}님, 보유 칩: <span className="chips">{user?.chips.toLocaleString()}</span>
      </p>

      {error && <div className="lobby-error">{error}</div>}

      <button disabled={busy} onClick={createRoom}>
        새 방 만들기
      </button>

      <div className="lobby-row">
        <input
          placeholder="방 코드 입력"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <button className="secondary" disabled={busy} onClick={joinRoom}>
          입장하기
        </button>
      </div>

      <div className="logout-link" onClick={doLogout}>
        로그아웃
      </div>
    </div>
  );
}
