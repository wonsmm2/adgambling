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
        삥 ({PING_RAISE.toLocaleString()})
      </button>
      <button className="btn-half" disabled={disabled} onClick={() => onAction("half")}>
        하프 ({halfTarget.toLocaleString()})
      </button>
      <button className="btn-call" disabled={disabled || !canCall} onClick={() => onAction("call")}>
        콜 ({currentBet.toLocaleString()})
      </button>
      <button className="btn-check" disabled={disabled || !canCheck} onClick={() => onAction("check")}>
        체크
      </button>
      <button className="btn-die" disabled={disabled} onClick={() => onAction("die")}>
        다이
      </button>
    </div>
  );
}
