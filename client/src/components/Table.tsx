import type { Card as CardType, GameResultPayload, PlayerPublic, RoomStatus } from "../types";
import Seat from "./Seat";

const STATUS_LABEL: Record<RoomStatus, string> = {
  WAITING: "대기 중 (준비 완료를 눌러주세요)",
  DEALING: "카드 배분 중...",
  BETTING: "베팅 중",
  SHOWDOWN: "패 공개 중...",
  RESULT: "결과 확인",
};

interface Props {
  players: PlayerPublic[];
  dealerUserId: string | null;
  turnUserId: string | null;
  pot: number;
  status: RoomStatus;
  bettingRound: 1 | 2;
  myUserId: string;
  myCards: CardType[] | null;
  revealedByUserId: Map<string, CardType[]>;
  result: GameResultPayload | null;
}

export default function Table({
  players,
  dealerUserId,
  turnUserId,
  pot,
  status,
  bettingRound,
  myUserId,
  myCards,
  revealedByUserId,
  result,
}: Props) {
  const sorted = [...players].sort((a, b) => a.seat - b.seat);
  const myIdx = sorted.findIndex((p) => p.userId === myUserId);
  const rotated =
    myIdx === -1 ? sorted : [...sorted.slice(myIdx), ...sorted.slice(0, myIdx)];

  const n = rotated.length || 1;
  const winners = result?.results.filter((r) => r.isWinner) ?? [];

  return (
    <div className="table-felt">
      <div className="table-center">
        {status === "RESULT" && winners.length > 0 ? (
          <div className="winner-display">
            <div className="winner-names">{winners.map((w) => w.username).join(", ")} 승리</div>
            <div className="winner-rank">{winners[0].rankLabel}</div>
            <div className="winner-amount">
              {winners.map((w) => `+${w.amountWon.toLocaleString()}`).join(" · ")}
            </div>
          </div>
        ) : (
          <>
            <div className="pot">팟 {pot.toLocaleString()}</div>
            <div className="status">
              {STATUS_LABEL[status]}
              {status === "BETTING" ? ` (${bettingRound}라운드)` : ""}
            </div>
          </>
        )}
      </div>
      {rotated.map((player, i) => {
        const angle = ((90 - i * (360 / n)) * Math.PI) / 180;
        const left = 50 + 42 * Math.cos(angle);
        const top = 50 + 42 * Math.sin(angle);
        return (
          <Seat
            key={player.userId}
            player={player}
            isDealer={player.userId === dealerUserId}
            isTurn={player.userId === turnUserId}
            style={{ left: `${left}%`, top: `${top}%` }}
            myCards={player.userId === myUserId ? myCards : null}
            revealedCards={revealedByUserId.get(player.userId) ?? null}
          />
        );
      })}
    </div>
  );
}
