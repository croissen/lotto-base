// num_mask(비트마스크) ↔ 6개 숫자 변환 + 로또 공 색상
//
// num_mask: 번호 N → 비트 (N-1). 6개 번호의 비트를 OR한 값.
// 최대 비트 44(번호 45)까지 → 2^45 미만 → JS 안전정수 범위.
// 단, JS 비트연산자(&, <<, >>)는 32비트 한정이므로 BigInt 사용 필수.

/** num_mask → 정렬된 6개 숫자 배열. 예: 63 → [1,2,3,4,5,6] */
export function maskToNumbers(mask) {
  const m = BigInt(mask);
  const nums = [];
  for (let i = 0n; i < 45n; i++) {
    if ((m >> i) & 1n) nums.push(Number(i) + 1);
  }
  return nums;
}

/** 숫자 배열 → num_mask (제외 번호 → excluded_mask 만들 때 사용) */
export function numbersToMask(numbers) {
  let mask = 0n;
  for (const n of numbers) {
    mask |= 1n << BigInt(n - 1);
  }
  return Number(mask); // 2^45 미만이라 Number로 안전, RPC 전달 가능
}

/** 한국 로또 공 색상 (구간별) */
export function getBallColor(n) {
  if (n <= 10) return '#fbc400';
  if (n <= 20) return '#69c8f2';
  if (n <= 30) return '#ff7272';
  if (n <= 40) return '#aaaaaa';
  return '#b0d840';
}
