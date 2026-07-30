import type { Card as CardType, GameResultPayload, PlayerPublic, RoomStatus } from "../types";
import Seat from "./Seat";
import PotPile from "./PotPile";

const STATUS_LABEL: Record<RoomStatus, string> = {
  WAITING: "대기 중",
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
  revealedByUserId,
  result,
}: Props) {
  // 상대방만 표시한다 (내 정보/카드는 화면 하단 액션독에 크게 별도 표시).
  const opponents = players
    .filter((p) => p.userId !== myUserId)
    .sort((a, b) => a.seat - b.seat);

  const winners = result?.results.filter((r) => r.isWinner) ?? [];

  return (
    <div className="table-felt">
      <div className="opponents-row">
        {opponents.map((player) => (
          <Seat
            key={player.userId}
            player={player}
            isDealer={player.userId === dealerUserId}
            isTurn={player.userId === turnUserId}
            revealedCards={revealedByUserId.get(player.userId) ?? null}
          />
        ))}
      </div>

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
            <PotPile amount={pot} />
            <div className="pot">팟 {pot.toLocaleString()}</div>
            <div className="status">
              {STATUS_LABEL[status]}
              {status === "BETTING" ? ` · ${bettingRound}라운드` : ""}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
