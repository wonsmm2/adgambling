import { EventEmitter } from "node:events";
import { CONFIG } from "../config.js";
import { buildDeck, shuffle } from "./deck.js";
import { TIER, compareEval, resolveShowdown, type FinalEval } from "./handRank.js";
import { prisma } from "../prismaClient.js";
import type {
  BetActionType,
  Card,
  GameResultPayload,
  HandResultEntry,
  PlayerPublic,
  RoomStatePayload,
  RoomStatus,
} from "../types.js";

interface InternalPlayer {
  userId: string;
  username: string;
  seat: number;
  connected: boolean;
  ready: boolean;
  chips: number;
  cards: Card[];
  folded: boolean;
  inHand: boolean;
  allIn: boolean;
  currentBet: number; // 이번 배팅 라운드에서 낸 금액 (라운드마다 0으로 초기화)
  totalBet: number; // 이번 핸드에서 지금까지 낸 총 배팅액 (1·2라운드 통합, 안테 제외, 새 핸드마다 0으로 초기화)
}

/**
 * 방 하나의 게임 상태머신.
 * 두장 섯다: 1라운드(카드 1장) 배팅 -> 2라운드(카드 1장 추가) 배팅 -> 쇼다운.
 * 사이드팟은 지원하지 않는다 — 올인 시 초과분은 단순화하여 메인 팟에 그대로 포함한다(캐주얼 플레이 가정).
 */
export class Room extends EventEmitter {
  readonly code: string;
  hostUserId: string;
  status: RoomStatus = "WAITING";
  players = new Map<string, InternalPlayer>();
  pot = 0;
  currentBet = 0;
  bettingRound: 1 | 2 = 1;
  /** 나가리(동점) 또는 구사/멍구사 강제 재대결 진행 중인지 여부 — 이 경우 카드 2장을 바로 받고 베팅 1회만 진행한다. */
  isRematchRound = false;
  dealerUserId: string | null = null;
  turnUserId: string | null = null;
  turnDeadline: number | null = null;
  handNumber = 0;

  private deck: Card[] = [];
  private pendingAction = new Set<string>();
  private turnTimer: NodeJS.Timeout | null = null;
  private nextHandTimer: NodeJS.Timeout | null = null;

  constructor(code: string, hostUserId: string) {
    super();
    this.code = code;
    this.hostUserId = hostUserId;
  }

  get playerList(): InternalPlayer[] {
    return [...this.players.values()].sort((a, b) => a.seat - b.seat);
  }

  private nextFreeSeat(): number {
    const taken = new Set(this.playerList.map((p) => p.seat));
    for (let s = 0; s < CONFIG.MAX_SEATS; s++) {
      if (!taken.has(s)) return s;
    }
    throw new Error("방이 가득 찼습니다.");
  }

  addPlayer(userId: string, username: string, chips: number) {
    const existing = this.players.get(userId);
    if (existing) {
      existing.connected = true;
      this.emitState();
      return;
    }
    if (this.players.size >= CONFIG.MAX_SEATS) {
      throw new Error("방이 가득 찼습니다.");
    }
    this.players.set(userId, {
      userId,
      username,
      seat: this.nextFreeSeat(),
      connected: true,
      ready: false,
      chips,
      cards: [],
      folded: false,
      inHand: false,
      allIn: false,
      currentBet: 0,
      totalBet: 0,
    });
    this.emitState();
  }

  markDisconnected(userId: string) {
    const player = this.players.get(userId);
    if (!player) return;
    player.connected = false;
    if (this.status === "BETTING" && player.inHand && !player.folded) {
      this.foldPlayer(player);
      this.handleExternalFold(userId);
      return;
    }
    this.emitState();
  }

  removePlayer(userId: string) {
    const player = this.players.get(userId);
    if (!player) return;
    if (this.status === "BETTING" && player.inHand && !player.folded) {
      this.foldPlayer(player);
      this.handleExternalFold(userId);
    }
    this.players.delete(userId);
    if (this.hostUserId === userId) {
      const next = this.playerList[0];
      this.hostUserId = next ? next.userId : userId;
    }
    this.emitState();
  }

  setReady(userId: string, ready: boolean) {
    const player = this.players.get(userId);
    if (!player || this.status !== "WAITING") return;
    player.ready = ready;
    this.emitState();

    const seated = this.playerList.filter((p) => p.connected);
    const allReady =
      seated.length >= CONFIG.MIN_PLAYERS_TO_START &&
      seated.every((p) => p.ready);
    if (allReady) {
      this.startHand();
    }
  }

  private eligiblePlayers(): InternalPlayer[] {
    return this.playerList.filter((p) => p.connected && p.chips > 0);
  }

  private startHand() {
    const eligible = this.eligiblePlayers();
    if (eligible.length < CONFIG.MIN_PLAYERS_TO_START) {
      this.status = "WAITING";
      for (const p of this.players.values()) p.ready = false;
      this.emitState();
      return;
    }

    this.handNumber += 1;
    this.pot = 0;
    this.currentBet = 0;
    this.bettingRound = 1;
    this.isRematchRound = false;
    this.status = "DEALING";

    for (const p of this.players.values()) {
      p.cards = [];
      p.folded = false;
      p.allIn = false;
      p.currentBet = 0;
      p.totalBet = 0;
      p.inHand = eligible.includes(p);
    }

    // 선 정하기: 첫 판은 무작위, 이후엔 전판 승자가 선(없으면 다음 좌석 순으로 대체)
    let dealer = eligible.find((p) => p.userId === this.dealerUserId);
    if (!dealer) {
      dealer = eligible[Math.floor(Math.random() * eligible.length)];
    }
    this.dealerUserId = dealer.userId;

    // 안테 징수
    for (const p of eligible) {
      const ante = Math.min(CONFIG.ANTE, p.chips);
      p.chips -= ante;
      this.pot += ante;
    }

    this.deck = shuffle(buildDeck());
    this.dealRoundCard();
    this.beginBettingRound();
  }

  /** 선 플레이어부터 시계방향으로, 살아있는 참가자에게 카드를 1장씩 나눠준다. */
  private dealRoundCard() {
    const order = this.activeOrderFrom(this.dealerUserId!);
    for (const userId of order) {
      const player = this.players.get(userId)!;
      player.cards.push(this.deck.pop()!);
    }
  }

  private beginBettingRound() {
    this.currentBet = 0;
    for (const p of this.playerList) {
      if (p.inHand && !p.folded) p.currentBet = 0;
    }
    this.status = "BETTING";
    const order = this.activeOrderFrom(this.dealerUserId!);
    const actable = order.filter((userId) => !this.players.get(userId)!.allIn);
    this.pendingAction = new Set(actable);
    this.turnUserId = actable[0] ?? null;
    this.emitDealt();

    if (!this.turnUserId) {
      // 남은 전원이 올인 상태라 아무도 액션할 수 없으면 곧바로 다음 단계로 넘어간다.
      this.emitState();
      const active = this.playerList.filter((p) => p.inHand && !p.folded);
      this.advancePastBettingRound(active);
      return;
    }

    this.scheduleTurnTimer();
    this.emitState();
  }

  private activeOrderFrom(startUserId: string): string[] {
    const active = this.playerList.filter((p) => p.inHand && !p.folded);
    const startIdx = active.findIndex((p) => p.userId === startUserId);
    if (startIdx === -1) return active.map((p) => p.userId);
    return [
      ...active.slice(startIdx),
      ...active.slice(0, startIdx),
    ].map((p) => p.userId);
  }

  /**
   * userId 다음으로 액션할 사람을 좌석 순서 기준으로 찾는다.
   * userId 본인이 방금 다이해서 더 이상 "활성" 목록에 없을 수 있으므로, 좌석 위치를
   * 찾을 때는 폴드 여부와 무관하게 전체 플레이어 목록(this.playerList)을 기준으로 삼는다.
   */
  private nextActiveAfter(userId: string): string | null {
    const all = this.playerList;
    const idx = all.findIndex((p) => p.userId === userId);
    if (idx === -1) return null;
    for (let step = 1; step <= all.length; step++) {
      const candidate = all[(idx + step) % all.length];
      if (candidate.inHand && !candidate.folded && !candidate.allIn) return candidate.userId;
    }
    return null;
  }

  private scheduleTurnTimer() {
    this.clearTurnTimer();
    if (!this.turnUserId) return;
    this.turnDeadline = Date.now() + CONFIG.TURN_TIMEOUT_MS;
    this.turnTimer = setTimeout(() => {
      if (this.turnUserId) this.handleAction(this.turnUserId, "die");
    }, CONFIG.TURN_TIMEOUT_MS);
  }

  private clearTurnTimer() {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.turnDeadline = null;
  }

  handleAction(userId: string, action: BetActionType) {
    if (this.status !== "BETTING") return;
    if (this.turnUserId !== userId) {
      this.emit("error", { targetUserId: userId, message: "당신의 차례가 아닙니다." });
      return;
    }
    const player = this.players.get(userId);
    if (!player || !player.inHand || player.folded) return;

    try {
      switch (action) {
        case "check":
          this.applyCheck(player);
          break;
        case "call":
          this.applyCall(player);
          break;
        case "ping":
          if (this.currentBet !== 0) {
            throw new Error("이미 배팅이 시작되어 삥을 사용할 수 없습니다.");
          }
          this.applyRaise(player, CONFIG.PING_RAISE);
          break;
        case "half": {
          // 배팅이 아직 없으면(전원 체크 상태) 삥과 동일한 기본 배팅액, 있으면 이전 배팅금액 + 2,000원
          const raiseAmount = this.currentBet === 0 ? CONFIG.PING_RAISE : CONFIG.HALF_RAISE;
          this.applyRaise(player, raiseAmount);
          break;
        }
        case "die":
          this.foldPlayer(player);
          break;
      }
    } catch (err) {
      this.emit("error", {
        targetUserId: userId,
        message: err instanceof Error ? err.message : "처리할 수 없는 행동입니다.",
      });
      return;
    }

    this.afterAction();
  }

  private applyCheck(player: InternalPlayer) {
    if (this.currentBet > player.currentBet) {
      throw new Error("베팅이 걸려 있어 체크할 수 없습니다.");
    }
    this.pendingAction.delete(player.userId);
  }

  private applyCall(player: InternalPlayer) {
    if (this.currentBet <= player.currentBet) {
      throw new Error("콜할 베팅이 없습니다.");
    }
    const need = this.currentBet - player.currentBet;
    const pay = Math.min(need, player.chips);
    player.chips -= pay;
    player.currentBet += pay;
    player.totalBet += pay;
    this.pot += pay;
    if (player.chips === 0) player.allIn = true;
    this.pendingAction.delete(player.userId);
  }

  private applyRaise(player: InternalPlayer, raiseAmount: number) {
    const targetLevel = this.currentBet + raiseAmount;
    const need = targetLevel - player.currentBet;
    const pay = Math.min(need, player.chips);
    player.chips -= pay;
    player.currentBet += pay;
    player.totalBet += pay;
    this.pot += pay;
    if (player.chips === 0) player.allIn = true;
    this.currentBet = Math.max(this.currentBet, player.currentBet);

    // 레이즈가 발생하면 나머지 활성 플레이어는 다시 액션해야 한다
    this.pendingAction = new Set(
      this.playerList
        .filter((p) => p.inHand && !p.folded && !p.allIn && p.userId !== player.userId)
        .map((p) => p.userId)
    );
  }

  private foldPlayer(player: InternalPlayer) {
    player.folded = true;
    this.pendingAction.delete(player.userId);
  }

  /** 접속 종료/퇴장으로 인해 본인 턴이 아닐 때도 강제로 다이 처리된 경우의 후속 진행 */
  private handleExternalFold(foldedUserId: string) {
    if (this.status !== "BETTING") return;
    const active = this.playerList.filter((p) => p.inHand && !p.folded);
    if (active.length <= 1) {
      this.resolveHand(active);
      return;
    }
    const stillNeedsAction = active.some(
      (p) => !p.allIn && this.pendingAction.has(p.userId)
    );
    if (!stillNeedsAction) {
      this.advancePastBettingRound(active);
      return;
    }
    if (this.turnUserId === foldedUserId) {
      this.clearTurnTimer();
      const next = this.nextActiveAfter(foldedUserId);
      if (!next) {
        this.advancePastBettingRound(active);
        return;
      }
      this.turnUserId = next;
      this.scheduleTurnTimer();
    }
    this.emitState();
  }

  private afterAction() {
    this.clearTurnTimer();
    const active = this.playerList.filter((p) => p.inHand && !p.folded);

    if (active.length <= 1) {
      this.resolveHand(active);
      return;
    }

    const stillNeedsAction = active.some(
      (p) => !p.allIn && this.pendingAction.has(p.userId)
    );
    if (!stillNeedsAction) {
      this.advancePastBettingRound(active);
      return;
    }

    const next = this.nextActiveAfter(this.turnUserId!);
    if (!next) {
      this.advancePastBettingRound(active);
      return;
    }
    this.turnUserId = next;
    this.scheduleTurnTimer();
    this.emitState();
  }

  /**
   * 배팅 라운드가 끝났을 때: 1라운드였으면 카드 1장 더 돌리고 2라운드 시작, 2라운드(또는
   * 재대결의 단일 라운드)였으면 쇼다운.
   */
  private advancePastBettingRound(active: InternalPlayer[]) {
    if (!this.isRematchRound && this.bettingRound === 1) {
      this.bettingRound = 2;
      this.dealRoundCard();
      this.beginBettingRound();
      return;
    }
    this.resolveHand(active);
  }

  private resolveHand(active: InternalPlayer[]) {
    this.status = "SHOWDOWN";
    this.turnUserId = null;
    this.clearTurnTimer();

    if (active.length === 1) {
      const winner = active[0];
      winner.chips += this.pot;
      this.dealerUserId = winner.userId;
      this.finishHand(active, [
        {
          userId: winner.userId,
          username: winner.username,
          cards: [],
          rankLabel: "폴드 승리",
          isWinner: true,
          amountWon: this.pot,
        },
      ]);
      return;
    }

    const finalEvals = resolveShowdown(
      active.map((p) => ({ id: p.userId, cards: [p.cards[0], p.cards[1]] as [Card, Card] }))
    );

    let best: FinalEval = finalEvals.get(active[0].userId)!;
    for (const p of active.slice(1)) {
      const e = finalEvals.get(p.userId)!;
      if (compareEval(e, best) > 0) best = e;
    }

    // 멍텅구리구사: 최고패가 9땡 이하(광땡·장땡 제외)면 강제 재대결, 폴드 안 한 전원 참가
    const hasMeongGusa = active.some((p) => finalEvals.get(p.userId)!.isMeongGusa);
    const weakEnoughForMeongGusa = best.tier < TIER.DDANG || (best.tier === TIER.DDANG && best.sub <= 9);
    if (hasMeongGusa && weakEnoughForMeongGusa) {
      this.startRematch(
        new Set(active.map((p) => p.userId)),
        "멍텅구리구사! 최고패가 9땡 이하라 전원 재대결합니다."
      );
      return;
    }

    // 구사: 최고패가 알리 이하(중간족보~끗)면 강제 재대결, 폴드 안 한 전원 참가
    const hasGusa = active.some((p) => finalEvals.get(p.userId)!.isGusa);
    const weakEnoughForGusa = best.tier <= TIER.MIDDLE;
    if (hasGusa && weakEnoughForGusa) {
      this.startRematch(new Set(active.map((p) => p.userId)), "구사! 최고패가 알리 이하라 전원 재대결합니다.");
      return;
    }

    // 동점(같은 족보): 동점자끼리만 재대결(나가리)
    const winners = active.filter((p) => compareEval(finalEvals.get(p.userId)!, best) === 0);
    if (winners.length > 1) {
      this.startRematch(new Set(winners.map((p) => p.userId)), "나가리! 동점자끼리 재대결합니다.");
      return;
    }

    const winner = winners[0];
    const results: HandResultEntry[] = active.map((p) => {
      const isWinner = p.userId === winner.userId;
      const amountWon = isWinner ? this.pot : 0;
      if (isWinner) p.chips += this.pot;
      return {
        userId: p.userId,
        username: p.username,
        cards: p.cards,
        rankLabel: finalEvals.get(p.userId)!.label,
        isWinner,
        amountWon,
      };
    });
    this.dealerUserId = winner.userId;
    this.finishHand(active, results);
  }

  /** 나가리/구사/멍구사 강제 재대결: 참가자는 카드를 새로 받고 단일 배팅 라운드를 진행한다. 안테는 다시 걷지 않는다. */
  private startRematch(participantIds: Set<string>, reason: string) {
    for (const p of this.playerList) {
      if (p.inHand && !p.folded && !participantIds.has(p.userId)) {
        p.folded = true; // 이번 핸드에서 더 이상 승산이 없는 인원은 제외
      }
    }
    for (const p of this.playerList) {
      if (participantIds.has(p.userId)) p.cards = [];
    }

    this.isRematchRound = true;
    this.deck = shuffle(buildDeck());
    this.dealRoundCard();
    this.dealRoundCard();

    this.emit("notice", { message: reason });
    this.beginBettingRound();
  }

  private finishHand(active: InternalPlayer[], results: HandResultEntry[]) {
    void this.persistChips(active);

    const payload: GameResultPayload = {
      pot: this.pot,
      results,
      nextHandInMs: CONFIG.RESULT_DISPLAY_MS,
    };
    this.status = "RESULT";
    this.emit("result", payload);
    this.emitState();

    this.nextHandTimer = setTimeout(() => {
      this.status = "WAITING";
      this.startHand();
    }, CONFIG.RESULT_DISPLAY_MS);
  }

  private async persistChips(active: InternalPlayer[]) {
    try {
      await Promise.all(
        active.map((p) =>
          prisma.user.update({
            where: { id: p.userId },
            data: { chips: p.chips },
          })
        )
      );
    } catch (err) {
      console.error("칩 잔액 저장 실패:", err);
    }
  }

  private emitDealt() {
    const dealt = new Map<string, Card[]>();
    for (const p of this.playerList) {
      if (p.inHand) dealt.set(p.userId, p.cards);
    }
    this.emit("dealt", dealt);
  }

  getPlayerCards(userId: string): Card[] | null {
    const player = this.players.get(userId);
    if (!player || !player.inHand || player.cards.length === 0) return null;
    return player.cards;
  }

  toPublicPlayers(): PlayerPublic[] {
    return this.playerList.map((p) => ({
      userId: p.userId,
      username: p.username,
      chips: p.chips,
      seat: p.seat,
      connected: p.connected,
      ready: p.ready,
      folded: p.folded,
      inHand: p.inHand,
      currentBet: p.currentBet,
      totalBet: p.totalBet,
      hasCards: p.inHand && p.cards.length > 0,
    }));
  }

  toStatePayload(): RoomStatePayload {
    return {
      code: this.code,
      status: this.status,
      players: this.toPublicPlayers(),
      pot: this.pot,
      currentBet: this.currentBet,
      bettingRound: this.bettingRound,
      dealerUserId: this.dealerUserId,
      turnUserId: this.turnUserId,
      turnDeadline: this.turnDeadline,
      hostUserId: this.hostUserId,
      handNumber: this.handNumber,
    };
  }

  private emitState() {
    this.emit("state", this.toStatePayload());
  }

  destroy() {
    this.clearTurnTimer();
    if (this.nextHandTimer) clearTimeout(this.nextHandTimer);
  }
}
