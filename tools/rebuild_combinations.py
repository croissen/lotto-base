# -*- coding: utf-8 -*-
"""
combinations 테이블 무손실 재적재 (bloat 0) — 캐시 증분판

핵심:
  - rank 카운트는 회차 수만큼 계산이 필요해 "전체 재계산"은 본질적으로 몇 분 걸린다.
  - 그래서 로컬 캐시(rebuild_cache.npz)에 현재까지의 rank와 "이미 반영한 회차"를 저장.
    다음부터는 DB에 새로 생긴 회차 1~N개분만 더해서(증분) 계산 → 주간 실행 ~40초.
  - 과거 회차가 수정/삭제되면 캐시와 DB가 어긋나므로 자동으로 전체 재계산(안전 폴백).
  - 계산은 num_mask 비트마스크 + np.bitwise_count(popcount) 벡터연산.

무손실 재적재:
  제자리 UPDATE 없이 TRUNCATE + COPY 로 통째 교체 → 죽은 행 0 → 항상 깨끗한 ~400MB.

진실의 원천:
  DB lotto_history. 재적재 후 public/lotto.json 동기화.

실행:
  python tools/rebuild_combinations.py
"""
import io
import json
import os
import sys
import time
from itertools import combinations

try:
    import numpy as np
    import psycopg2
    from dotenv import load_dotenv
except ImportError:
    print("[X] 패키지 필요: pip install numpy psycopg2-binary python-dotenv")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ENV_PATH = os.path.join(PROJECT_ROOT, ".env.local")
JSON_PATH = os.path.join(PROJECT_ROOT, "public", "lotto.json")
CACHE_PATH = os.path.join(SCRIPT_DIR, "rebuild_cache.npz")

TOTAL_COMBOS = 8_145_060  # C(45,6)
HAS_POPCOUNT = hasattr(np, "bitwise_count")


def get_db_url():
    if not os.path.exists(ENV_PATH):
        print(f"[X] .env.local 없음: {ENV_PATH}")
        sys.exit(1)
    load_dotenv(ENV_PATH)
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        print("[X] .env.local에 SUPABASE_DB_URL이 없습니다.")
        sys.exit(1)
    return url


def fetch_history(cur):
    cur.execute(
        "SELECT round_no, n1, n2, n3, n4, n5, n6, bonus "
        "FROM lotto_history ORDER BY round_no"
    )
    rows = cur.fetchall()
    if not rows:
        print("[X] lotto_history가 비어 있습니다.")
        sys.exit(1)
    print(f"[+] DB에서 {len(rows)}개 회차 로드 (최신 {rows[-1][0]}회)")
    return [tuple(int(x) for x in r) for r in rows]


def generate_masks():
    print("[+] 800만 조합/마스크 생성 중...")
    t0 = time.time()
    combos = np.fromiter(
        (x for c in combinations(range(1, 46), 6) for x in c),
        dtype=np.int8, count=TOTAL_COMBOS * 6,
    ).reshape(-1, 6)
    num_mask = np.zeros(TOTAL_COMBOS, dtype=np.int64)
    for col in range(6):
        num_mask |= (np.int64(1) << (combos[:, col].astype(np.int64) - 1))
    odd_count = (combos % 2 == 1).sum(axis=1).astype(np.int16)
    sum_total = combos.sum(axis=1).astype(np.int16)
    print(f"    완료 ({time.time() - t0:.1f}초)")
    return num_mask, odd_count, sum_total


def apply_rounds(num_mask, rank, rounds):
    """rounds(각 (round,n1..n6,bonus))를 rank[0..4]에 누적."""
    for row in rounds:
        winners = row[1:7]
        bonus = row[7]
        win_mask = 0
        for w in winners:
            win_mask |= (1 << (w - 1))
        bonus_mask = 1 << (bonus - 1)
        anded = num_mask & np.int64(win_mask)
        if HAS_POPCOUNT:
            matches = np.bitwise_count(anded)
        else:
            matches = np.unpackbits(anded.astype(np.uint64).view(np.uint8).reshape(-1, 8), axis=1).sum(axis=1)
        has_bonus = (num_mask & np.int64(bonus_mask)) != 0
        is5 = matches == 5
        rank[0] += (matches == 6)
        rank[1] += (is5 & has_bonus)
        rank[2] += (is5 & ~has_bonus)
        rank[3] += (matches == 4)
        rank[4] += (matches == 3)


def load_cache():
    if not os.path.exists(CACHE_PATH):
        return None
    try:
        d = np.load(CACHE_PATH)
        applied = {int(r[0]): tuple(int(x) for x in r[1:8]) for r in d["applied"]}
        return {
            "num_mask": d["num_mask"], "odd": d["odd"], "sum": d["sum"],
            "rank": [d["r1"].copy(), d["r2"].copy(), d["r3"].copy(), d["r4"].copy(), d["r5"].copy()],
            "applied": applied,
        }
    except Exception as e:
        print(f"[!] 캐시 로드 실패({e}) → 전체 재계산")
        return None


def save_cache(num_mask, odd, sm, rank, history):
    applied = np.array([[r[0], *r[1:8]] for r in history], dtype=np.int32)
    np.savez_compressed(
        CACHE_PATH, num_mask=num_mask, odd=odd, sum=sm,
        r1=rank[0], r2=rank[1], r3=rank[2], r4=rank[3], r5=rank[4],
        applied=applied,
    )


def build_csv(num_mask, odd, sm, rank):
    print("[+] CSV 생성 중...")
    t0 = time.time()
    arr = np.column_stack([num_mask, rank[0], rank[1], rank[2], rank[3], rank[4], odd, sm])
    buf = io.StringIO()
    np.savetxt(buf, arr, fmt="%d", delimiter=",")
    buf.seek(0)
    print(f"    완료 ({time.time() - t0:.1f}초)")
    return buf


def reload_table(conn, cur, csv_buf):
    print("[+] combinations TRUNCATE + COPY 재적재 중...")
    t0 = time.time()
    cur.execute("TRUNCATE combinations")
    conn.commit()
    cur.copy_expert(
        "COPY combinations (num_mask, rank1_count, rank2_count, rank3_count, "
        "rank4_count, rank5_count, odd_count, sum_total) "
        "FROM STDIN WITH (FORMAT CSV, HEADER FALSE)",
        csv_buf,
    )
    conn.commit()
    print(f"    완료 ({time.time() - t0:.1f}초)")


def sync_lotto_json(history):
    data = [
        {"회차": r[0], "번호1": r[1], "번호2": r[2], "번호3": r[3],
         "번호4": r[4], "번호5": r[5], "번호6": r[6], "보너스": r[7]}
        for r in history
    ]
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"[+] public/lotto.json 동기화 완료 ({len(data)}회차)")


def main():
    db_url = get_db_url()
    print("[+] Supabase 연결 중...")
    conn = psycopg2.connect(db_url, connect_timeout=10)
    cur = conn.cursor()
    print("    연결 성공")

    history = fetch_history(cur)
    db_map = {r[0]: r[1:8] for r in history}

    cache = load_cache()
    t0 = time.time()
    if cache is None:
        num_mask, odd, sm = generate_masks()
        rank = [np.zeros(TOTAL_COMBOS, dtype=np.int16) for _ in range(5)]
        to_apply = history
        mode = "전체(캐시 없음)"
    else:
        num_mask, odd, sm = cache["num_mask"], cache["odd"], cache["sum"]
        applied = cache["applied"]
        stale = any(rd not in db_map or db_map[rd] != nums for rd, nums in applied.items())
        if stale:
            rank = [np.zeros(TOTAL_COMBOS, dtype=np.int16) for _ in range(5)]
            to_apply = history
            mode = "전체(과거 회차 변경 감지)"
        else:
            rank = cache["rank"]
            to_apply = [r for r in history if r[0] not in applied]
            mode = f"증분(+{len(to_apply)}회)"

    print(f"[+] rank 계산 방식: {mode}, {'popcount' if HAS_POPCOUNT else '폴백'}")
    apply_rounds(num_mask, rank, to_apply)
    print(f"    rank 계산 완료 ({time.time() - t0:.1f}초, 적용 {len(to_apply)}회차)")

    csv_buf = build_csv(num_mask, odd, sm, rank)
    reload_table(conn, cur, csv_buf)

    print("[+] 캐시 저장 중...")
    save_cache(num_mask, odd, sm, rank, history)

    cur.execute("SELECT COUNT(*) FROM combinations")
    cnt = cur.fetchone()[0]
    cur.execute("SELECT n_dead_tup FROM pg_stat_user_tables WHERE relname='combinations'")
    dead = cur.fetchone()
    cur.execute("SELECT pg_size_pretty(pg_total_relation_size('combinations'))")
    tbl = cur.fetchone()[0]
    cur.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
    db = cur.fetchone()[0]
    cur.execute("SELECT AVG(rank5_count)::numeric(10,3), AVG(odd_count)::numeric(10,3), AVG(sum_total)::numeric(10,1) FROM combinations")
    avg5, avgodd, avgsum = cur.fetchone()

    sync_lotto_json(history)
    cur.close()
    conn.close()

    print("\n" + "=" * 50)
    print("[+] 재적재 완료 (bloat 0)")
    print("=" * 50)
    print(f"    행 수:        {cnt:,}")
    print(f"    죽은 행:      {dead[0] if dead else 0}")
    print(f"    테이블 크기:  {tbl}")
    print(f"    전체 DB:      {db}")
    print(f"    rank5 평균:   {avg5} (이론값 27.42)")
    print(f"    odd 평균:     {avgodd} (이론값 3.067)")
    print(f"    sum 평균:     {avgsum} (이론값 138)")


if __name__ == "__main__":
    main()
