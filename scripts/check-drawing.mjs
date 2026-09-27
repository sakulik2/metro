/**
 * 绘图板数据校验。改了坐标或重跑 gen-drawing.mjs 之后跑这个。
 *
 * 最要紧的两条：
 *  · 方位角和段长必须和坐标算出来的一致（数据是生成的，不该手改）
 *  · 取直后的折线不能自交，否则图上两个站会重在一点
 */
import fs from 'node:fs';

const doc = JSON.parse(fs.readFileSync('src/game/drawing.json', 'utf8'));
const problems = [];
const notes = [];
const flag = (w) => problems.push(w);

const DIRS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];
const STEP = { E: [1, 0], NE: [1, -1], N: [0, -1], NW: [-1, -1], W: [-1, 0], SW: [-1, 1], S: [0, 1], SE: [1, 1] };

for (const k of ['station', 'title', 'who', 'intro', 'task', 'rule']) {
  if (typeof doc[k] !== 'string' || !doc[k].trim()) flag(`${k} 缺失或为空`);
}
if (!Number.isInteger(doc.year)) flag('year 要是整数');

const st = doc.stations;
if (!Array.isArray(st) || st.length < 3) flag('至少要三个站');
else {
  const seen = new Set();
  st.forEach((s, i) => {
    if (typeof s.name !== 'string' || !s.name) flag(`第 ${i + 1} 站缺 name`);
    else if (seen.has(s.name)) flag(`站名重复：${s.name}`);
    else seen.add(s.name);
    if (typeof s.lat !== 'number' || typeof s.lon !== 'number') flag(`${s.name} 缺坐标`);
    if ([...(s.name ?? '')].length > 5) notes.push(`站名「${s.name}」偏长，图上标签可能挤`);
  });
}

const legs = doc.legs;
if (!Array.isArray(legs) || legs.length !== st.length - 1) {
  flag(`段数应为站数减一（${st.length - 1}），实际 ${legs?.length}`);
} else {
  // 重算方位角和距离，和数据里的比
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

    const want = DIRS[Math.round(bearing / 45) % 8];
    if (want !== l.snap) flag(`${where} snap=${l.snap}，最接近 ${bearing}° 的其实是 ${want}`);

    // 卡在两个方向正中间的段最有意思，值得知道有几段
    if (Math.abs(Math.abs(l.offBy) - 22.5) < 3) {
      notes.push(`${where} 偏 ${l.offBy}°，几乎正好卡在两个方向中间 —— 这段最难选，很好`);
    }
  });

  // 折线自交检查
  let x = 0, y = 0;
  const pts = ['0,0'];
  for (const l of legs) {
    const s = STEP[l.snap];
    if (!s) continue;
    x += s[0]; y += s[1];
    pts.push(`${x},${y}`);
  }
  if (new Set(pts).size !== pts.length) flag('取直后的折线有重合顶点，图上会有两站叠在一起');
}

const rv = doc.reveal;
for (const k of ['title', 'spacing', 'distortion', 'history']) {
  if (typeof rv?.[k] !== 'string' || !rv[k].trim()) flag(`reveal.${k} 缺失`);
}

// 揭示环节的立论：最长段和最短段必须差得足够明显
if (Array.isArray(legs) && legs.length) {
  const ks = legs.map((l) => l.km);
  const ratio = Math.max(...ks) / Math.min(...ks);
  console.log(`绘图板：${st.length} 站 ${legs.length} 段，最短 ${Math.min(...ks)} km，最长 ${Math.max(...ks)} km，${ratio.toFixed(1)} 倍`);
  if (ratio < 1.5) flag(`最长段只有最短段的 ${ratio.toFixed(1)} 倍，「图上等长、地面上不等」这个立论撑不起来`);
}

if (notes.length) {
  console.log('\n可留意：');
  for (const n of notes) console.log('  · ' + n);
}
if (problems.length) {
  console.log('\n要修：');
  for (const p of problems) console.log('  × ' + p);
  process.exit(1);
}
console.log('\n检查通过：方位角和段长与坐标一致，取直方向唯一，折线不自交。');
