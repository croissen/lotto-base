"""
public/lotto.json → Supabase lotto_history 테이블로 일회성 마이그레이션

선행:
  1. sql/05_admin_and_history.sql 실행됨 (lotto_history RLS 정책 포함)
  2. .env.local의 SUPABASE_DB_URL 설정됨

실행:
  python tools/migrate_history_to_db.py

소요: 약 5~10초
"""

import os
import sys
import json
import time

try:
    from dotenv import load_dotenv
    import psycopg2
except ImportError:
    print("[X] 패키지 설치 필요: pip install psycopg2-binary python-dotenv")
    sys.exit(1)


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
JSON_PATH = os.path.join(PROJECT_ROOT, "public", "lotto.json")
ENV_PATH = os.path.join(PROJECT_ROOT, ".env.local")


def main():
    if not os.path.exists(ENV_PATH):
        print(f"[X] .env.local 없음: {ENV_PATH}")
        sys.exit(1)
    load_dotenv(ENV_PATH)
    db_url = os.getenv("SUPABASE_DB_URL")
    if not db_url:
        print("[X] .env.local에 SUPABASE_DB_URL이 없습니다.")
        sys.exit(1)

    if not os.path.exists(JSON_PATH):
        print(f"[X] lotto.json 없음: {JSON_PATH}")
        sys.exit(1)

    # JSON 로드
    with open(JSON_PATH, encoding="utf-8") as f:
        history = json.load(f)
    print(f"[+] {len(history)}개 회차 로드됨")

    # DB 연결
    print(f"[+] Supabase 연결 중...")
    conn = psycopg2.connect(db_url, connect_timeout=10)
    cur = conn.cursor()

    # 기존 데이터 확인
    cur.execute("SELECT COUNT(*) FROM lotto_history")
    existing = cur.fetchone()[0]
    if existing > 0:
        print(f"[!] lotto_history에 이미 {existing}행 있음.")
        ans = input("    전부 삭제하고 새로 넣을까요? (y/n): ").strip().lower()
        if ans != "y":
            print("[-] 취소")
            sys.exit(0)
        cur.execute("TRUNCATE lotto_history")
        conn.commit()
        print(f"    기존 데이터 삭제 완료")

    # INSERT (한 번에 executemany)
    print(f"[+] {len(history)}행 INSERT 중...")
    t0 = time.time()
    rows = []
    for row in history:
        rows.append((
            row["회차"],
            row["번호1"], row["번호2"], row["번호3"],
            row["번호4"], row["번호5"], row["번호6"],
            row["보너스"],
        ))
    cur.executemany(
        """
        INSERT INTO lotto_history (round_no, n1, n2, n3, n4, n5, n6, bonus)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (round_no) DO NOTHING
        """,
        rows,
    )
    conn.commit()
    elapsed = time.time() - t0

    # 결과 확인
    cur.execute("SELECT COUNT(*) FROM lotto_history")
    final_count = cur.fetchone()[0]
    cur.execute("SELECT MIN(round_no), MAX(round_no) FROM lotto_history")
    min_r, max_r = cur.fetchone()

    cur.close()
    conn.close()

    print(f"\n[+] 마이그레이션 완료!")
    print(f"    소요: {elapsed:.1f}초")
    print(f"    행 수: {final_count}")
    print(f"    회차 범위: {min_r} ~ {max_r}")


if __name__ == "__main__":
    main()
