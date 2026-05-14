-- =====================================================
-- MoneyRise — 필터 함수 (사이트 핵심 엔드포인트)
-- =====================================================
-- 2개 함수:
--   count_filtered() — 조건에 맞는 조합 개수 (실시간 카운터용)
--   pick_filtered()  — 조건에 맞는 조합 중 랜덤 N개 (번호 추첨용)
--
-- 제외 번호는 excluded_mask(BIGINT 비트마스크)로 전달.
--   예: 16,18,20 제외 → 2^15 + 2^17 + 2^19
--   제외 없음 → 0
-- =====================================================
-- 실행: Supabase 콘솔 → SQL Editor → 붙여넣기 → Run
-- =====================================================


-- =====================================================
-- 1. count_filtered — 통과 조합 개수
-- =====================================================
CREATE OR REPLACE FUNCTION count_filtered(
    r1_min INTEGER, r1_max INTEGER,
    r2_min INTEGER, r2_max INTEGER,
    r3_min INTEGER, r3_max INTEGER,
    r4_min INTEGER, r4_max INTEGER,
    r5_min INTEGER, r5_max INTEGER,
    odd_min INTEGER, odd_max INTEGER,
    sum_min INTEGER, sum_max INTEGER,
    excluded_mask BIGINT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
    SELECT COUNT(*)
    FROM combinations
    WHERE rank1_count BETWEEN r1_min AND r1_max
      AND rank2_count BETWEEN r2_min AND r2_max
      AND rank3_count BETWEEN r3_min AND r3_max
      AND rank4_count BETWEEN r4_min AND r4_max
      AND rank5_count BETWEEN r5_min AND r5_max
      AND odd_count   BETWEEN odd_min AND odd_max
      AND sum_total   BETWEEN sum_min AND sum_max
      AND (num_mask & excluded_mask) = 0;
$$;


-- =====================================================
-- 2. pick_filtered — 조건 통과 조합 중 랜덤 N개
-- =====================================================
CREATE OR REPLACE FUNCTION pick_filtered(
    r1_min INTEGER, r1_max INTEGER,
    r2_min INTEGER, r2_max INTEGER,
    r3_min INTEGER, r3_max INTEGER,
    r4_min INTEGER, r4_max INTEGER,
    r5_min INTEGER, r5_max INTEGER,
    odd_min INTEGER, odd_max INTEGER,
    sum_min INTEGER, sum_max INTEGER,
    excluded_mask BIGINT,
    pick_count INTEGER
)
RETURNS TABLE(
    num_mask    BIGINT,
    rank1_count SMALLINT,
    rank2_count SMALLINT,
    rank3_count SMALLINT,
    rank4_count SMALLINT,
    rank5_count SMALLINT,
    odd_count   SMALLINT,
    sum_total   SMALLINT
)
LANGUAGE sql
VOLATILE
AS $$
    SELECT
        num_mask, rank1_count, rank2_count, rank3_count,
        rank4_count, rank5_count, odd_count, sum_total
    FROM combinations
    WHERE rank1_count BETWEEN r1_min AND r1_max
      AND rank2_count BETWEEN r2_min AND r2_max
      AND rank3_count BETWEEN r3_min AND r3_max
      AND rank4_count BETWEEN r4_min AND r4_max
      AND rank5_count BETWEEN r5_min AND r5_max
      AND odd_count   BETWEEN odd_min AND odd_max
      AND sum_total   BETWEEN sum_min AND sum_max
      AND (num_mask & excluded_mask) = 0
    ORDER BY RANDOM()
    LIMIT pick_count;
$$;


-- =====================================================
-- 3. 권한 부여 (anon/로그인 사용자가 호출 가능하도록)
-- =====================================================
GRANT EXECUTE ON FUNCTION count_filtered TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pick_filtered  TO anon, authenticated;


-- =====================================================
-- 4. 검증 테스트 — 회차님 Python 결과와 비교
-- =====================================================

-- 테스트 A: 등수 필터만 (Python 결과: 932,374)
--   1등=0~0, 2등=0~0, 3등=무제한, 4등=0~1, 5등=27~29
SELECT count_filtered(
    0, 0,        -- rank1
    0, 0,        -- rank2
    0, 9999,     -- rank3 (무제한)
    0, 1,        -- rank4
    27, 29,      -- rank5
    0, 6,        -- odd (무제한)
    0, 9999,     -- sum (무제한)
    0            -- 제외 없음
) AS test_a_expect_932374;

-- 테스트 B: 홀짝만 3:3 (Python 결과: 2,727,340)
SELECT count_filtered(
    0, 9999, 0, 9999, 0, 9999, 0, 9999, 0, 9999,
    3, 3,        -- odd = 3:3
    0, 9999,
    0
) AS test_b_expect_2727340;

-- 테스트 C: pick_filtered로 3개 뽑기
SELECT * FROM pick_filtered(
    0, 0, 0, 0, 0, 9999, 0, 1, 27, 29,
    0, 6, 0, 9999,
    0,
    3            -- 3개 추첨
);
