#!/usr/bin/env node
// 통합 검증 스크립트 (#loop)
// 목적: Claude가 실행하는 명령줄을 단일 `npm run verify` 한 줄로 유지한다.
//       파이프(|)·리다이렉트·echo·세미콜론(;)·셸 확장(${...}, $(...))은 전부
//       이 스크립트 내부(서브프로세스)에서 처리 → 권한 프롬프트/expansion 차단.
// 종료코드: typecheck·build 둘 다 0일 때만 0.
import { spawnSync } from 'node:child_process';

function step(label, command, tailLines) {
  const res = spawnSync(command, { encoding: 'utf8', shell: true });
  const output = ((res.stdout || '') + (res.stderr || '')).split('\n');
  process.stdout.write(output.slice(-tailLines).join('\n').trimEnd() + '\n');
  const code = res.status == null ? 1 : res.status;
  console.log(`  └ ${label} exit=${code}`);
  return code;
}

const tc = step('typecheck', 'npx tsc --noEmit', 8);
const bd = step('build', 'npx next build', 6);
console.log(`VERIFY typecheck=${tc} build=${bd}`);
process.exit(tc === 0 && bd === 0 ? 0 : 1);
