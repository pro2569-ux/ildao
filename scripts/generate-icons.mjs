// PWA 아이콘 생성: 브랜드 SVG 템플릿을 8개 크기의 PNG로 래스터화
// 실행: npm run icons:generate
//
// - PNG는 풀블리드(투명 모서리 없음)로 생성: manifest의 'any maskable' 용도에서
//   런처가 어떤 마스크를 씌워도 배경이 비치지 않도록 함 (안전영역: 글리프 50%)
// - 기존 SVG의 font-size 버그(512*0.35를 의도한 '5120.35' 문자열 결합)도 함께 교정
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'public', 'icons');
const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const BRAND_BLUE = '#2563eb';

// 풀블리드 사각 배경 + 흰색 '일' 글리프 (PNG용)
const pngSvg = (s) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 ${s} ${s}'>` +
  `<rect fill='${BRAND_BLUE}' width='${s}' height='${s}'/>` +
  `<text x='50%' y='54%' font-size='${Math.round(s * 0.5)}' fill='white' text-anchor='middle' ` +
  `dominant-baseline='middle' font-family='Malgun Gothic, sans-serif' font-weight='bold'>일</text></svg>`;

// 라운드 사각 디자인 (기존 SVG 파일 교정용 — font-size만 정상화)
const roundedSvg = (s) =>
  `<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}' viewBox='0 0 ${s} ${s}'>` +
  `<rect fill='${BRAND_BLUE}' width='${s}' height='${s}' rx='20%'/>` +
  `<text x='50%' y='54%' font-size='${Math.round(s * 0.5)}' fill='white' text-anchor='middle' ` +
  `dominant-baseline='middle' font-family='Malgun Gothic, sans-serif' font-weight='bold'>일</text></svg>`;

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const s of SIZES) {
  const resvg = new Resvg(pngSvg(s), {
    fitTo: { mode: 'width', value: s },
    font: { loadSystemFonts: true, defaultFontFamily: 'Malgun Gothic' },
  });
  const png = resvg.render().asPng();
  const pngPath = path.join(OUT_DIR, `icon-${s}x${s}.png`);
  fs.writeFileSync(pngPath, png);

  const svgPath = path.join(OUT_DIR, `icon-${s}x${s}.svg`);
  fs.writeFileSync(svgPath, roundedSvg(s) + '\n');

  console.log(`generated icon-${s}x${s}.png (${png.length} bytes) + svg`);
}
console.log('done');
