import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthUser } from "./types";
import { clearToken, fetchMe, getToken, login, saveToken } from "./api/auth";
import { connectSocket, disconnectSocket } from "./socket";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  authNotice: string | null;
  clearAuthNotice: () => void;
  doLogin: (username: string, password: string) => Promise<void>;
  doLogout: () => void;
  setUser: (user: AuthUser | null) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  // 이 콜백들은 마운트 시 한 번만 만들어지는 클로저 안에서 쓰이므로, 최신 setUser를 ref로 참조한다.
  const setUserRef = useRef(setUser);
  setUserRef.current = setUser;

  const connectWithSession = useCallback((token: string) => {
    const socket = connectSocket(token);
    // connectSocket은 같은 토큰이면 기존 소켓을 재사용하므로, 리스너가 중복 등록되지 않도록 정리 후 다시 건다.
    socket.off("session:kicked").on("session:kicked", (payload: { message: string }) => {
      clearToken();
      disconnectSocket();
      setUserRef.current(null);
      setAuthNotice(payload.message);
    });
    return socket;
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe(token)
      .then((u) => {
        setUser(u);
        connectWithSession(token);
      })
      .catch(() => clearToken())
      .finally(() => setLoading(false));
  }, [connectWithSession]);

  const doLogin = useCallback(
    async (username: string, password: string) => {
      const { token, user } = await login(username, password);
      saveToken(token);
      setUser(user);
      setAuthNotice(null);
      connectWithSession(token);
    },
    [connectWithSession]
  );

  const doLogout = useCallback(() => {
    clearToken();
    disconnectSocket();
    setUser(null);
  }, []);

  const clearAuthNotice = useCallback(() => setAuthNotice(null), []);

  return (
    <AuthContext.Provider
      value={{ user, loading, authNotice, clearAuthNotice, doLogin, doLogout, setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
