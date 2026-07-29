export const CONFIG = {
  STARTING_CHIPS: 10000,
  ANTE: 1000, // 게임 시작 시 참가자당 걷는 기본 판돈
  PING_RAISE: 1000, // 삥: 이전 배팅금액 + 1,000원
  HALF_RAISE: 2000, // 하프: 이전 배팅금액 + 2,000원
  MAX_SEATS: 6,
  MIN_PLAYERS_TO_START: 2,
  TURN_TIMEOUT_MS: 15000,
  RESULT_DISPLAY_MS: 6000,
} as const;
