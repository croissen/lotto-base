"""
Supabase 업로드용 CSV 생성 스크립트

입력: lotto_cache.npz (lotto_filter.py 실행 후 생성된 캐시)
출력: combinations.csv (800만 행, Supabase 업로드용)

실행:
  python export_to_csv.py

소요 시간: 약 30~90초
출력 파일 크기: 약 200~300MB
"""

import os
import sys
import time

try:
    import numpy as np
except ImportError:
    print("[X] numpy가 설치되어 있지 않습니다.  pip install numpy")
    sys.exit(1)


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CACHE_PATH = os.path.join(SCRIPT_DIR, "lotto_cache.npz")
OUT_PATH = os.path.join(SCRIPT_DIR, "combinations.csv")


def main():
    # 1. 캐시 로드
    if not os.path.exists(CACHE_PATH):
        print(f"[X] 캐시 파일이 없습니다: {CACHE_PATH}")
        print("    먼저 'python lotto_filter.py'를 실행해서 캐시를 만드세요.")
        sys.exit(1)

    print(f"[+] 캐시 로드 중 → {CACHE_PATH}")
    t0 = time.time()
    data = np.load(CACHE_PATH)
    combos = data["combos"]           # (8M, 6) int8
    rank1 = data["rank1"]             # (8M,) int16
    rank2 = data["rank2"]
    rank3 = data["rank3"]
    rank4 = data["rank4"]
    rank5 = data["rank5"]
    n = len(combos)
    print(f"    {n:,}개 조합 로드됨 ({time.time()-t0:.1f}초)")

    # 2. 추가 컬럼 계산
    print(f"[+] odd_count, sum_total 계산 중...")
    t0 = time.time()
    odd_count = (combos % 2 == 1).sum(axis=1).astype(np.int16)
    sum_total = combos.sum(axis=1).astype(np.int16)
    print(f"    완료 ({time.time()-t0:.1f}초)")
    print(f"    odd_count 범위: {odd_count.min()} ~ {odd_count.max()}")
    print(f"    sum_total 범위: {sum_total.min()} ~ {sum_total.max()}")

    # 3. CSV 저장 (numpy savetxt는 느려서 직접 작성)
    print(f"[+] CSV 작성 중 → {OUT_PATH}")
    t0 = time.time()

    # numpy 배열들을 하나로 묶기 (메모리 효율적)
    # 행 단위로 직접 쓰기
    with open(OUT_PATH, "w", encoding="utf-8", newline="") as f:
        # 헤더 (Supabase 테이블 컬럼명과 정확히 일치)
        f.write("combo_id,n1,n2,n3,n4,n5,n6,"
                "rank1_count,rank2_count,rank3_count,rank4_count,rank5_count,"
                "odd_count,sum_total\n")

        # 청크 단위로 쓰기 (메모리 보호 + 진행률 표시)
        chunk = 100_000
        for start in range(0, n, chunk):
            end = min(start + chunk, n)
            # combo_id는 1부터 시작
            for i in range(start, end):
                row = combos[i]
                f.write(f"{i+1},"
                        f"{row[0]},{row[1]},{row[2]},{row[3]},{row[4]},{row[5]},"
                        f"{rank1[i]},{rank2[i]},{rank3[i]},{rank4[i]},{rank5[i]},"
                        f"{odd_count[i]},{sum_total[i]}\n")
            pct = 100 * end / n
            elapsed = time.time() - t0
            eta = elapsed / end * (n - end) if end < n else 0
            print(f"    {end:,}/{n:,} ({pct:.1f}%) - "
                  f"경과 {elapsed:.0f}s, 남은 시간 ~{eta:.0f}s", end="\r")

    size_mb = os.path.getsize(OUT_PATH) / (1024 * 1024)
    print(f"\n[+] 완료! 파일 크기: {size_mb:.1f} MB")
    print(f"    위치: {OUT_PATH}")
    print(f"\n다음 단계: 이 CSV를 Supabase combinations 테이블에 업로드")


if __name__ == "__main__":
    main()
