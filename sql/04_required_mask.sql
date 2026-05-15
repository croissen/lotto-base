-- =====================================================
-- 필터 함수 v2: required_mask 추가 (필수 포함 번호)
-- =====================================================
-- 변경점:
--   - count_filtered, pick_filtered에 required_mask BIGINT 파라미터 추가
--   - 필터 조건: (num_mask & required_mask) = required_mask
--     → required_mask의 모든 비트가 num_mask에도 켜져 있어야 통과
--     → 즉, 그 번호들을 "전부 포함하는" 조합만 통과
--   - required_mask = 0 이면 필터 없음 (모든 조합 통과)
-- =====================================================
-- 실행: Supabase SQL Editor → 붙여넣기 → Run
-- =====================================================


-- 1. 기존 함수 삭제 (시그니처 변경이라 DROP 필수)
DROP FUNCTION IF EXISTS count_filtered(
    int, int, int, int, int, int, int, int, int, int,
    int, int, int, int, bigint
);
DROP FUNCTION IF EXISTS pick_filtered(
    int, int, int, int, int, int, int, int, int, int,
    int, int, int, int, bigint, int
);


-- 2. count_filtered — 통과 조합 개수
CREATE OR REPLACE FUNCTION count_filtered(
    r1_min INTEGER, r1_max INTEGER,
    r2_min INTEGER, r2_max INTEGER,
    r3_min INTEGER, r3_max INTEGER,
    r4_min INTEGER, r4_max INTEGER,
    r5_min INTEGER, r5_max INTEGER,
    odd_min INTEGER, odd_max INTEGER,
    sum_min INTEGER, sum_max INTEGER,
    excluded_mask BIGINT,
    required_mask BIGINT
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
      AND (num_mask & excluded_mask) = 0
      AND (num_mask & required_mask) = required_mask;
$$;


-- 3. pick_filtered — 조건 통과 조합 중 랜덤 N개
CREATE OR REPLACE FUNCTION pick_filtered(
    r1_min INTEGER, r1_max INTEGER,
    r2_min INTEGER, r2_max INTEGER,
    r3_min INTEGER, r3_max INTEGER,
    r4_min INTEGER, r4_max INTEGER,
    r5_min INTEGER, r5_max INTEGER,
    odd_min INTEGER, odd_max INTEGER,
    sum_min INTEGER, sum_max INTEGER,
    excluded_mask BIGINT,
    required_mask BIGINT,
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
      AND (num_mask & required_mask) = required_mask
    ORDER BY RANDOM()
    LIMIT pick_count;
$$;


-- 4. 권한 부여
GRANT EXECUTE ON FUNCTION count_filtered TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pick_filtered  TO anon, authenticated;


-- 5. 검증: required_mask=0 으로 호출 시 이전과 동일 결과
SELECT count_filtered(
    0,0, 0,0, 0,9999, 0,1, 27,29,
    0,6, 0,9999,
    0,  -- excluded_mask
    0   -- required_mask
) AS test_expect_932374;
