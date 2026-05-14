"""
압축 변환 + Supabase 업로드 (num_mask 방식)

기존 lotto_cache.npz를 읽어서:
  1. 6개 숫자 → num_mask 비트마스크로 변환
  2. odd_count, sum_total 계산
  3. 압축 CSV 생성 (combinations_compressed.csv)
  4. Supabase combinations 테이블에 COPY 업로드

요구사항:
  pip install numpy psycopg2-binary python-dotenv

실행 전 준비:
  1. Supabase SQL Editor에서 sql/02_schema_compressed.sql 실행 (테이블 재생성)
  2. .env.local에 SUPABASE_DB_URL 있어야 함

실행:
  python compress_upload.py
"""

import os
import sys
import time

try:
    import numpy as np
    from dotenv import load_dotenv
    import psycopg2
except ImportError:
    print("[X] 패키지 설치 필요: pip install numpy psycopg2-binary python-dotenv")
    sys.exit(1)


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))           # tools/
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)                        # lottobase/
CACHE_PATH = os.path.join(SCRIPT_DIR, "lotto_cache.npz")
ENV_PATH = os.path.join(PROJECT_ROOT, ".env.local")              # 프로젝트 루트의 .env.local
CSV_PATH = os.path.join(SCRIPT_DIR, "combinations_compressed.csv")


def mask_to_numbers(mask):
    """num_mask(비트마스크) → 6개 숫자 리스트. 검증용."""
    return [i + 1 for i in range(45) if mask & (1 << i)]


def main():
    # 1. 환경변수
    if not os.path.exists(ENV_PATH):
        print(f"[X] .env.local 파일이 없습니다: {ENV_PATH}")
        sys.exit(1)
    load_dotenv(ENV_PATH)
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[X] .env.local에 SUPABASE_DB_URL이 없습니다.")
        sys.exit(1)

    # 2. 캐시 로드
    if not os.path.exists(CACHE_PATH):
        print(f"[X] 캐시 없음: {CACHE_PATH}")
        print("    먼저 'python lotto_filter.py'를 실행하세요.")
        sys.exit(1)

    print(f"[+] 캐시 로드 중...")
    data = np.load(CACHE_PATH)
    combos = data["combos"]      # (8M, 6) int8, 값 1~45
    rank1 = data["rank1"]
    rank2 = data["rank2"]
    rank3 = data["rank3"]
    rank4 = data["rank4"]
    rank5 = data["rank5"]
    n = len(combos)
    print(f"    {n:,}개 조합 로드됨")

    # 3. num_mask 변환 (비트마스크)
    #    번호 N → 비트 (N-1).  6개 OR 연산.
    print(f"[+] num_mask 비트마스크 변환 중...")
    t0 = time.time()
    num_mask = np.zeros(n, dtype=np.int64)
    for col in range(6):
        num_mask |= (np.int64(1) << (combos[:, col].astype(np.int64) - 1))
    odd_count = (combos % 2 == 1).sum(axis=1).astype(np.int16)
    sum_total = combos.sum(axis=1).astype(np.int16)
    print(f"    완료 ({time.time()-t0:.1f}초)")

    # 변환 검증: 첫 조합이 제대로 인코딩됐는지
    check = mask_to_numbers(int(num_mask[0]))
    original = sorted(combos[0].tolist())
    if check == original:
        print(f"    검증 OK: {original} ↔ mask {num_mask[0]}")
    else:
        print(f"    [X] 검증 실패! {original} != {check}")
        sys.exit(1)

    # 4. 압축 CSV 작성
    print(f"[+] 압축 CSV 작성 중 → {CSV_PATH}")
    t0 = time.time()
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        f.write("num_mask,rank1_count,rank2_count,rank3_count,"
                "rank4_count,rank5_count,odd_count,sum_total\n")
        chunk = 200_000
        for start in range(0, n, chunk):
            end = min(start + chunk, n)
            for i in range(start, end):
                f.write(f"{num_mask[i]},{rank1[i]},{rank2[i]},{rank3[i]},"
                        f"{rank4[i]},{rank5[i]},{odd_count[i]},{sum_total[i]}\n")
            print(f"    {end:,}/{n:,}", end="\r")
    size_mb = os.path.getsize(CSV_PATH) / (1024 * 1024)
    print(f"\n    완료 ({time.time()-t0:.1f}초, {size_mb:.1f} MB)")

    # 5. Supabase 연결
    print(f"[+] Supabase 연결 중...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
    except Exception as e:
        print(f"[X] 연결 실패: {e}")
        sys.exit(1)
    print(f"    연결 성공")
    cur = conn.cursor()

    # 6. 기존 데이터 확인
    try:
        cur.execute("SELECT COUNT(*) FROM combinations")
    except Exception as e:
        print(f"[X] combinations 테이블 조회 실패: {e}")
        print("    먼저 sql/02_schema_compressed.sql을 실행했는지 확인하세요.")
        sys.exit(1)
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"[!] 기존 데이터 {existing:,}행 발견")
        ans = input("    삭제하고 새로 업로드? (y/n): ").strip().lower()
        if ans != "y":
            print("[-] 취소됨")
            sys.exit(0)
        cur.execute("TRUNCATE combinations")
        conn.commit()
        print(f"    기존 데이터 삭제 완료")

    # 7. COPY 업로드
    print(f"[+] 업로드 시작 (COPY FROM STDIN)...")
    t0 = time.time()
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        cur.copy_expert(
            "COPY combinations (num_mask, rank1_count, rank2_count, "
            "rank3_count, rank4_count, rank5_count, odd_count, sum_total) "
            "FROM STDIN WITH (FORMAT CSV, HEADER TRUE)",
            f
        )
    conn.commit()
    elapsed = time.time() - t0

    # 8. 결과 확인
    cur.execute("SELECT COUNT(*) FROM combinations")
    count = cur.fetchone()[0]
    cur.execute("SELECT pg_size_pretty(pg_total_relation_size('combinations'))")
    table_size = cur.fetchone()[0]
    cur.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
    db_size = cur.fetchone()[0]

    # 평균값 검증
    cur.execute("""
        SELECT
            AVG(rank4_count)::numeric(10,3),
            AVG(rank5_count)::numeric(10,3),
            AVG(odd_count)::numeric(10,3),
            AVG(sum_total)::numeric(10,1)
        FROM combinations
    """)
    stats = cur.fetchone()

    # num_mask 디코딩 샘플 (실제 DB 값으로)
    cur.execute("SELECT num_mask FROM combinations LIMIT 3")
    samples = cur.fetchall()

    cur.close()
    conn.close()

    print(f"\n" + "=" * 50)
    print(f"[+] 압축 업로드 완료!")
    print(f"=" * 50)
    print(f"    소요 시간: {elapsed:.1f}초")
    print(f"    업로드된 행: {count:,}")
    print(f"    테이블 크기: {table_size}  (이전 643MB)")
    print(f"    전체 DB 크기: {db_size}")
    print(f"\n[검증 — 평균값]")
    print(f"    rank4 평균: {stats[0]} (이론값 1.667)")
    print(f"    rank5 평균: {stats[1]} (이론값 27.42)")
    print(f"    odd 평균:   {stats[2]} (이론값 3.067)")
    print(f"    sum 평균:   {stats[3]} (이론값 138)")
    print(f"\n[검증 — num_mask 디코딩 샘플]")
    for (m,) in samples:
        print(f"    mask {m} → {mask_to_numbers(int(m))}")
    print(f"\n다음 단계: PostgreSQL 필터 함수 만들기")


if __name__ == "__main__":
    main()
