/**
 * 绘图板数据校验。改了坐标或重跑 gen-drawing.mjs 之后跑这个。
 *
 * 逐条线验，因为重玩会换线 —— 只验第一条等于没验。
 *
 * 最要紧的几条：
 *  · 方位角、段长、偏差必须和坐标算出来的一致（数据是生成的，不该手改）
 *  · 取直后的折线不能自交，也不能有重合顶点（两回事，都要查）
 *  · 线色在方格纸上要看得清，否则 9px 的线压在格子上会发虚
 */
import fs from 'node:fs';

const doc = JSON.parse(fs.readFileSync('src/game/drawing.json', 'utf8'));
const problems = [];
const notes = [];

const DIRS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
const STEP = { E: [1, 0], NE: [1, -1], N: [0, -1], NW: [-1, -1], W: [-1, 0], SW: [-1, 1], S: [0, 1], SE: [1, 1] };

/* 方格纸的底色和格线，抄自 DrawingBoard.css 的 --paper / --grid。
   改那边记得改这里 —— 对比度下限是照这两个值算的。 */
const PAPER = '#E6E9E0';
const GRID = '#C3CCC0';

const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/** 两条线段是否真的交叉（不含共端点的相邻段）。 */
const crosses = (p1, p2, p3, p4) => {
  const d = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const s = (x) => (x > 0 ? 1 : x < 0 ? -1 : 0);
  const d1 = s(d(p3, p4, p1)), d2 = s(d(p3, p4, p2));
  const d3 = s(d(p1, p2, p3)), d4 = s(d(p1, p2, p4));
  if (d1 !== d2 && d3 !== d4) return true;
  // 共线重叠也算交叉
  const on = (a, b, c) => d(a, b, c) === 0 &&
    Math.min(a[0], b[0]) <= c[0] && c[0] <= Math.max(a[0], b[0]) &&
    Math.min(a[1], b[1]) <= c[1] && c[1] <= Math.max(a[1], b[1]);
  return on(p3, p4, p1) || on(p3, p4, p2) || on(p1, p2, p3) || on(p1, p2, p4);
};

const sets = doc.lines;
if (!Array.isArray(sets) || sets.length === 0) {
  console.log('要修：\n  × drawing.json 里没有 lines 数组');
  process.exit(1);
}

const titles = new Set();
const colours = new Map();
const summary = [];

for (const [n, set] of sets.entries()) {
  const at = `第 ${n + 1} 条线`;
  const flag = (w) => problems.push(`${at} ${w}`);
  const note = (w) => notes.push(`${at} ${w}`);

  for (const k of ['station', 'title', 'who', 'intro', 'task', 'rule', 'blindHint']) {
    if (typeof set[k] !== 'string' || !set[k].trim()) flag(`${k} 缺失或为空`);
  }
  if (!Number.isInteger(set.year)) flag('year 要是整数');

  if (typeof set.title === 'string') {
    if (titles.has(set.title)) flag(`标题和前面某条线重名：${set.title}`);
    titles.add(set.title);
  }

  if (!Array.isArray(set.sources) || set.sources.length === 0) flag('没写来源');

  // 线色：格式、撞色、以及在方格纸上看不看得清
  for (const key of ['colour', 'colourHover']) {
    const c = set[key];
    if (typeof c !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(c)) {
      flag(`${key} 不是 #RRGGBB：${c}`);
      continue;
    }
    if (key === 'colour') {
      const prev = colours.get(c.toUpperCase());
      if (prev !== undefined) flag(`线色和第 ${prev + 1} 条线一样：${c}`);
      colours.set(c.toUpperCase(), n);

      const onPaper = contrast(c, PAPER);
      const onGrid = contrast(c, GRID);
      if (onPaper < 4.5) flag(`线色 ${c} 对纸只有 ${onPaper.toFixed(2)}:1，要 ≥ 4.5`);
      if (onGrid < 3) flag(`线色 ${c} 对格线只有 ${onGrid.toFixed(2)}:1，要 ≥ 3`);
    }
  }

  const st = set.stations;
  if (!Array.isArray(st) || st.length < 3) {
    flag('至少要三个站');
    continue;
  }
  const seen = new Set();
  st.forEach((s, i) => {
    if (typeof s.name !== 'string' || !s.name) flag(`第 ${i + 1} 站缺 name`);
    else if (seen.has(s.name)) flag(`站名重复：${s.name}`);
    else seen.add(s.name);
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') flag(`${s.name} 缺坐标`);
    if ([...(s.name ?? '')].length > 5) note(`站名「${s.name}」偏长，图上标签可能挤`);
  });

  const legs = set.legs;
  if (!Array.isArray(legs) || legs.length !== st.length - 1) {
    flag(`段数应为站数减一（${st.length - 1}），实际 ${Array.isArray(legs) ? legs.length : '缺失'}`);
    continue;
  }

  // 重算方位角、段长、偏差，和数据里的比
  const lat0 = st.reduce((a, s) => a + s.lat, 0) / st.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const hav = (a, b) => {
    const R = 6371, toR = (d) => (d * Math.PI) / 180;
    const p1 = toR(a.lat), p2 = toR(b.lat);
    const h = Math.sin((p2 - p1) / 2) ** 2 +
      Math.cos(p1) * Math.cos(p2) * Math.sin(toR(b.lon - a.lon) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  legs.forEach((l, i) => {
    const a = st[i], b = st[i + 1];
    const where = `第 ${i + 1} 段 ${l.from}→${l.to}`;
    if (l.from !== a.name || l.to !== b.name) flag(`${where} 与站序不符`);
    if (!DIRS.includes(l.snap)) { flag(`${where} snap 不是合法方向：${l.snap}`); return; }

    const km = Math.round(hav(a, b) * 100) / 100;
    if (Math.abs(km - l.km) > 0.01) flag(`${where} km=${l.km}，按坐标应为 ${km}`);

    const dx = (b.lon - a.lon) * kx, dy = b.lat - a.lat;
    const bearing = Math.round((((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360) * 10) / 10;
    if (Math.abs(bearing - l.bearing) > 0.15) flag(`${where} bearing=${l.bearing}，按坐标应为 ${bearing}`);

    const step = Math.round(bearing / 45) % 8;
    const want = DIRS[step];
    if (want !== l.snap) flag(`${where} snap=${l.snap}，最接近 ${bearing}° 的其实是 ${want}`);

    // offBy 会打给玩家看（二级提示），所以也得对得上
    const offBy = Math.round((((bearing - step * 45 + 180 + 360) % 360) - 180) * 10) / 10;
    if (Math.abs(offBy - l.offBy) > 0.15) flag(`${where} offBy=${l.offBy}，按坐标应为 ${offBy}`);

    // 卡在两个方向正中间的段最有意思，值得知道有几段
    if (Math.abs(Math.abs(l.offBy) - 22.5) < 3) {
      note(`${where} 偏 ${l.offBy}°，几乎正好卡在两个方向中间 —— 这段最难选，很好`);
    }
  });

  // 罗盘上至少用到三个方向，否则它是装饰
  const used = new Set(legs.map((l) => l.snap));
  if (used.size < 3) flag(`只用到 ${used.size} 个方向，罗盘成了摆设`);

  // 取直后的折线：顶点不能重合，线段不能相交（两件事）
  const pts = [[0, 0]];
  let x = 0, y = 0;
  for (const l of legs) {
    const s = STEP[l.snap];
    if (!s) continue;
    x += s[0]; y += s[1];
    pts.push([x, y]);
  }
  if (new Set(pts.map(String)).size !== pts.length) {
    flag('取直后有两个站落在同一个格点上');
  }
  for (let i = 0; i + 1 < pts.length; i++) {
    for (let j = i + 2; j + 1 < pts.length; j++) {
      if (i === 0 && j + 1 === pts.length - 1) continue; // 首尾相接不算
      if (crosses(pts[i], pts[i + 1], pts[j], pts[j + 1])) {
        flag(`第 ${i + 1} 段和第 ${j + 1} 段在图上交叉了`);
      }
    }
  }

  const rv = set.reveal;
  for (const k of ['title', 'spacing', 'distortion', 'history']) {
    if (typeof rv?.[k] !== 'string' || !rv[k].trim()) flag(`reveal.${k} 缺失`);
  }

  // 揭示环节的立论：最长段和最短段必须差得足够明显
  const ks = legs.map((l) => l.km);
  const min = Math.min(...ks), max = Math.max(...ks);
  const ratio = max / min;
  if (ratio < 1.5) {
    flag(`最长段只有最短段的 ${ratio.toFixed(1)} 倍，「图上等长、地面上不等」这个立论撑不起来`);
  }

  /*
   * 兜底：spacing 那句话里的数字必须真的来自 legs。
   *
   * 这些数字本来是生成时插值的（见 gen-drawing.mjs），这条只防一件事 ——
   * 有人手改了 drawing.json，把另一条线的文案配到这条线的段上。
   * 只做 includes，不解析句子结构。
   */
  if (typeof rv?.spacing === 'string') {
    const shortest = legs.find((l) => l.km === min);
    const longest = legs.find((l) => l.km === max);
    for (const [label, l] of [['最短', shortest], ['最长', longest]]) {
      if (!l) continue;
      for (const bit of [l.from, l.to, l.km.toFixed(2)]) {
        if (!rv.spacing.includes(bit)) {
          flag(`reveal.spacing 里找不到${label}段的「${bit}」，文案和数据对不上`);
        }
      }
    }
    if (!rv.spacing.includes((Math.round(ratio * 10) / 10).toFixed(1))) {
      flag(`reveal.spacing 里找不到倍数 ${(Math.round(ratio * 10) / 10).toFixed(1)}`);
    }
  }

  // task 里的站数也得跟着这条线
  if (typeof set.task === 'string' && !set.task.includes(String(st.length))) {
    flag(`task 没说出站数（${st.length}）`);
  }

  summary.push(
    `${set.title}：${st.length} 站 ${legs.length} 段，${min}–${max} km，${ratio.toFixed(1)} 倍，${used.size} 个方向`,
  );
}

console.log(`绘图板：${sets.length} 条线`);
for (const s of summary) console.log(`  · ${s}`);

if (notes.length) {
  console.log('\n可留意：');
  for (const n of notes) console.log('  · ' + n);
}
if (problems.length) {
  console.log('\n要修：');
  for (const p of problems) console.log('  × ' + p);
  process.exit(1);
}
console.log('\n检查通过：方位角、段长、偏差与坐标一致，折线不自交，线色够清楚。');
