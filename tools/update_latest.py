# -*- coding: utf-8 -*-
"""
최신 회차 자동 갱신 (네이버 크롤 → DB 추가 → combinations 재적재)

동작:
  1. DB lotto_history의 최신 회차를 확인
  2. 그 다음 회차부터, 네이버에 올라온 회차를 Playwright(진짜 브라우저)로 읽음
     - 6개 번호 + 보너스
     - 1등/2등 당첨게임 수 + 1개당 당첨금
     (네이버 위젯은 JS로 렌더돼서 requests로는 못 읽음. 그래서 헤드리스 브라우저 사용.)
  3. 빠진 회차를 lotto_history에 INSERT
  4. 새 회차가 있으면 rebuild_combinations.py 실행 → combinations 재적재(bloat 0)

선행:
  pip install playwright psycopg2-binary python-dotenv numpy
  playwright install chromium
  .env.local(프로젝트 루트)에 SUPABASE_DB_URL

실행:
  python tools/update_latest.py          # 실제 반영
  python tools/update_latest.py --dry     # 크롤만 확인(DB 미변경, 재적재 안 함)
"""
import os
import re
import sys
import subprocess

try:
    from dotenv import load_dotenv
    import psycopg2
    from playwright.sync_api import sync_playwright
except ImportError:
    print("[X] 패키지 필요: pip install playwright psycopg2-binary python-dotenv numpy")
    print("             그리고: playwright install chromium")
    sys.exit(1)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
ENV_PATH = os.path.join(PROJECT_ROOT, ".env.local")
REBUILD = os.path.join(SCRIPT_DIR, "rebuild_combinations.py")

DRY = "--dry" in sys.argv
MAX_LOOKAHEAD = 30   # 폭주 방지: 한 번에 최대 이만큼만 앞으로 조회


def get_db_url():
    # 로컬: .env.local / CI(GitHub Actions): 환경변수(SUPABASE_DB_URL) 둘 다 지원
    if os.path.exists(ENV_PATH):
        load_dotenv(ENV_PATH)
    url = os.getenv("SUPABASE_DB_URL")
    if not url:
        print("[X] SUPABASE_DB_URL이 없습니다 (.env.local 또는 환경변수/GitHub Secret).")
        sys.exit(1)
    return url


def parse_prizes(text):
    """당첨금액 탭 텍스트 → {rank: (당첨게임수, 1개당당첨금)}."""
    out = {}
    cur = None
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r'^([1-5])등', line)
        if m:
            cur = int(m.group(1))
            continue
        if cur is None:
            continue
        g = re.search(r'당첨게임\s*수\D*([\d,]+)\s*개', line)
        if g:
            out.setdefault(cur, [None, None])[0] = int(g.group(1).replace(',', ''))
        a = re.search(r'1개당\s*당첨금\D*([\d,]+)\s*원', line)
        if a:
            out.setdefault(cur, [None, None])[1] = int(a.group(1).replace(',', ''))
    return out


def fetch_round(pg, drw):
    """네이버에서 drw회차를 읽음. 아직 추첨 전/없음이면 None."""
    url = f"https://search.naver.com/search.naver?query=%EB%A1%9C%EB%98%90+{drw}%ED%9A%8C"
    pg.goto(url, wait_until="networkidle", timeout=30000)
    try:
        pg.wait_for_selector("div._lotto", timeout=15000)
    except Exception:
        return None
    w = pg.locator("div._lotto").first

    t1 = w.inner_text()
    m = re.search(r'(\d+)회차\s*\((\d{4})\.(\d{2})\.(\d{2})', t1)
    if not m:
        return None
    got = int(m.group(1))
    if got != drw:          # 네이버가 최신 가용 회차로 clamp → 요청 회차 아직 없음
        return None
    date = f"{m.group(2)}-{m.group(3)}-{m.group(4)}"

    balls = [int(x) for x in w.locator("span.ball").all_inner_texts() if x.strip().isdigit()]
    if len(balls) < 7:
        return None
    nums, bonus = balls[:6], balls[6]

    # 유효성
    if len(set(nums)) != 6 or not all(1 <= n <= 45 for n in nums) or not (1 <= bonus <= 45) or bonus in nums:
        return None

    # 당첨금액 탭
    prizes = {}
    try:
        w.get_by_text("당첨금액", exact=True).first.click(timeout=5000)
        pg.wait_for_timeout(700)
        prizes = parse_prizes(w.inner_text())
    except Exception:
        pass
    f_w, f_a = prizes.get(1, (None, None))
    s_w, s_a = prizes.get(2, (None, None))

    return {
        "round": got, "date": date, "nums": nums, "bonus": bonus,
        "first_amount": f_a, "first_winners": f_w,
        "second_amount": s_a, "second_winners": s_w,
    }


def main():
    db_url = get_db_url()
    print("[+] Supabase 연결 중...")
    conn = psycopg2.connect(db_url, connect_timeout=10)
    cur = conn.cursor()
    cur.execute("SELECT COALESCE(MAX(round_no), 0) FROM lotto_history")
    latest_db = cur.fetchone()[0]
    print(f"    DB 최신 회차: {latest_db}")

    print("[+] 네이버에서 새 회차 조회 중 (헤드리스 브라우저)...")
    found = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(
            viewport={"width": 1280, "height": 2200},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                       "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        )
        for i in range(1, MAX_LOOKAHEAD + 1):
            drw = latest_db + i
            data = fetch_round(pg, drw)
            if not data:
                print(f"    {drw}회: 아직 없음 → 조회 종료")
                break
            print(f"    {drw}회 ({data['date']}): {data['nums']} +{data['bonus']} | "
                  f"1등 {data['first_winners']}게임/{data['first_amount']:,}원 | "
                  f"2등 {data['second_winners']}게임/{data['second_amount']:,}원")
            found.append(data)
        b.close()

    if not found:
        print("[=] 추가할 새 회차가 없습니다. (이미 최신)")
        cur.close(); conn.close()
        return

    if DRY:
        print(f"\n[dry] {len(found)}개 회차 크롤 확인됨. DB 미변경.")
        cur.close(); conn.close()
        return

    print(f"[+] lotto_history에 {len(found)}개 회차 INSERT 중...")
    for d in found:
        cur.execute(
            """
            INSERT INTO lotto_history
                (round_no, n1, n2, n3, n4, n5, n6, bonus,
                 first_prize_amount, first_prize_winners,
                 second_prize_amount, second_prize_winners, drawn_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON CONFLICT (round_no) DO NOTHING
            """,
            (d["round"], *d["nums"], d["bonus"],
             d["first_amount"], d["first_winners"],
             d["second_amount"], d["second_winners"], d["date"]),
        )
    conn.commit()
    cur.execute("SELECT MAX(round_no) FROM lotto_history")
    print(f"    완료. DB 최신 회차 → {cur.fetchone()[0]}")
    cur.close(); conn.close()

    print("[+] combinations 재적재 실행 (rebuild_combinations.py)...")
    r = subprocess.run([sys.executable, REBUILD])
    if r.returncode == 0:
        print("\n[+] 최신 회차 갱신 완료.")
    else:
        print("\n[X] 재적재 단계에서 오류. rebuild_combinations.py를 직접 실행해 확인하세요.")


if __name__ == "__main__":
    main()
