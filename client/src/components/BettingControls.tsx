import type { BetActionType } from "../types";

const PING_RAISE = 1000;
const HALF_RAISE = 2000;

interface Props {
  disabled: boolean;
  currentBet: number;
  myBet: number;
  onAction: (type: BetActionType) => void;
}

export default function BettingControls({ disabled, currentBet, myBet, onAction }: Props) {
  const canCheck = currentBet <= myBet;
  const canCall = currentBet > myBet;
  // 삥은 아직 아무도 배팅하지 않았을 때(오프닝)만 사용할 수 있다.
  const canPing = currentBet === 0;
  const halfTarget = currentBet === 0 ? PING_RAISE : currentBet + HALF_RAISE;

  return (
    <div className="betting-controls">
      <button className="btn-ping" disabled={disabled || !canPing} onClick={() => onAction("ping")}>
        <span className="btn-label">삥</span>
        <span className="btn-amount">{PING_RAISE.toLocaleString()}</span>
      </button>
      <button className="btn-half" disabled={disabled} onClick={() => onAction("half")}>
        <span className="btn-label">하프</span>
        <span className="btn-amount">{halfTarget.toLocaleString()}</span>
      </button>
      <button className="btn-call" disabled={disabled || !canCall} onClick={() => onAction("call")}>
        <span className="btn-label">콜</span>
        <span className="btn-amount">{currentBet.toLocaleString()}</span>
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
