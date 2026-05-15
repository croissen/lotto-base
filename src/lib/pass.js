// 이용권(패스) 관리 — localStorage 기반.
// 주의: 기기/브라우저별로 저장됨. 로그인 없으니 폰↔PC 공유 안 됨.

const KEY = 'lottobase-pass';

/** 패스 만료 시각(ms timestamp). 없으면 0. */
export function getPassExpiry() {
  const v = localStorage.getItem(KEY);
  const n = v ? parseInt(v, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

/** 현재 유효한 패스 보유 여부 */
export function hasValidPass() {
  return getPassExpiry() > Date.now();
}

/** hours 시간짜리 패스 발급 */
export function grantPass(hours = 24) {
  const expiry = Date.now() + hours * 3600 * 1000;
  localStorage.setItem(KEY, String(expiry));
  return expiry;
}

/** 남은 시간 (밀리초). 없으면 0. */
export function getPassRemaining() {
  return Math.max(0, getPassExpiry() - Date.now());
}
