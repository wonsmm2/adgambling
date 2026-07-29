import { io, type Socket } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:4000";

let socket: Socket | null = null;
let socketToken: string | null = null;

export function connectSocket(token: string): Socket {
  // 같은 토큰으로 짧은 시간 안에 다시 호출되면(예: StrictMode의 effect 이중 실행) 기존
  // 연결을 그대로 재사용한다. 매번 새로 연결하면 서버의 "다른 세션 로그인" 감지 로직이
  // 스스로를 걷어차는 상태가 될 수 있다.
  if (socket && socketToken === token) {
    return socket;
  }
  if (socket) {
    socket.disconnect();
  }
  socketToken = token;
  socket = io(SERVER_URL, {
    auth: { token },
    autoConnect: true,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  socketToken = null;
}
