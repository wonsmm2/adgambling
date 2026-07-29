import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { getSocket } from "../socket";
import Table from "../components/Table";
import BettingControls from "../components/BettingControls";
import Card from "../components/Card";
import type { BetActionType, Card as CardType, GameResultPayload, RoomStatePayload } from "../types";

export default function GamePage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [roomState, setRoomState] = useState<RoomStatePayload | null>(null);
  const [myCards, setMyCards] = useState<CardType[] | null>(null);
  const [result, setResult] = useState<GameResultPayload | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastHandNumber = useRef<number | null>(null);

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
        if (!me?.hasCards) setMyCards(null);
      }
      // 인원 부족 등으로 다음 핸드가 시작되지 못하고 대기 상태로 돌아간 경우에도 결과창을 정리한다.
      if (payload.status === "WAITING") {
        setResult(null);
        setMyCards(null);
      }
      lastHandNumber.current = payload.handNumber;
      setRoomState(payload);
    };
    const onDealt = (payload: { cards: CardType[] }) => setMyCards(payload.cards);
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

  return (
    <div className="game-page">
      <div className="game-topbar">
        <span>
          방 코드: <strong>{roomState.code}</strong>
        </span>
        {noticeMsg && <span className="auth-notice">{noticeMsg}</span>}
        {errorMsg && <span className="auth-error">{errorMsg}</span>}
        <span className="logout-link" onClick={leaveRoom}>
          나가기
        </span>
      </div>

      <div className="table-wrap">
        <Table
          players={roomState.players}
          dealerUserId={roomState.dealerUserId}
          turnUserId={roomState.turnUserId}
          pot={roomState.pot}
          status={roomState.status}
          bettingRound={roomState.bettingRound}
          myUserId={user.id}
          myCards={myCards}
          revealedByUserId={revealedByUserId}
          result={result}
        />
      </div>

      <div className="my-hand">
        {myCards && (
          <div className="cards">
            {myCards.map((c, i) => (
              <Card key={i} card={c} large />
            ))}
          </div>
        )}

        {roomState.status === "WAITING" && (
          <button className="ready-toggle" onClick={toggleReady}>
            {me?.ready ? "준비 취소" : "준비 완료"}
          </button>
        )}

        {roomState.status === "BETTING" && (
          <>
            {isMyTurn && secondsLeft !== null && (
              <div className="turn-timer">남은 시간: {secondsLeft}초</div>
            )}
            <BettingControls
              disabled={!isMyTurn}
              currentBet={roomState.currentBet}
              myBet={me?.currentBet ?? 0}
              onAction={act}
            />
          </>
        )}
      </div>
    </div>
  );
}
