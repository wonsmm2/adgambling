import type { Card } from "../types.js";

// 족보 티어 (숫자가 높을수록 강함)
export const TIER = {
  KKUT: 0, // 끗 (일반 끗 + 암행어사/땡잡이 무효 시 대체 등급)
  MIDDLE: 1, // 알리/독사/구삥/장삥/장사/세륙
  DDANG: 2, // 땡 (+ 땡잡이 활성 시 9.5)
  GWANG_DDANG: 3, // 13/18/38광땡 (+ 암행어사 활성 시 1.5)
} as const;

export interface BaseEval {
  tier: number;
  sub: number;
  label: string;
  /** 4월+9월 (멍구사 제외) — 최고패가 알리 이하면 강제 재대결 트리거 */
  isGusa: boolean;
  /** 4월그림+9월그림 — 최고패가 9땡 이하면 강제 재대결 트리거 (광땡·장땡 제외) */
  isMeongGusa: boolean;
  /** 4월그림+7월그림 — 상대 중 13/18광땡 보유자가 있어야 활성화 */
  isAhaengeosaCandidate: boolean;
  /** 3월광+7월그림 — 상대 중 1~9땡 보유자가 있어야 활성화 */
  isDdangjabiCandidate: boolean;
}

export interface FinalEval extends BaseEval {}

const MIDDLE_COMBOS: { months: [number, number]; sub: number; label: string }[] = [
  { months: [1, 2], sub: 6, label: "알리" },
  { months: [1, 4], sub: 5, label: "독사" },
  { months: [1, 9], sub: 4, label: "구삥" },
  { months: [1, 10], sub: 3, label: "장삥" },
  { months: [4, 10], sub: 2, label: "장사" },
  { months: [4, 6], sub: 1, label: "세륙" },
];

function isMonthPair(c1: Card, c2: Card, a: number, b: number): boolean {
  return (c1.month === a && c2.month === b) || (c1.month === b && c2.month === a);
}

// 땡잡이 후보: 3월 광 + 7월 그림(열끗)
function isDdangjabiCandidate(c1: Card, c2: Card): boolean {
  if (!isMonthPair(c1, c2, 3, 7)) return false;
  const three = c1.month === 3 ? c1 : c2;
  const seven = c1.month === 7 ? c1 : c2;
  return three.isBright && seven.isBright;
}

// 암행어사 후보: 4월 그림 + 7월 그림
function isAhaengeosaCandidate(c1: Card, c2: Card): boolean {
  if (!isMonthPair(c1, c2, 4, 7)) return false;
  return c1.isBright && c2.isBright;
}

export function evaluateBase(cards: [Card, Card]): BaseEval {
  const [c1, c2] = cards;
  const brightMonths = new Set(cards.filter((c) => c.isBright).map((c) => c.month));

  const base = (tier: number, sub: number, label: string): BaseEval => ({
    tier,
    sub,
    label,
    isGusa: false,
    isMeongGusa: false,
    isAhaengeosaCandidate: false,
    isDdangjabiCandidate: false,
  });

  // 38광땡 / 18광땡 / 13광땡
  if (brightMonths.has(3) && brightMonths.has(8) && c1.month !== c2.month) {
    return base(TIER.GWANG_DDANG, 2, "38광땡");
  }
  if (brightMonths.has(1) && brightMonths.has(8) && c1.month !== c2.month) {
    return base(TIER.GWANG_DDANG, 1, "18광땡");
  }
  if (brightMonths.has(1) && brightMonths.has(3) && c1.month !== c2.month) {
    return base(TIER.GWANG_DDANG, 1, "13광땡");
  }

  // 땡
  if (c1.month === c2.month) {
    const label = c1.month === 10 ? "장땡" : `${c1.month}땡`;
    return base(TIER.DDANG, c1.month, label);
  }

  // 암행어사 / 땡잡이 후보 (최종 등급은 쇼다운에서 상대 패를 보고 확정된다)
  const ahaengeosa = isAhaengeosaCandidate(c1, c2);
  const ddangjabi = isDdangjabiCandidate(c1, c2);

  // 중간족보
  const middle = MIDDLE_COMBOS.find((combo) => isMonthPair(c1, c2, combo.months[0], combo.months[1]));
  if (middle) {
    return base(TIER.MIDDLE, middle.sub, middle.label);
  }

  // 구사 / 멍텅구리구사 (끗 계산과 별개로 재대결 트리거 플래그만 갖는다)
  const isGusaPair = isMonthPair(c1, c2, 4, 9);
  const isMeongGusa = isGusaPair && c1.isBright && c2.isBright;
  const isGusa = isGusaPair && !isMeongGusa;

  const kkut = (c1.month + c2.month) % 10;
  const label = ahaengeosa ? "암행어사" : ddangjabi ? "땡잡이" : kkut === 9 ? "갑오" : kkut === 0 ? "망통" : `${kkut}끗`;

  return {
    tier: TIER.KKUT,
    sub: kkut,
    label,
    isGusa,
    isMeongGusa,
    isAhaengeosaCandidate: ahaengeosa,
    isDdangjabiCandidate: ddangjabi,
  };
}

/**
 * 쇼다운 참가자 전원의 패를 한 번에 평가한다.
 * 암행어사/땡잡이는 상대 중에 타깃(13·18광땡 / 1~9땡)이 있어야 활성화되므로
 * 개별 패만으로는 최종 등급을 확정할 수 없어 이 단계에서 일괄 처리한다.
 */
export function resolveShowdown(hands: { id: string; cards: [Card, Card] }[]): Map<string, FinalEval> {
  const evals = hands.map((h) => ({ id: h.id, base: evaluateBase(h.cards) }));

  const hasDdangjabiTarget = evals.some((e) => e.base.tier === TIER.DDANG && e.base.sub >= 1 && e.base.sub <= 9);
  const hasAhaengeosaTarget = evals.some((e) => e.base.tier === TIER.GWANG_DDANG && e.base.sub === 1);

  const result = new Map<string, FinalEval>();
  for (const { id, base } of evals) {
    if (base.isDdangjabiCandidate) {
      result.set(
        id,
        hasDdangjabiTarget
          ? { ...base, tier: TIER.DDANG, sub: 9.5, label: "땡잡이" }
          : { ...base, tier: TIER.KKUT, sub: 0, label: "망통 (땡잡이 무효)" }
      );
      continue;
    }
    if (base.isAhaengeosaCandidate) {
      result.set(
        id,
        hasAhaengeosaTarget
          ? { ...base, tier: TIER.GWANG_DDANG, sub: 1.5, label: "암행어사" }
          : { ...base, tier: TIER.KKUT, sub: 1, label: "1끗 (암행어사 무효)" }
      );
      continue;
    }
    result.set(id, base);
  }
  return result;
}

/** a가 b보다 강하면 양수, 약하면 음수, 동점이면 0. (동점은 재대결 대상 — 카드 크기로 추가 구분하지 않는다) */
export function compareEval(a: FinalEval, b: FinalEval): number {
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.sub - b.sub;
}
