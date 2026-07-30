import { breakdownBills, billColorClass } from "../lib/bills";

interface Props {
  amount: number;
  large?: boolean;
}

export default function BetStack({ amount, large }: Props) {
  if (amount <= 0) return null;
  const bills = breakdownBills(amount, large ? 10 : 6);
  const billW = large ? 26 : 18;
  const step = large ? 3 : 2;
  const width = billW + Math.max(0, bills.length - 1) * step;
  const height = large ? 18 : 12;

  return (
    <div className={`bet-stack${large ? " large" : ""}`}>
      <div className="bet-bills" style={{ width, height }}>
        {bills.map((denom, i) => (
          <span
            key={i}
            className={`bet-bill ${billColorClass(denom)}`}
            style={{
              transform: `translate(${i * step}px, ${i * -step * 0.4}px) rotate(${i * 4 - bills.length * 2}deg)`,
              zIndex: i,
            }}
          />
        ))}
      </div>
      <span className="bet-amount">{amount.toLocaleString()}</span>
    </div>
  );
}
