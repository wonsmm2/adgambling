export interface Card {
  month: number; // 1-10
  isBright: boolean;
}

export type BetActionType = "ping" | "half" | "call" | "die" | "check";

export type RoomStatus =
  | "WAITING"
  | "DEALING"
  | "BETTING"
  | "SHOWDOWN"
  | "RESULT";

export interface PlayerPublic {
  userId: string;
  username: string;
  chips: number;
  seat: number;
  connected: boolean;
  ready: boolean;
  folded: boolean;
  inHand: boolean;
  currentBet: number;
  hasCards: boolean;
}

export interface RoomStatePayload {
  code: string;
  status: RoomStatus;
  players: PlayerPublic[];
  pot: number;
  currentBet: number;
  bettingRound: 1 | 2;
  dealerUserId: string | null;
  turnUserId: string | null;
  turnDeadline: number | null;
  hostUserId: string;
  handNumber: number;
}

export interface HandResultEntry {
  userId: string;
  username: string;
  cards: Card[];
  rankLabel: string;
  isWinner: boolean;
  amountWon: number;
}

export interface GameResultPayload {
  pot: number;
  results: HandResultEntry[];
  nextHandInMs: number;
}

export interface ErrorPayload {
  message: string;
}
