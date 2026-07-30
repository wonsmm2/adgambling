import type { Card as CardType, PlayerPublic } from "../types";
import Card from "./Card";
import BetStack from "./BetStack";

interface Props {
  player: PlayerPublic;
  isDealer: boolean;
  isTurn: boolean;
  revealedCards: CardType[] | null;
}

export default function Seat({ player, isDealer, isTurn, revealedCards }: Props) {
  const classes = ["seat"];
  if (isTurn) classes.push("turn");
  if (player.folded) classes.push("folded");

  return (
    <div className={classes.join(" ")}>
      <div className="avatar">
        {player.username.slice(0, 2).toUpperCase()}
        {isDealer && <span className="dealer-badge">선</span>}
        {!player.connected && <span className="disconnected-dot" />}
      </div>
      <div className="name">{player.username}</div>
      <div className="chips">{player.chips.toLocaleString()}</div>
      {player.hasCards ? (
        <div className="cards">
          {revealedCards ? (
            revealedCards.map((c, i) => <Card key={i} card={c} />)
          ) : (
            <>
              <Card hidden />
              <Card hidden />
            </>
          )}
        </div>
      ) : (
        <div className="seat-status">{player.ready ? "준비완료" : "대기중"}</div>
      )}
      <BetStack amount={player.currentBet} />
      {player.folded && <div className="seat-status">다이</div>}
    </div>
  );
}
