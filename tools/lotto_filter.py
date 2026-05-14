"""
로또 800만 조합 등수 카운트 + 필터링 도구

기능:
  1. C(45,6) = 8,145,060 조합 전체에 대해
     역대 회차별 1~5등 적중 횟수를 계산
  2. 계산 결과를 캐시 파일로 저장 (다음 실행부터는 즉시 로드)
  3. 사용자가 1~5등 범위를 지정하면 통과 조합 개수와 샘플 출력
  4. 결과 CSV 저장 가능

실행:
  cd C:\\Users\\i\\Desktop\\thinking\\money-rise
  python lotto_filter.py

필요 패키지:
  pip install numpy

처음 실행: 약 3~10분 (PC 성능에 따라)
이후 실행: 약 5초 (캐시 사용)
"""

import os
import sys
import json
import time
from itertools import combinations

try:
    import numpy as np
except ImportError:
    print("[X] numpy가 설치되어 있지 않습니다.")
    print("    PowerShell에서 다음 명령 실행:")
    print("    pip install numpy")
    sys.exit(1)


# === 경로 설정 ===
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(SCRIPT_DIR, "public", "lotto.json")
CACHE_PATH = os.path.join(SCRIPT_DIR, "lotto_cache.npz")
CSV_OUT = os.path.join(SCRIPT_DIR, "filtered_combos.csv")

TOTAL_COMBOS = 8_145_060  # C(45, 6)


def load_history():
    """역대 당첨번호 JSON 로드"""
    if not os.path.exists(JSON_PATH):
        print(f"[X] {JSON_PATH} 파일을 찾을 수 없습니다.")
        sys.exit(1)

    with open(JSON_PATH, encoding="utf-8") as f:
        history = json.load(f)
    print(f"[+] {len(history)}개 회차 데이터 로드됨")

    # 중복 회차 검사 (데이터 정합성)
    counts = {}
    for row in history:
        k = row.get("회차")
        counts[k] = counts.get(k, 0) + 1
    duplicates = {k: v for k, v in counts.items() if v > 1}
    if duplicates:
        print(f"[!] 경고: 중복된 회차 발견 → {duplicates}")
        print(f"    JSON 데이터 수정이 필요할 수 있습니다. 일단 그대로 진행합니다.")
    return history


def generate_all_combos():
    """C(45,6) = 8,145,060개 조합을 (n, 6) numpy 배열로 생성"""
    print(f"[+] 800만 조합 생성 중...")
    t0 = time.time()
    combos = np.fromiter(
        (x for c in combinations(range(1, 46), 6) for x in c),
        dtype=np.int8,
        count=TOTAL_COMBOS * 6,
    ).reshape(-1, 6)
    print(f"    완료 ({time.time() - t0:.1f}초)")
    return combos


def compute_ranks(combos, history):
    """각 조합이 역대 1~5등에 몇 번 해당했는지 계산"""
    print(f"[+] 등수 카운트 계산 중 ({len(history)}회차 처리)...")
    n = len(combos)
    rank1 = np.zeros(n, dtype=np.int16)
    rank2 = np.zeros(n, dtype=np.int16)
    rank3 = np.zeros(n, dtype=np.int16)
    rank4 = np.zeros(n, dtype=np.int16)
    rank5 = np.zeros(n, dtype=np.int16)

    t0 = time.time()
    for i, row in enumerate(history):
        winners = [
            row["번호1"], row["번호2"], row["번호3"],
            row["번호4"], row["번호5"], row["번호6"],
        ]
        bonus = row["보너스"]

        # 당첨 6개와 겹치는 개수
        win_mask = np.zeros(46, dtype=bool)
        win_mask[winners] = True
        matches = win_mask[combos].sum(axis=1)  # shape (8M,)

        # 보너스가 조합에 포함되는지
        bonus_mask = np.zeros(46, dtype=bool)
        bonus_mask[bonus] = True
        has_bonus = bonus_mask[combos].any(axis=1)

        is_5 = matches == 5
        rank1 += (matches == 6).astype(np.int16)
        rank2 += (is_5 & has_bonus).astype(np.int16)
        rank3 += (is_5 & ~has_bonus).astype(np.int16)
        rank4 += (matches == 4).astype(np.int16)
        rank5 += (matches == 3).astype(np.int16)

        if (i + 1) % 100 == 0 or i == len(history) - 1:
            elapsed = time.time() - t0
            eta = elapsed / (i + 1) * (len(history) - i - 1)
            print(f"    {i+1}/{len(history)} 회차 완료 "
                  f"(경과 {elapsed:.0f}s, 남은 시간 ~{eta:.0f}s)")

    return rank1, rank2, rank3, rank4, rank5


def save_cache(combos, ranks):
    print(f"[+] 캐시 저장 중 → {CACHE_PATH}")
    np.savez_compressed(
        CACHE_PATH,
        combos=combos,
        rank1=ranks[0], rank2=ranks[1], rank3=ranks[2],
        rank4=ranks[3], rank5=ranks[4],
    )
    size_mb = os.path.getsize(CACHE_PATH) / (1024 * 1024)
    print(f"    완료 ({size_mb:.1f} MB)")


def load_cache():
    print(f"[+] 캐시 로드 중 → {CACHE_PATH}")
    data = np.load(CACHE_PATH)
    return (
        data["combos"],
        data["rank1"], data["rank2"], data["rank3"],
        data["rank4"], data["rank5"],
    )


def print_distribution(rank1, rank2, rank3, rank4, rank5):
    print("\n" + "=" * 60)
    print("[등수별 카운트 분포 — 800만 조합 전체 기준]")
    print("=" * 60)
    for name, arr in [
        ("1등", rank1), ("2등", rank2), ("3등", rank3),
        ("4등", rank4), ("5등", rank5),
    ]:
        ge1 = int((arr >= 1).sum())
        print(f"  {name}: 평균={arr.mean():.4f}, 표준편차={arr.std():.3f}, "
              f"최대={arr.max()}, 1회이상={ge1:,}개")


def run_example_filter(combos, ranks):
    """회차님이 처음 물어본 시나리오를 자동 실행."""
    rank1, rank2, rank3, rank4, rank5 = ranks

    print("\n" + "=" * 60)
    print("[예시 자동 실행] 1등=0, 2등=0, 3등=0, 4등=0~2, 5등 다양")
    print("=" * 60)

    base = (rank1 == 0) & (rank2 == 0) & (rank3 == 0) & (rank4 >= 0) & (rank4 <= 2)
    print(f"\n5등 밴드별 통과 조합 수:")
    for lo, hi in [(20, 35), (24, 30), (25, 30), (26, 30),
                   (27, 30), (27, 28), (28, 30), (29, 30)]:
        mask = base & (rank5 >= lo) & (rank5 <= hi)
        c = int(mask.sum())
        pct = 100 * c / TOTAL_COMBOS
        print(f"  5등 {lo}~{hi}: {c:>10,}개 ({pct:6.3f}%)")


def parse_range(prompt, default_max):
    """입력 파싱:
       빈 입력      → (0, default_max)
       값 1개      → (값, 값)
       값 2개      → (최소, 최대)
    """
    s = input(prompt).strip()
    if not s:
        return (0, int(default_max))
    parts = s.replace(",", " ").split()
    if len(parts) == 1:
        v = int(parts[0])
        return (v, v)
    return (int(parts[0]), int(parts[1]))


def parse_exclude_numbers(prompt):
    """제외 번호 입력 파싱.
       빈 입력 → 빈 set (제외 없음)
       '1 2 3 4 5' 또는 '1,2,3,4,5' → {1, 2, 3, 4, 5}
       1~45 범위 외 숫자는 자동 무시
    """
    s = input(prompt).strip()
    if not s:
        return set()
    parts = s.replace(",", " ").split()
    out = set()
    invalid = []
    for p in parts:
        try:
            v = int(p)
            if 1 <= v <= 45:
                out.add(v)
            else:
                invalid.append(p)
        except ValueError:
            invalid.append(p)
    if invalid:
        print(f"    [!] 무시된 값(1~45 외): {invalid}")
    return out


def build_exclude_mask(combos, excluded):
    """제외 번호를 하나라도 포함하는 조합은 False로 표시.
       빈 set이면 전부 True 반환.
    """
    n = len(combos)
    if not excluded:
        return np.ones(n, dtype=bool)
    bad = np.zeros(46, dtype=bool)
    for v in excluded:
        bad[v] = True
    contains_bad = bad[combos].any(axis=1)  # (n,) bool: True면 제외 대상
    return ~contains_bad


def interactive_filter(combos, rank1, rank2, rank3, rank4, rank5):
    # 각 조합의 홀수 개수 사전 계산 (8M ops, 1초 미만)
    odd_count = (combos % 2 == 1).sum(axis=1).astype(np.int8)

    print("\n" + "=" * 60)
    print("[수동 필터 모드]")
    print("각 등수 범위 입력 — 형식: 'min max'")
    print("  예) 0 0  → 정확히 0회")
    print("  예) 0 2  → 0~2회")
    print("  예) 5    → 정확히 5회")
    print("  Enter   → 제한 없음")
    print()
    print("제외 번호 입력 — 공백 또는 콤마로 구분 (1~45)")
    print("  예) 1 2 3 4 5 6 7 8 9 10 11 12 13 14 16 19 23 25")
    print("  Enter → 제외 안 함")
    print()
    print("홀수 개수 — 6개 중 홀수가 몇 개 (0~6)")
    print("  예) 3      → 3:3 비율만")
    print("  예) 2 4    → 2:4, 3:3, 4:2 모두 허용")
    print("  Enter      → 제한 없음")
    print("=" * 60)

    while True:
        print("\n--- 필터 조건 입력 ---")
        r1 = parse_range("1등 범위 (예: 0 0): ", rank1.max())
        r2 = parse_range("2등 범위 (예: 0 0): ", rank2.max())
        r3 = parse_range("3등 범위 (예: 0 0): ", rank3.max())
        r4 = parse_range("4등 범위 (예: 0 2): ", rank4.max())
        r5 = parse_range("5등 범위 (예: 24 30): ", rank5.max())
        excluded = parse_exclude_numbers("제외할 숫자 입력 (예: 1 2 3 19 23): ")
        odd = parse_range("홀수 개수 범위 (0~6, 예: 2 4): ", 6)

        rank_mask = (
            (rank1 >= r1[0]) & (rank1 <= r1[1]) &
            (rank2 >= r2[0]) & (rank2 <= r2[1]) &
            (rank3 >= r3[0]) & (rank3 <= r3[1]) &
            (rank4 >= r4[0]) & (rank4 <= r4[1]) &
            (rank5 >= r5[0]) & (rank5 <= r5[1])
        )
        exc_mask = build_exclude_mask(combos, excluded)
        odd_mask = (odd_count >= odd[0]) & (odd_count <= odd[1])
        mask = rank_mask & exc_mask & odd_mask
        count = int(mask.sum())

        print(f"\n→ 등수 조건: 1등={r1}, 2등={r2}, 3등={r3}, 4등={r4}, 5등={r5}")
        if excluded:
            sorted_exc = sorted(excluded)
            print(f"→ 제외 번호 ({len(sorted_exc)}개): {sorted_exc}")
        print(f"→ 홀수 개수: {odd[0]}~{odd[1]}개")

        # 각 필터의 개별 효과
        rank_only = int(rank_mask.sum())
        exc_only = int(exc_mask.sum())
        odd_only = int(odd_mask.sum())
        print(f"   · 등수 필터만: {rank_only:,}개")
        print(f"   · 제외 필터만: {exc_only:,}개")
        print(f"   · 홀짝 필터만: {odd_only:,}개")
        print(f"→ 모두 적용 후 통과: {count:,} / {TOTAL_COMBOS:,} "
              f"({100 * count / TOTAL_COMBOS:.4f}%)")

        if count > 0:
            filtered = combos[mask]
            sample_size = min(5, count)
            idx = np.random.choice(count, sample_size, replace=False)
            print(f"\n샘플 {sample_size}개:")
            for i in idx:
                print(f"  {filtered[i].tolist()}")

            if count <= 10_000_000:
                ans = input(f"\n전체 {count:,}개를 CSV로 저장? (y/n): ").strip().lower()
                if ans == "y":
                    with open(CSV_OUT, "w", encoding="utf-8") as f:
                        f.write("n1,n2,n3,n4,n5,n6\n")
                        for c in filtered:
                            f.write(",".join(map(str, c.tolist())) + "\n")
                    print(f"    저장 완료 → {CSV_OUT}")

        cont = input("\n다른 조건으로 다시? (y/n): ").strip().lower()
        if cont != "y":
            break


def main():
    print("=" * 60)
    print(" 로또 800만 조합 필터링 도구")
    print("=" * 60)

    if os.path.exists(CACHE_PATH):
        print(f"[*] 캐시 발견 — 재계산 건너뜀")
        combos, rank1, rank2, rank3, rank4, rank5 = load_cache()
    else:
        history = load_history()
        combos = generate_all_combos()
        ranks = compute_ranks(combos, history)
        rank1, rank2, rank3, rank4, rank5 = ranks
        save_cache(combos, ranks)

    print_distribution(rank1, rank2, rank3, rank4, rank5)
    run_example_filter(combos, (rank1, rank2, rank3, rank4, rank5))
    interactive_filter(combos, rank1, rank2, rank3, rank4, rank5)

    print("\n프로그램 종료. 캐시는 보관되므로 다음 실행 시 즉시 로드됩니다.")


if __name__ == "__main__":
    main()
