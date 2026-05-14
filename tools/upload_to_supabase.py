"""
Supabase 직접 업로드 스크립트
combinations.csv → Supabase combinations 테이블 (COPY 방식, 1~3분)

요구사항:
  pip install psycopg2-binary python-dotenv

실행 전 준비:
  1. lotto_filter.py 실행 → 캐시 생성
  2. export_to_csv.py 실행 → combinations.csv 생성
  3. .env.local에 SUPABASE_DB_URL 추가

실행:
  python upload_to_supabase.py
"""

import os
import sys
import time

try:
    from dotenv import load_dotenv
    import psycopg2
except ImportError:
    print("[X] 필요한 패키지가 설치되어 있지 않습니다.")
    print("    설치 명령: pip install psycopg2-binary python-dotenv")
    sys.exit(1)


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(SCRIPT_DIR, "combinations.csv")
ENV_PATH = os.path.join(SCRIPT_DIR, ".env.local")


def main():
    # 1. 환경 변수 로드
    if not os.path.exists(ENV_PATH):
        print(f"[X] .env.local 파일이 없습니다: {ENV_PATH}")
        sys.exit(1)

    load_dotenv(ENV_PATH)
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[X] .env.local에 SUPABASE_DB_URL이 없습니다.")
        print("    아래 형식으로 추가하세요:")
        print("    SUPABASE_DB_URL=postgresql://postgres:비밀번호@db.xxxxx.supabase.co:5432/postgres")
        sys.exit(1)

    # 2. CSV 파일 확인
    if not os.path.exists(CSV_PATH):
        print(f"[X] CSV 파일이 없습니다: {CSV_PATH}")
        print("    먼저 'python export_to_csv.py'를 실행하세요.")
        sys.exit(1)

    csv_size_mb = os.path.getsize(CSV_PATH) / (1024 * 1024)
    print(f"[+] CSV 파일 발견: {csv_size_mb:.1f} MB")

    # 3. Supabase 연결
    print(f"[+] Supabase에 연결 중...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
    except Exception as e:
        print(f"[X] 연결 실패: {e}")
        print("    .env.local의 SUPABASE_DB_URL이 정확한지 확인하세요.")
        sys.exit(1)
    print(f"    연결 성공")

    cur = conn.cursor()

    # 4. 기존 데이터 확인
    cur.execute("SELECT COUNT(*) FROM combinations")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"[!] 기존 데이터 발견: {existing:,}개 행")
        ans = input("    기존 데이터를 모두 삭제하고 새로 업로드? (y/n): ").strip().lower()
        if ans != "y":
            print("[-] 취소됨")
            sys.exit(0)
        print(f"[+] 기존 데이터 삭제 중...")
        cur.execute("TRUNCATE combinations")
        conn.commit()
        print(f"    삭제 완료")

    # 5. COPY 실행
    print(f"[+] 업로드 시작 (COPY FROM STDIN)... 1~3분 소요")
    t0 = time.time()
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        cur.copy_expert(
            "COPY combinations (combo_id, n1, n2, n3, n4, n5, n6, "
            "rank1_count, rank2_count, rank3_count, rank4_count, rank5_count, "
            "odd_count, sum_total) FROM STDIN WITH (FORMAT CSV, HEADER TRUE)",
            f
        )
    conn.commit()
    elapsed = time.time() - t0

    # 6. 결과 확인
    cur.execute("SELECT COUNT(*) FROM combinations")
    count = cur.fetchone()[0]

    # 빠른 통계
    cur.execute("""
        SELECT
            AVG(rank4_count)::numeric(10,3) AS rank4_mean,
            AVG(rank5_count)::numeric(10,3) AS rank5_mean,
            AVG(odd_count)::numeric(10,3)   AS odd_mean,
            AVG(sum_total)::numeric(10,1)   AS sum_mean
        FROM combinations
    """)
    stats = cur.fetchone()

    cur.close()
    conn.close()

    print(f"\n" + "=" * 50)
    print(f"[+] 업로드 완료!")
    print(f"=" * 50)
    print(f"    소요 시간: {elapsed:.1f}초")
    print(f"    업로드된 행: {count:,}")
    print(f"    처리 속도: {count/elapsed:,.0f} rows/sec")
    print(f"\n[검증 — 평균값 (이론값과 비교)]")
    print(f"    rank4 평균: {stats[0]} (이론값 약 1.667)")
    print(f"    rank5 평균: {stats[1]} (이론값 약 27.42)")
    print(f"    odd 평균:   {stats[2]} (이론값 약 3.067)")
    print(f"    sum 평균:   {stats[3]} (이론값 약 138)")
    print(f"\n다음 단계: PostgreSQL 필터 함수 만들기")


if __name__ == "__main__":
    main()
