import { Room } from "./Room.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동되는 문자(0,O,1,I) 제외

export class RoomManager {
  private rooms = new Map<string, Room>();
  private userRoom = new Map<string, string>(); // userId -> roomCode

  private generateCode(): string {
    let code: string;
    do {
      code = Array.from(
        { length: 6 },
        () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
      ).join("");
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostUserId: string, hostUsername: string, hostChips: number): Room {
    const code = this.generateCode();
    const room = new Room(code, hostUserId);
    room.addPlayer(hostUserId, hostUsername, hostChips);
    this.rooms.set(code, room);
    this.userRoom.set(hostUserId, code);
    this.attachCleanup(room);
    return room;
  }

  joinRoom(
    code: string,
    userId: string,
    username: string,
    chips: number
  ): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new Error("존재하지 않는 방 코드입니다.");
    room.addPlayer(userId, username, chips);
    this.userRoom.set(userId, room.code);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase());
  }

  getRoomForUser(userId: string): Room | undefined {
    const code = this.userRoom.get(userId);
    return code ? this.rooms.get(code) : undefined;
  }

  leaveRoom(userId: string) {
    const room = this.getRoomForUser(userId);
    if (!room) return;
    room.removePlayer(userId); // 방이 비면 attachCleanup의 "state" 리스너가 정리한다
    this.userRoom.delete(userId);
  }

  markDisconnected(userId: string) {
    const room = this.getRoomForUser(userId);
    room?.markDisconnected(userId);
  }

  private attachCleanup(room: Room) {
    room.on("state", () => {
      if (room.players.size === 0) {
        room.destroy();
        this.rooms.delete(room.code);
      }
    });
  }
}

export const roomManager = new RoomManager();
