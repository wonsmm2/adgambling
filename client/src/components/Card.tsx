import type { Card as CardType } from "../types";

interface Props {
  card?: CardType | null;
  hidden?: boolean;
  large?: boolean;
}

export default function Card({ card, hidden, large }: Props) {
  if (hidden || !card) {
    return <div className={`card back${large ? " large" : ""}`} />;
  }
  const src = `/cards/${card.month}-${card.isBright ? 1 : 2}.jpg`;
  return (
    <div className={`card${large ? " large" : ""}`}>
      <img src={src} alt={`${card.month}월 ${card.isBright ? "그림" : "띠"}`} draggable={false} />
    </div>
  );
}
