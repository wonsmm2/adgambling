import type { Socket } from "socket.io";
import jwt from "jsonwebtoken";

export interface AuthedSocket extends Socket {
  data: {
    userId: string;
    username: string;
  };
}

export function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
) {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error("인증 토큰이 없습니다."));
  }
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return next(new Error("서버 설정 오류입니다."));
  }
  try {
    const payload = jwt.verify(token, secret) as {
      sub: string;
      username: string;
    };
    socket.data.userId = payload.sub;
    socket.data.username = payload.username;
    next();
  } catch {
    next(new Error("유효하지 않은 토큰입니다."));
  }
}
