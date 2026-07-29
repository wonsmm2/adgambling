import type { CSSProperties } from "react";
import type { Card as CardType, PlayerPublic } from "../types";
import Card from "./Card";

interface Props {
  player: PlayerPublic;
  isDealer: boolean;
  isTurn: boolean;
  style: CSSProperties;
  myCards: CardType[] | null;
  revealedCards: CardType[] | null;
}

export default function Seat({ player, isDealer, isTurn, style, myCards, revealedCards }: Props) {
  const classes = ["seat"];
  if (isTurn) classes.push("turn");
  if (player.folded) classes.push("folded");
  if (isDealer) classes.push("dealer");

  const showOwnCards = myCards !== null;

  return (
    <div className={classes.join(" ")} style={style}>
      <div className="avatar">{player.username.slice(0, 2).toUpperCase()}</div>
      <div className="name">
        {player.username}
        {!player.connected ? " (연결끊김)" : ""}
      </div>
      <div className="chips">{player.chips.toLocaleString()}</div>
      {player.currentBet > 0 && <div className="bet">베팅 {player.currentBet.toLocaleString()}</div>}
      {player.hasCards && (
        <div className="cards">
          {revealedCards ? (
            revealedCards.map((c, i) => <Card key={i} card={c} />)
          ) : showOwnCards ? (
            myCards!.map((c, i) => <Card key={i} card={c} />)
          ) : (
            <>
              <Card hidden />
              <Card hidden />
            </>
          )}
        </div>
      )}
      {!player.ready && !player.hasCards && (
        <div className="bet">대기중</div>
      )}
    </div>
  );
}
