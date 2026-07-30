interface Props {
  amount: number;
  large?: boolean;
}

export default function BetStack({ amount, large }: Props) {
  if (amount <= 0) return null;
  const billCount = Math.min(5, Math.max(1, Math.ceil(amount / 2000)));

  return (
    <div className={`bet-stack${large ? " large" : ""}`}>
      <div className="bet-bills">
        {Array.from({ length: billCount }).map((_, i) => (
          <span key={i} className="bet-bill" />
        ))}
      </div>
      <span className="bet-amount">{amount.toLocaleString()}</span>
    </div>
  );
}
