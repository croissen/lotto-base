-- =====================================================
-- 08. bloat 근본 차단: add_lotto_round에서 800만 행 UPDATE 제거
-- =====================================================
-- 문제:
--   기존 add_lotto_round는 회차 1건당 combinations(8.14M행) 중
--   당첨번호와 3개 이상 겹치는 ~194,000행을 UPDATE 했다.
--   Postgres UPDATE = 기존 행을 죽은 행(dead tuple)으로 남기고 새 행을 씀(MVCC).
--   테이블에 인덱스가 없고 fillfactor=100(꽉 채워 적재)이라 갱신본이
--   들어갈 빈칸이 없어 전부 새 페이지로 밀려 → 회차당 ~10MB씩 파일이 부풀었다.
--   VACUUM은 재사용 표시만 할 뿐 파일을 안 줄이고, VACUUM FULL은 여유 공간이
--   부족해 500MB 한도에선 못 돌린다. => 몇 회차 만에 500MB 초과.
--
-- 해결:
--   회차 추가 시 combinations를 제자리 갱신하지 않는다.
--   add_lotto_round는 lotto_history INSERT까지만 한다(수십 바이트, bloat 없음).
--   combinations의 rank 카운트는 tools/rebuild_combinations.py 가
--   전체 재계산 후 TRUNCATE + COPY 로 통째 재적재한다(죽은 행 0).
--
-- 사용 흐름(주간):
--   1) 관리자 페이지에서 새 회차 입력 → add_lotto_round → lotto_history에만 추가
--   2) PC에서 `python tools/rebuild_combinations.py` 실행
--      → DB lotto_history 읽어 800만 rank 재계산 → 깨끗하게 재적재(~400MB)
-- =====================================================
-- 실행: Supabase SQL Editor에 통째로 붙여넣고 Run
-- =====================================================


-- 1) 기존 함수 삭제 (06에서 만든 14-파라미터 시그니처)
DROP FUNCTION IF EXISTS add_lotto_round(
    TEXT, TEXT, TEXT, INTEGER,
    INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER,
    INTEGER, BIGINT, INTEGER, BIGINT, INTEGER
);


-- 2) 새 add_lotto_round — history INSERT만. combinations는 건드리지 않음.
--    시그니처/이름 동일 → Admin 페이지 코드 수정 불필요.
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
AS $$
DECLARE
    nums INTEGER[];
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

    -- (2) lotto_history INSERT (당첨금 포함). 여기까지만.
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

    -- (3) combinations 갱신은 하지 않는다.
    --     rank 카운트 반영은 tools/rebuild_combinations.py 로 재적재.
    RETURN jsonb_build_object(
        'success', true,
        'round_no', p_round_no,
        'note', 'history 추가 완료. combinations 반영은 rebuild_combinations.py 실행 필요.'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION add_lotto_round(
    TEXT, TEXT, TEXT, INTEGER,
    INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER,
    INTEGER, BIGINT, INTEGER, BIGINT, INTEGER
) TO anon, authenticated;
