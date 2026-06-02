// 빌드 후 dist/ 의 SPA를 puppeteer로 라우트별 렌더 → 각 라우트 index.html 저장
// 사용: vite build 후에 node scripts/prerender.mjs

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const DIST = resolve(__dirname, '..', 'dist');

// 프리렌더할 라우트 + 라우트별 SEO 메타.
// /rhksflwkdlqslekaks (관리자) 는 의도적으로 제외.
const SITE = 'https://lottobase.kr';
const OG_IMAGE = `${SITE}/web-app-manifest-512x512.png`;
const ROUTES = [
  {
    path: '/',
    title: '로또베이스 LottoBase — 데이터 기반 로또 번호 분석 도구',
    description:
      '역대 전 회차 통계를 분석해 8,145,060개 경우의 수를 99%까지 좁히는 무료 로또 번호 생성기. 등수 출현 횟수, 홀짝 비율, 합계 범위, 제외/필수 번호로 정밀 필터링.',
  },
  {
    path: '/lab',
    title: '로또 번호 연구실 — 조건 필터로 800만 조합 줄이기 | 로또베이스',
    description:
      '역대 1~5등 출현 횟수, 홀짝 비율, 번호 합계, 포함/제외 조건을 조합해 8,145,060개 경우의 수를 정밀 필터링. 무료 로또 번호 생성기.',
  },
  {
    path: '/history',
    title: '로또 당첨 히스토리 — 역대 회차별 당첨번호 | 로또베이스',
    description:
      '역대 회차별 로또 당첨 번호와, 각 조합이 전체 회차에서 차지한 등수 통계를 한눈에. 회차 검색·조합 비교까지.',
  },
];

// 단순 정적 서버. 알려진 라우트면 index.html을 돌려줘서 SPA가 부팅되게 함.
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
};

async function serveFile(res, filePath) {
  try {
    const buf = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': MIME[extname(filePath)] || 'application/octet-stream' });
    res.end(buf);
    return true;
  } catch {
    return false;
  }
}

function startServer() {
  return new Promise((resolveStart) => {
    const server = createServer(async (req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const safe = url.replace(/\.\./g, '');
      const filePath = join(DIST, safe);

      // 1) 파일이 존재하면 그대로 서빙
      if (existsSync(filePath)) {
        try {
          const s = await stat(filePath);
          if (s.isFile()) {
            if (await serveFile(res, filePath)) return;
          }
        } catch {}
      }

      // 2) SPA 폴백: index.html
      if (await serveFile(res, join(DIST, 'index.html'))) return;

      res.writeHead(404);
      res.end('not found');
    });
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolveStart({ server, port });
    });
  });
}

async function prerenderRoute(browser, baseUrl, routePath) {
  const page = await browser.newPage();
  await page.goto(baseUrl + routePath, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(
    () => document.getElementById('root') && document.getElementById('root').childNodes.length > 0,
    { timeout: 10000 }
  );
  await new Promise((r) => setTimeout(r, 500));
  const html = await page.content();
  await page.close();
  return html;
}

// HTML attribute 안에 안전하게 들어가도록 따옴표/특수문자 이스케이프
function attrEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectMeta(html, meta) {
  const t = attrEscape(meta.title);
  const d = attrEscape(meta.description);
  const url = SITE + (meta.path === '/' ? '/' : meta.path);

  let out = html;
  // <title>...</title>
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${t}</title>`);
  // <meta name="description" ...>
  out = out.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${d}">`
  );
  // canonical
  out = out.replace(
    /<link\s+rel="canonical"[^>]*>/i,
    `<link rel="canonical" href="${url}">`
  );
  // og:url
  out = out.replace(
    /<meta\s+property="og:url"[^>]*>/i,
    `<meta property="og:url" content="${url}">`
  );
  // og:title
  out = out.replace(
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${t}">`
  );
  // og:description
  out = out.replace(
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${d}">`
  );
  // twitter:url
  out = out.replace(
    /<meta\s+name="twitter:url"[^>]*>/i,
    `<meta name="twitter:url" content="${url}">`
  );
  // twitter:title
  out = out.replace(
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${t}">`
  );
  // twitter:description
  out = out.replace(
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${d}">`
  );
  return out;
}

async function main() {
  if (!existsSync(DIST)) {
    console.error('[prerender] dist/ 없음. 먼저 vite build 실행 필요.');
    process.exit(1);
  }

  console.log('[prerender] 정적 서버 시작...');
  const { server, port } = await startServer();
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log('[prerender] puppeteer 시작...');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    for (const route of ROUTES) {
      console.log(`[prerender] 렌더링 ${route.path}`);
      const rawHtml = await prerenderRoute(browser, baseUrl, route.path);
      const html = injectMeta(rawHtml, route);

      const outDir = route.path === '/' ? DIST : join(DIST, route.path);
      const outFile = join(outDir, 'index.html');
      if (route.path !== '/') await mkdir(outDir, { recursive: true });
      await writeFile(outFile, html, 'utf8');
      console.log(`[prerender]   → ${outFile}`);
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log('[prerender] 완료.');
}

main().catch((err) => {
  console.error('[prerender] 실패:', err);
  process.exit(1);
});
