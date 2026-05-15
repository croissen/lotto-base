// num_mask(비트마스크) ↔ 6개 숫자 변환 + 로또 공 색상
//
// num_mask: 번호 N → 비트 (N-1). 6개 번호의 비트를 OR한 값.
// 최대 비트 44(번호 45)까지 → 2^45 미만 → JS 안전정수 범위.
// 단, JS 비트연산자(&, <<, >>)는 32비트 한정이므로 BigInt 사용 필수.

import { supabase } from './supabase';

/** num_mask → 정렬된 6개 숫자 배열. 예: 63 → [1,2,3,4,5,6] */
export function maskToNumbers(mask) {
  const m = BigInt(mask);
  const nums = [];
  for (let i = 0n; i < 45n; i++) {
    if ((m >> i) & 1n) nums.push(Number(i) + 1);
  }
  return nums;
}

/** 숫자 배열 → num_mask (제외 번호 → excluded_mask 만들 때 사용) */
export function numbersToMask(numbers) {
  let mask = 0n;
  for (const n of numbers) {
    mask |= 1n << BigInt(n - 1);
  }
  return Number(mask); // 2^45 미만이라 Number로 안전, RPC 전달 가능
}

/** 한국 로또 공 색상 (구간별) */
export function getBallColor(n) {
  if (n <= 10) return '#fbc400';
  if (n <= 20) return '#69c8f2';
  if (n <= 30) return '#ff7272';
  if (n <= 40) return '#aaaaaa';
  return '#b0d840';
}

// 모듈 캐시 — 같은 세션에서 여러 컴포넌트가 호출해도 1번만 fetch
let historyCache = null;
let historyPromise = null;

/**
 * lotto_history 테이블에서 역대 회차 데이터를 가져옴.
 * 기존 lotto.json과 동일 키 형식(회차, 번호1~6, 보너스)으로 변환해 반환.
 */
export async function fetchLottoHistory() {
  if (historyCache) return historyCache;
  if (historyPromise) return historyPromise;

  // Supabase는 기본 1,000행 제한이라 .range()로 페이지네이션
  const PAGE_SIZE = 1000;
  historyPromise = (async () => {
    try {
      const all = [];
      let page = 0;
      while (true) {
        const start = page * PAGE_SIZE;
        const end = start + PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('lotto_history')
          .select('round_no, n1, n2, n3, n4, n5, n6, bonus')
          .order('round_no', { ascending: false })
          .range(start, end);
        if (error) {
          console.error('[fetchLottoHistory] Supabase 에러:', error);
          throw error;
        }
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE_SIZE) break;
        page++;
      }
      if (all.length === 0) {
        console.warn('[fetchLottoHistory] 빈 결과. RLS / 마이그레이션 확인 필요.');
        historyPromise = null;
        return [];
      }
      console.log(`[fetchLottoHistory] ${all.length}개 회차 로드됨 (${page + 1}페이지)`);
      historyCache = all.map((r) => ({
        회차: r.round_no,
        번호1: r.n1, 번호2: r.n2, 번호3: r.n3,
        번호4: r.n4, 번호5: r.n5, 번호6: r.n6,
        보너스: r.bonus,
      }));
      return historyCache;
    } catch (err) {
      historyPromise = null;
      throw err;
    }
  })();

  return historyPromise;
}

/** 회차 추가 후 캐시 무효화 (관리자 페이지에서 사용) */
export function invalidateHistoryCache() {
  historyCache = null;
  historyPromise = null;
}
