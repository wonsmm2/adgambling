import type { Server, Socket } from "socket.io";
import { roomManager } from "../game/RoomManager.js";
import type { Room } from "../game/Room.js";
import { prisma } from "../prismaClient.js";
import { evaluateBase } from "../game/handRank.js";
import type { BetActionType, Card, ErrorPayload } from "../types.js";

function dealtPayload(cards: Card[]) {
  const rankLabel = cards.length === 2 ? evaluateBase(cards as [Card, Card]).label : undefined;
  return { cards, rankLabel };
}

// 계정당 세션은 하나만 허용한다. 새 소켓이 연결되면 기존 소켓은 종료된다.
const userSockets = new Map<string, Socket>();
const broadcastingRooms = new WeakSet<Room>();

function emitToUser(userId: string, event: string, payload: unknown) {
  userSockets.get(userId)?.emit(event, payload);
}

function attachRoomBroadcast(io: Server, room: Room) {
  if (broadcastingRooms.has(room)) return;
  broadcastingRooms.add(room);

  room.on("state", (payload) => {
    io.to(room.code).emit("room:state", payload);
  });

  room.on("dealt", (dealt: Map<string, Card[]>) => {
    for (const [userId, cards] of dealt) {
      emitToUser(userId, "game:dealt", dealtPayload(cards));
    }
  });

  room.on("result", (payload) => {
    io.to(room.code).emit("game:result", payload);
  });

  room.on("error", (payload: { targetUserId: string; message: string }) => {
    const errorPayload: ErrorPayload = { message: payload.message };
    emitToUser(payload.targetUserId, "error", errorPayload);
  });

  room.on("notice", (payload: { message: string }) => {
    io.to(room.code).emit("game:notice", payload);
  });
}

export function registerSocketHandlers(io: Server) {
  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;
    const username = socket.data.username as string;

    const previousSocket = userSockets.get(userId);
    userSockets.set(userId, socket);
    if (previousSocket && previousSocket.id !== socket.id) {
      previousSocket.emit("session:kicked", {
        message: "다른 브라우저에서 로그인되어 연결이 종료되었습니다.",
      });
      previousSocket.disconnect(true);
    }

    const existingRoom = roomManager.getRoomForUser(userId);
    if (existingRoom) {
      socket.join(existingRoom.code);
      existingRoom.addPlayer(userId, username, 0); // 재접속: 기존 좌석/칩 유지
      attachRoomBroadcast(io, existingRoom);
      socket.emit("room:state", existingRoom.toStatePayload());
      const cards = existingRoom.getPlayerCards(userId);
      if (cards) socket.emit("game:dealt", dealtPayload(cards));
    }

    socket.on("room:create", async () => {
      try {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const room = roomManager.createRoom(userId, username, user.chips);
        attachRoomBroadcast(io, room);
        socket.join(room.code);
        socket.emit("room:state", room.toStatePayload());
      } catch {
        socket.emit("error", { message: "방을 생성할 수 없습니다." } satisfies ErrorPayload);
      }
    });

    socket.on("room:join", async (data: { code?: string }) => {
      const code = data?.code?.trim();
      if (!code) {
        socket.emit("error", { message: "방 코드를 입력해주세요." } satisfies ErrorPayload);
        return;
      }
      try {
        const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
        const room = roomManager.joinRoom(code, userId, username, user.chips);
        attachRoomBroadcast(io, room);
        socket.join(room.code);
        io.to(room.code).emit("room:state", room.toStatePayload());
      } catch (err) {
        socket.emit("error", {
          message: err instanceof Error ? err.message : "입장할 수 없습니다.",
        } satisfies ErrorPayload);
      }
    });

    socket.on("room:leave", () => {
      const room = roomManager.getRoomForUser(userId);
      if (room) socket.leave(room.code);
      roomManager.leaveRoom(userId);
    });

    socket.on("game:ready", (data: { ready?: boolean }) => {
      const room = roomManager.getRoomForUser(userId);
      room?.setReady(userId, Boolean(data?.ready));
    });

    socket.on("game:action", (data: { type?: BetActionType }) => {
      if (!data?.type) return;
      const room = roomManager.getRoomForUser(userId);
      room?.handleAction(userId, data.type);
    });

    socket.on("disconnect", () => {
      // 새 세션에 의해 이미 대체된 소켓이면(userSockets가 다른 소켓을 가리키면) 아무것도 하지 않는다.
      if (userSockets.get(userId) === socket) {
        userSockets.delete(userId);
        roomManager.markDisconnected(userId);
      }
    });
  });
}
