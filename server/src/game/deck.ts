import type { Card } from "../types.js";

// 섯다는 화투 20장(1~10월, 월별 2장)을 사용한다.
// 월별로 그림(광/열끗) 카드 1장(isBright=true)과 띠 카드 1장(isBright=false)이 짝을 이룬다.
// 족보 계산에서는 1/3/8월의 isBright 조합만 38광땡·18광땡 판정에 쓰인다.
export function buildDeck(): Card[] {
  const deck: Card[] = [];
  for (let month = 1; month <= 10; month++) {
    deck.push({ month, isBright: true });
    deck.push({ month, isBright: false });
  }
  return deck;
}

export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
