-- =====================================================
-- MoneyRise — 로또 통계 분석 도구 DB 스키마 (LITE)
-- =====================================================
-- 무료 플랜 500MB 한도 안에 안전하게 들어가는 가벼운 버전.
-- 인덱스는 Primary Key 하나만. 필터링은 Sequential Scan (2~5초)
-- 트래픽 늘면 그때 Pro 업그레이드 + 인덱스 추가
-- =====================================================
-- 실행: Supabase 콘솔 → SQL Editor → 붙여넣기 → Run
-- =====================================================


-- =====================================================
-- 1. combinations: 800만 조합 + 등수 카운트
-- =====================================================
-- 행 수: 8,145,060 (C(45,6) 전체)
-- 예상 크기: 약 320MB (데이터) + 80MB (PK 인덱스) = 400MB
-- =====================================================

CREATE TABLE combinations (
    combo_id     INTEGER  PRIMARY KEY,
    n1           SMALLINT NOT NULL,
    n2           SMALLINT NOT NULL,
    n3           SMALLINT NOT NULL,
    n4           SMALLINT NOT NULL,
    n5           SMALLINT NOT NULL,
    n6           SMALLINT NOT NULL,
    rank1_count  SMALLINT NOT NULL,
    rank2_count  SMALLINT NOT NULL,
    rank3_count  SMALLINT NOT NULL,
    rank4_count  SMALLINT NOT NULL,
    rank5_count  SMALLINT NOT NULL,
    odd_count    SMALLINT NOT NULL,
    sum_total    SMALLINT NOT NULL
);

-- 인덱스는 PK만. 추가 인덱스는 업로드 완료 후 여유 확인하고 결정.


-- =====================================================
-- 2. lotto_history: 역대 회차 당첨번호
-- =====================================================

CREATE TABLE lotto_history (
    round_no  INTEGER  PRIMARY KEY,
    n1        SMALLINT NOT NULL,
    n2        SMALLINT NOT NULL,
    n3        SMALLINT NOT NULL,
    n4        SMALLINT NOT NULL,
    n5        SMALLINT NOT NULL,
    n6        SMALLINT NOT NULL,
    bonus     SMALLINT NOT NULL,
    drawn_at  TIMESTAMPTZ DEFAULT NOW()
);


-- =====================================================
-- 3. Row Level Security
-- =====================================================

ALTER TABLE combinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotto_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for combinations"
    ON combinations FOR SELECT
    TO anon, authenticated
    USING (true);

CREATE POLICY "Public read access for lotto_history"
    ON lotto_history FOR SELECT
    TO anon, authenticated
    USING (true);


-- =====================================================
-- 4. 검증
-- =====================================================

SELECT
    table_name,
    (SELECT count(*) FROM information_schema.columns
     WHERE table_name = t.table_name) AS column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_name IN ('combinations', 'lotto_history');
