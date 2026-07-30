import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { getSocket } from "../socket";
import Table from "../components/Table";
import BettingControls from "../components/BettingControls";
import Card from "../components/Card";
import BetStack from "../components/BetStack";
import BetFlyLayer, { type FlyingBatch } from "../components/BetFlyLayer";
import type { BetActionType, Card as CardType, GameResultPayload, RoomStatePayload } from "../types";

function seatCenter(userId: string): { x: number; y: number } | null {
  const el = document.querySelector(`[data-user-id="${userId}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [myCards, setMyCards] = useState<CardType[] | null>(null);
  const [myRankLabel, setMyRankLabel] = useState<string | null>(null);
  const [result, setResult] = useState<GameResultPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [flyingBatches, setFlyingBatches] = useState<FlyingBatch[]>([]);
  const lastHandNumber = useRef<number | null>(null);
  const prevPlayersRef = useRef<Map<string, number> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !code) return;

    socket.emit("room:join", { code });

    const onState = (payload: RoomStatePayload) => {
      // 새 핸드가 시작되면(handNumber 증가) 이전 판의 결과창을 정리한다.
      // (RESULT -> BETTING 전이가 한 번에 일어나 별도의 DEALING 브로드캐스트는 오지 않는다)
      if (lastHandNumber.current !== null && payload.handNumber !== lastHandNumber.current) {
        setResult(null);
        // game:dealt가 room:state보다 먼저 도착하므로, 이번 핸드에 참여하지 않을 때만 비운다
        const me = payload.players.find((p) => p.userId === user?.id);
        if (!me?.hasCards) {
          setMyCards(null);
          setMyRankLabel(null);
        }
      }
      // 인원 부족 등으로 다음 핸드가 시작되지 못하고 대기 상태로 돌아간 경우에도 결과창을 정리한다.
      if (payload.status === "WAITING") {
        setResult(null);
        setMyCards(null);
        setMyRankLabel(null);
      }
      lastHandNumber.current = payload.handNumber;

      // 직전 상태와 비교해 배팅액이 늘어난 플레이어가 있으면, 그 자리에서 팟으로 지폐가
      // 날아가는 연출을 트리거한다 (족보 계산과 무관한 순수 시각 효과).
      const prevBets = prevPlayersRef.current;
      const nextBets = new Map(payload.players.map((p) => [p.userId, p.currentBet]));
      if (prevBets && payload.status === "BETTING") {
        const potEl = document.querySelector("[data-pot-anchor]");
        const potRect = potEl?.getBoundingClientRect();
        if (potRect) {
          const to = { x: potRect.left + potRect.width / 2, y: potRect.top + potRect.height / 2 };
          const batches: FlyingBatch[] = [];
          for (const p of payload.players) {
            const delta = p.currentBet - (prevBets.get(p.userId) ?? 0);
            if (delta <= 0) continue;
            const from = seatCenter(p.userId);
            if (!from) continue;
            batches.push({ id: `${payload.handNumber}-${p.userId}-${Date.now()}`, amount: delta, from, to });
          }
          if (batches.length > 0) {
            setFlyingBatches((prev) => [...prev, ...batches]);
            setTimeout(() => {
              setFlyingBatches((prev) => prev.filter((b) => !batches.includes(b)));
            }, 650);
          }
        }
      }
      prevPlayersRef.current = nextBets;

      setRoomState(payload);
    };
    const onDealt = (payload: { cards: CardType[]; rankLabel?: string }) => {
      setMyCards(payload.cards);
      setMyRankLabel(payload.rankLabel ?? null);
    };
    const onResult = (payload: GameResultPayload) => setResult(payload);
    const onError = (payload: { message: string }) => setErrorMsg(payload.message);
    const onNotice = (payload: { message: string }) => setNoticeMsg(payload.message);

    socket.on("room:state", onState);
    socket.on("game:dealt", onDealt);
    socket.on("game:result", onResult);
    socket.on("error", onError);
    socket.on("game:notice", onNotice);

    return () => {
      socket.off("room:state", onState);
      socket.off("game:dealt", onDealt);
      socket.off("game:result", onResult);
      socket.off("error", onError);
      socket.off("game:notice", onNotice);
    };
  }, [code]);

  useEffect(() => {
    if (!errorMsg) return;
    const t = setTimeout(() => setErrorMsg(null), 4000);
    return () => clearTimeout(t);
  }, [errorMsg]);

  useEffect(() => {
    if (!noticeMsg) return;
    const t = setTimeout(() => setNoticeMsg(null), 5000);
    return () => clearTimeout(t);
  }, [noticeMsg]);

  useEffect(() => {
    if (!roomState?.turnDeadline) {
      setSecondsLeft(null);
      return;
    }
    const update = () =>
      setSecondsLeft(Math.max(0, Math.ceil((roomState.turnDeadline! - Date.now()) / 1000)));
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [roomState?.turnDeadline]);

  const revealedByUserId = useMemo(() => {
    const map = new Map<string, CardType[]>();
    if (result) {
      for (const r of result.results) {
        if (r.cards.length > 0) map.set(r.userId, r.cards);
      }
    }
    return map;
  }, [result]);

  if (!user || !roomState) {
    return <div className="center-screen">방에 접속하는 중...</div>;
  }

  const me = roomState.players.find((p) => p.userId === user.id);
  const isMyTurn = roomState.status === "BETTING" && roomState.turnUserId === user.id;
  const isDealer = roomState.dealerUserId === user.id;
  const myRevealed = revealedByUserId.get(user.id) ?? null;
  const displayCards = myRevealed ?? myCards;
  const myFinalRankLabel = result?.results.find((r) => r.userId === user.id)?.rankLabel;
  const displayRankLabel = myFinalRankLabel ?? myRankLabel;
  const roomCode = roomState.code;

  function act(type: BetActionType) {
    getSocket()?.emit("game:action", { type });
  }

  function leaveRoom() {
    getSocket()?.emit("room:leave");
    navigate("/");
  }

  function toggleReady() {
    getSocket()?.emit("game:ready", { ready: !me?.ready });
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = roomCode;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 1500);
  }

  return (
    <div className="game-page">
      <header className="game-topbar">
        <span className="room-code-badge">
          방 코드 <strong>{roomState.code}</strong>
          <button className="copy-code-btn" onClick={copyRoomCode}>
            {codeCopied ? "복사됨" : "복사"}
          </button>
        </span>
        <span className="logout-link" onClick={leaveRoom}>
          나가기
        </span>
      </header>

      {(noticeMsg || errorMsg) && (
        <div className="toast-stack">
          {noticeMsg && <div className="toast toast-notice">{noticeMsg}</div>}
          {errorMsg && <div className="toast toast-error">{errorMsg}</div>}
        </div>
      )}

      <div className="table-scroll">
        <Table
          players={roomState.players}
          dealerUserId={roomState.dealerUserId}
          turnUserId={roomState.turnUserId}
          pot={roomState.pot}
          status={roomState.status}
          bettingRound={roomState.bettingRound}
          myUserId={user.id}
          revealedByUserId={revealedByUserId}
          result={result}
        />
      </div>

      <div className={`action-dock${isMyTurn ? " my-turn" : ""}`}>
        <div className="my-seat-row">
          <div className="my-seat-info">
            <span className="my-avatar" data-user-id={user.id}>
              {user.username.slice(0, 2).toUpperCase()}
              {isDealer && <span className="dealer-badge">선</span>}
            </span>
            <span className="my-name">
              {user.username}
              {me?.folded ? " · 다이" : ""}
            </span>
            <span className="my-chips">{(me?.chips ?? user.chips).toLocaleString()}</span>
          </div>
          {isMyTurn && secondsLeft !== null && (
            <div className="turn-timer">내 차례 · {secondsLeft}초</div>
          )}
        </div>

        <BetStack amount={me?.currentBet ?? 0} large />

        {displayCards && (
          <div className="my-cards-wrap">
            <div className="my-cards">
              {displayCards.map((c, i) => (
                <Card key={i} card={c} large />
              ))}
            </div>
            {displayCards.length === 2 && displayRankLabel && (
              <div className="my-rank-label">{displayRankLabel}</div>
            )}
          </div>
        )}

        {roomState.status === "WAITING" && (
          <button className="ready-toggle" onClick={toggleReady}>
            {me?.ready ? "준비 취소" : "준비 완료"}
          </button>
        )}

        {roomState.status === "BETTING" && (
          <BettingControls
            disabled={!isMyTurn}
            currentBet={roomState.currentBet}
            myBet={me?.currentBet ?? 0}
            onAction={act}
          />
        )}
      </div>

      <BetFlyLayer batches={flyingBatches} />
    </div>
  );
}
