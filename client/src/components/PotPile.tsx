import { breakdownBills, billColorClass } from "../lib/bills";

interface Props {
  amount: number;
}

export default function PotPile({ amount }: Props) {
  const bills = breakdownBills(amount, 14);

  return (
    <div className="pot-pile" data-pot-anchor>
      {bills.map((denom, i) => {
        // index 기반 의사난수 오프셋으로 흩어놓아 쌓인 지폐 더미처럼 보이게 한다
        const angle = (i * 47) % 360;
        const dist = (i % 4) * 3;
        const dx = Math.cos((angle * Math.PI) / 180) * dist;
        const dy = Math.sin((angle * Math.PI) / 180) * dist * 0.5;
        const rot = ((i * 29) % 44) - 22;
        return (
          <span
            key={i}
            className={`pot-bill ${billColorClass(denom)}`}
            style={{
              transform: `translate(${dx}px, ${dy}px) rotate(${rot}deg)`,
              zIndex: i,
            }}
          />
        );
      })}
    </div>
  );
}
