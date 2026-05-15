-- =====================================================
-- lotto_history에 당첨금/당첨자수 컬럼 추가 + RPC 시그니처 확장
-- =====================================================
-- 추가:
--   1. lotto_history에 4개 BIGINT/INTEGER 컬럼 추가 (NULL 허용)
--   2. add_lotto_round를 새 시그니처로 재생성
--      (기존 7개 숫자 + 비번 3개 + 회차 + 당첨금 4개 = 14 params)
-- =====================================================
-- 실행: Supabase SQL Editor에서 통째로 Run
-- =====================================================


-- 1) 컬럼 추가
ALTER TABLE lotto_history
    ADD COLUMN IF NOT EXISTS first_prize_amount   BIGINT,
    ADD COLUMN IF NOT EXISTS first_prize_winners  INTEGER,
    ADD COLUMN IF NOT EXISTS second_prize_amount  BIGINT,
    ADD COLUMN IF NOT EXISTS second_prize_winners INTEGER;


-- 2) 기존 add_lotto_round 함수 삭제 (시그니처 변경)
DROP FUNCTION IF EXISTS add_lotto_round(
    TEXT, TEXT, TEXT,
    INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER
);


-- 3) 새 add_lotto_round — 당첨금 4개 파라미터 추가 (NULL 허용)
CREATE OR REPLACE FUNCTION add_lotto_round(
    p_pw1     TEXT,
    p_pw2     TEXT,
    p_pw3     TEXT,
    p_round_no INTEGER,
    p_n1 INTEGER, p_n2 INTEGER, p_n3 INTEGER,
    p_n4 INTEGER, p_n5 INTEGER, p_n6 INTEGER,
    p_bonus INTEGER,
    p_first_amount    BIGINT  DEFAULT NULL,
    p_first_winners   INTEGER DEFAULT NULL,
    p_second_amount   BIGINT  DEFAULT NULL,
    p_second_winners  INTEGER DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '180s'
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

    -- (2) lotto_history INSERT (당첨금 정보 포함)
    INSERT INTO lotto_history (
        round_no, n1, n2, n3, n4, n5, n6, bonus,
        first_prize_amount, first_prize_winners,
        second_prize_amount, second_prize_winners,
        drawn_at
    )
    VALUES (
        p_round_no, p_n1, p_n2, p_n3, p_n4, p_n5, p_n6, p_bonus,
        p_first_amount, p_first_winners,
        p_second_amount, p_second_winners,
        NOW()
    );

    -- (3) 비트마스크 계산
    win_mask := (1::BIGINT << (p_n1 - 1))
              | (1::BIGINT << (p_n2 - 1))
              | (1::BIGINT << (p_n3 - 1))
              | (1::BIGINT << (p_n4 - 1))
              | (1::BIGINT << (p_n5 - 1))
              | (1::BIGINT << (p_n6 - 1));
    bonus_mask := 1::BIGINT << (p_bonus - 1);

    -- (4) combinations rank 카운트 갱신 (3개 이상 일치 행만)
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

GRANT EXECUTE ON FUNCTION add_lotto_round(
    TEXT, TEXT, TEXT, INTEGER,
    INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER,
    INTEGER, BIGINT, INTEGER, BIGINT, INTEGER
) TO anon, authenticated;


-- 4) 검증: 컬럼 확인
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'lotto_history'
ORDER BY ordinal_position;
