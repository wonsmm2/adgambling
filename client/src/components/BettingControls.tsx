import type { BetActionType } from "../types";

const PING_RAISE = 1000;
const HALF_RAISE = 2000;

interface Props {
  disabled: boolean;
  currentBet: number;
  myBet: number;
  chips: number;
  onAction: (type: BetActionType) => void;
}

export default function BettingControls({ disabled, currentBet, myBet, chips, onAction }: Props) {
  const canCheck = currentBet <= myBet;
  const canCall = currentBet > myBet;
  // 삥은 아직 아무도 배팅하지 않았을 때(오프닝)만 사용할 수 있다.
  const canPing = currentBet === 0;
  const halfTarget = currentBet === 0 ? PING_RAISE : currentBet + HALF_RAISE;

  // 버튼에는 "목표 배팅액"이 아니라 지금 이 액션으로 실제 내 칩에서 빠져나갈 금액을 표시한다
  // (이미 이번 라운드에 일부를 냈다면 그 차액만, 칩이 모자라면 올인 금액까지만).
  const pingPay = Math.max(0, Math.min(PING_RAISE - myBet, chips));
  const halfPay = Math.max(0, Math.min(halfTarget - myBet, chips));
  const callPay = Math.max(0, Math.min(currentBet - myBet, chips));

  return (
    <div className="betting-controls">
      <button className="btn-ping" disabled={disabled || !canPing} onClick={() => onAction("ping")}>
        <span className="btn-label">삥</span>
        <span className="btn-amount">{pingPay.toLocaleString()}</span>
      </button>
      <button className="btn-half" disabled={disabled} onClick={() => onAction("half")}>
        <span className="btn-label">하프</span>
        <span className="btn-amount">{halfPay.toLocaleString()}</span>
      </button>
      <button className="btn-call" disabled={disabled || !canCall} onClick={() => onAction("call")}>
        <span className="btn-label">콜</span>
        <span className="btn-amount">{callPay.toLocaleString()}</span>
      </button>
      <button className="btn-check" disabled={disabled || !canCheck} onClick={() => onAction("check")}>
        <span className="btn-label">체크</span>
      </button>
      <button className="btn-die" disabled={disabled} onClick={() => onAction("die")}>
        <span className="btn-label">다이</span>
      </button>
    </div>
  );
}
