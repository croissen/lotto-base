import { supabase } from './supabase';

const LAST_VISIT_KEY = 'lottobase-last-visit';

/** 방문 기록. 페이지 첫 로드 시 1회 호출. */
export async function recordVisit() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const lastVisit = localStorage.getItem(LAST_VISIT_KEY);
    const isUnique = lastVisit !== today;

    await supabase.rpc('increment_visit', { is_unique: isUnique });

    if (isUnique) {
      localStorage.setItem(LAST_VISIT_KEY, today);
    }
  } catch {
    // 방문 기록 실패는 사이트 기능에 영향 없으므로 무시
  }
}

/** 최근 N일 방문 통계. 관리자 페이지에서 호출. */
export async function getVisitStats(daysBack = 30) {
  const { data, error } = await supabase.rpc('get_visit_stats', {
    days_back: daysBack,
  });
  if (error) throw error;
  return data ?? [];
}
