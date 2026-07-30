export type BillDenom = 1000 | 5000 | 10000;

const DENOMS: BillDenom[] = [10000, 5000, 1000];

/** 배팅 금액을 지폐 단위(1만/5천/1천)로 쪼갠다. 큰 단위부터 최대한 채우는 방식(그리디). */
export function breakdownBills(amount: number, maxBills = 12): BillDenom[] {
  let remaining = Math.max(0, Math.round(amount));
  const bills: BillDenom[] = [];
  for (const denom of DENOMS) {
    while (remaining >= denom && bills.length < maxBills) {
      bills.push(denom);
      remaining -= denom;
    }
  }
  return bills;
}

export function billColorClass(denom: BillDenom): string {
  if (denom === 10000) return "bill-10000";
  if (denom === 5000) return "bill-5000";
  return "bill-1000";
}
