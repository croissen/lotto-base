-- =====================================================
-- MoneyRise — 압축 스키마 (num_mask 비트마스크 방식)
-- =====================================================
-- 기존 combinations 테이블을 삭제하고 압축 버전으로 재생성.
--
-- 변경점:
--   - combo_id, n1~n6 (7개 컬럼) 삭제
--   - num_mask BIGINT 1개로 대체 (6개 숫자를 비트로 인코딩)
--   - Primary Key 제거 → PK 인덱스 174MB 절약
--
-- 예상 크기: 643MB → 약 400MB (500MB 한도 안)
-- =====================================================
-- 실행: Supabase 콘솔 → SQL Editor → 붙여넣기 → Run
-- =====================================================


-- 1. 기존 테이블 삭제 (정책도 함께 삭제됨)
DROP TABLE IF EXISTS combinations CASCADE;


-- 2. 압축 스키마로 재생성
CREATE TABLE combinations (
    num_mask     BIGINT   NOT NULL,   -- 6개 숫자를 비트로 인코딩 (번호 N → 비트 N-1)
    rank1_count  SMALLINT NOT NULL,
    rank2_count  SMALLINT NOT NULL,
    rank3_count  SMALLINT NOT NULL,
    rank4_count  SMALLINT NOT NULL,
    rank5_count  SMALLINT NOT NULL,
    odd_count    SMALLINT NOT NULL,
    sum_total    SMALLINT NOT NULL
);
-- 인덱스 없음. 필터 쿼리는 Sequential Scan (2~5초).
-- 트래픽 늘면 그때 Pro 업그레이드 + 인덱스 추가.


-- 3. Row Level Security (공개 읽기만 허용)
ALTER TABLE combinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for combinations"
    ON combinations FOR SELECT
    TO anon, authenticated
    USING (true);


-- 4. 검증
SELECT
    table_name,
    (SELECT count(*) FROM information_schema.columns
     WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name = 'combinations';
