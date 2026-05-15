-- =====================================================
-- 관리자 시스템 + 회차 자동 갱신
-- =====================================================
-- 기능:
--   1. admin_credentials 테이블 + 3단계 비밀번호 SHA256 저장
--   2. verify_admin_password() — 비밀번호 검증
--   3. add_lotto_round() — 회차 추가 + 800만 조합 rank 카운트 자동 +1
--
-- 사용 흐름:
--   사용자가 /qksemtl1djr-163254 진입
--   → 1차/2차/3차 비밀번호 입력 (verify_admin_password 호출)
--   → 인증 성공 시 회차 추가 폼 표시
--   → add_lotto_round 호출 → DB가 알아서 1) history 추가 2) 800만 행 rank 갱신
-- =====================================================
-- 실행: Supabase SQL Editor → 한 번에 Run
-- =====================================================


-- 0. pgcrypto (SHA256용)
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- 1. 관리자 비밀번호 저장 테이블
DROP TABLE IF EXISTS admin_credentials CASCADE;
CREATE TABLE admin_credentials (
    stage         INTEGER PRIMARY KEY,
    password_hash TEXT    NOT NULL,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 잠금 — 어떤 클라이언트도 직접 SELECT 못 함
-- SECURITY DEFINER 함수만 접근 가능
ALTER TABLE admin_credentials ENABLE ROW LEVEL SECURITY;
-- (정책 없음 = 차단)


-- 2. 비밀번호 입력 (SHA256 해시로 저장)
INSERT INTO admin_credentials (stage, password_hash) VALUES
    (1, encode(digest('16', 'sha256'), 'hex')),
    (2, encode(digest('32', 'sha256'), 'hex')),
    (3, encode(digest('54', 'sha256'), 'hex'));


-- 3. 비밀번호 검증 함수
DROP FUNCTION IF EXISTS verify_admin_password(INTEGER, TEXT);
CREATE OR REPLACE FUNCTION verify_admin_password(
    p_stage    INTEGER,
    p_password TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER  -- admin_credentials RLS 우회용
AS $$
    SELECT EXISTS (
        SELECT 1 FROM admin_credentials
        WHERE stage = p_stage
          AND password_hash = encode(digest(p_password, 'sha256'), 'hex')
    );
$$;

GRANT EXECUTE ON FUNCTION verify_admin_password(INTEGER, TEXT) TO anon, authenticated;


-- 4. 회차 추가 + rank 카운트 자동 갱신 함수
DROP FUNCTION IF EXISTS add_lotto_round(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
CREATE OR REPLACE FUNCTION add_lotto_round(
    p_pw1     TEXT,
    p_pw2     TEXT,
    p_pw3     TEXT,
    p_round_no INTEGER,
    p_n1 INTEGER, p_n2 INTEGER, p_n3 INTEGER,
    p_n4 INTEGER, p_n5 INTEGER, p_n6 INTEGER,
    p_bonus INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '180s'  -- 8M행 UPDATE 위해 타임아웃 늘림
AS $$
DECLARE
    win_mask     BIGINT;
    bonus_mask   BIGINT;
    updated_cnt  INTEGER;
    nums         INTEGER[];
BEGIN
    -- (0) 비밀번호 3중 검증
    IF NOT verify_admin_password(1, p_pw1) THEN
        RAISE EXCEPTION '1차 비밀번호 불일치';
    END IF;
    IF NOT verify_admin_password(2, p_pw2) THEN
        RAISE EXCEPTION '2차 비밀번호 불일치';
    END IF;
    IF NOT verify_admin_password(3, p_pw3) THEN
        RAISE EXCEPTION '3차 비밀번호 불일치';
    END IF;

    -- (1) 입력 검증
    nums := ARRAY[p_n1, p_n2, p_n3, p_n4, p_n5, p_n6];

    IF p_round_no < 1 THEN
        RAISE EXCEPTION '회차 번호가 잘못됨';
    END IF;
    IF (SELECT MIN(x) FROM unnest(nums) AS x) < 1
       OR (SELECT MAX(x) FROM unnest(nums) AS x) > 45 THEN
        RAISE EXCEPTION '본번호는 1~45 사이여야 함';
    END IF;
    IF p_bonus < 1 OR p_bonus > 45 THEN
        RAISE EXCEPTION '보너스 번호는 1~45 사이여야 함';
    END IF;
    IF (SELECT COUNT(DISTINCT x) FROM unnest(nums) AS x) <> 6 THEN
        RAISE EXCEPTION '본번호 6개에 중복이 있음';
    END IF;
    IF p_bonus = ANY(nums) THEN
        RAISE EXCEPTION '보너스 번호가 본번호와 중복됨';
    END IF;
    IF EXISTS (SELECT 1 FROM lotto_history WHERE round_no = p_round_no) THEN
        RAISE EXCEPTION '회차 %는 이미 존재함', p_round_no;
    END IF;

    -- (2) lotto_history INSERT
    INSERT INTO lotto_history (round_no, n1, n2, n3, n4, n5, n6, bonus, drawn_at)
    VALUES (p_round_no, p_n1, p_n2, p_n3, p_n4, p_n5, p_n6, p_bonus, NOW());

    -- (3) 비트마스크 계산
    win_mask := (1::BIGINT << (p_n1 - 1))
              | (1::BIGINT << (p_n2 - 1))
              | (1::BIGINT << (p_n3 - 1))
              | (1::BIGINT << (p_n4 - 1))
              | (1::BIGINT << (p_n5 - 1))
              | (1::BIGINT << (p_n6 - 1));
    bonus_mask := 1::BIGINT << (p_bonus - 1);

    -- (4) combinations 테이블에서 3개 이상 일치하는 행만 골라 rank 카운트 +1
    --     bit_count(int8send(...))로 1비트 개수 계산
    WITH affected AS (
        SELECT num_mask,
               bit_count(int8send(num_mask & win_mask))  AS pop,
               (num_mask & bonus_mask) <> 0              AS has_bonus
        FROM combinations
        WHERE bit_count(int8send(num_mask & win_mask)) >= 3
    )
    UPDATE combinations c SET
        rank1_count = c.rank1_count + (CASE WHEN a.pop = 6 THEN 1 ELSE 0 END)::smallint,
        rank2_count = c.rank2_count + (CASE WHEN a.pop = 5 AND a.has_bonus THEN 1 ELSE 0 END)::smallint,
        rank3_count = c.rank3_count + (CASE WHEN a.pop = 5 AND NOT a.has_bonus THEN 1 ELSE 0 END)::smallint,
        rank4_count = c.rank4_count + (CASE WHEN a.pop = 4 THEN 1 ELSE 0 END)::smallint,
        rank5_count = c.rank5_count + (CASE WHEN a.pop = 3 THEN 1 ELSE 0 END)::smallint
    FROM affected a
    WHERE c.num_mask = a.num_mask;

    GET DIAGNOSTICS updated_cnt = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'round_no', p_round_no,
        'rows_updated', updated_cnt
    );
END;
$$;

GRANT EXECUTE ON FUNCTION add_lotto_round(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO anon, authenticated;


-- 5. lotto_history RLS: 익명 SELECT 허용 (이미 02에서 만들었으면 무시)
ALTER TABLE lotto_history ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'lotto_history'
          AND policyname = 'Public read access for lotto_history'
    ) THEN
        CREATE POLICY "Public read access for lotto_history"
            ON lotto_history FOR SELECT
            TO anon, authenticated
            USING (true);
    END IF;
END $$;


-- 6. 검증
SELECT
    (SELECT COUNT(*) FROM admin_credentials)  AS admin_pw_count,
    verify_admin_password(1, '16')            AS test_pw1,
    verify_admin_password(2, '32')            AS test_pw2,
    verify_admin_password(3, '54')            AS test_pw3,
    verify_admin_password(1, '99')            AS test_wrong;
