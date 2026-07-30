import { breakdownBills, billColorClass } from "../lib/bills";

export interface FlyingBatch {
  id: string;
  amount: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

interface Props {
  batches: FlyingBatch[];
}

export default function BetFlyLayer({ batches }: Props) {
  return (
    <div className="bet-fly-layer">
      {batches.flatMap((batch) => {
        const bills = breakdownBills(batch.amount, 6);
        const dx = batch.to.x - batch.from.x;
        const dy = batch.to.y - batch.from.y;
        return bills.map((denom, i) => (
          <span
            key={`${batch.id}-${i}`}
            className={`fly-bill ${billColorClass(denom)}`}
            style={
              {
                left: batch.from.x,
                top: batch.from.y,
                "--dx": `${dx}px`,
                "--dy": `${dy}px`,
                animationDelay: `${i * 40}ms`,
              } as React.CSSProperties
            }
          />
        ));
      })}
    </div>
  );
}
