import fs from 'node:fs';

// 1863 年大都会铁路原始七站。坐标取各站现代继承站的 Wikipedia geo 数据。
// 两点说明：法灵顿街 1865 年迁址，帕丁顿(Bishop's Road)原站房在跨线桥上，
// 所以这是「当代继承站」的位置，不是 1863 年的精确站址。
const RAW = [
  ['帕丁顿',     "Paddington (Bishop's Road)", 51.5186, -0.1785],
  ['埃奇韦尔路', 'Edgware Road',               51.5200, -0.1678],
  ['贝克街',     'Baker Street',               51.5220, -0.1570],
  ['波特兰路',   'Portland Road',              51.5238, -0.1438],
  ['高尔街',     'Gower Street',               51.5258, -0.1358],
  ['国王十字',   "King's Cross",               51.5302, -0.1241],
  ['法灵顿街',   'Farringdon Street',          51.5206, -0.1050],
];

const lat0 = RAW.reduce((s, r) => s + r[2], 0) / RAW.length;
const kx = Math.cos((lat0 * Math.PI) / 180);

const haversine = (a, b) => {
  const R = 6371, toR = (d) => (d * Math.PI) / 180;
  const p1 = toR(a[2]), p2 = toR(b[2]);
  const dp = p2 - p1, dl = toR(b[3] - a[3]);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const DIRS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];

const stations = RAW.map(([name, old, lat, lon]) => ({ name, historicName: old, lat, lon }));

const legs = [];
for (let i = 0; i < RAW.length - 1; i++) {
  const a = RAW[i], b = RAW[i + 1];
  const dx = (b[3] - a[3]) * kx;
  const dy = b[2] - a[2];
  const bearing = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const step = Math.round(bearing / 45) % 8;
  legs.push({
    from: a[0],
    to: b[0],
    km: Math.round(haversine(a, b) * 100) / 100,
    bearing: Math.round(bearing * 10) / 10,
    snap: DIRS[step],
    offBy: Math.round((((bearing - step * 45 + 180 + 360) % 360) - 180) * 10) / 10,
  });
}

const doc = {
  station: '绘图',
  title: '信号绘图室',
  year: 1931,
  who: 'Harry Beck，伦敦地铁绘图员',
  intro:
    '贝克 1925 年进伦敦地铁，在信号工程师办公室画电路图。这条 1863 年的老线在地理图上歪歪扭扭，他想试试把它画成电路图那样——只用横线、竖线和 45 度斜线。',
  task: '逐段选方向，把七个站连起来。每段只能取 45 度的整数倍，而且要挑最接近真实走向的那一个。',
  rule: '横、竖、45 度斜线，三种之外不画。',
  stations,
  legs,
  reveal: {
    title: '图画好了，代价也来了',
    spacing:
      '图上每段一样长，地面上不是。波特兰路到高尔街 0.60 公里，国王十字到法灵顿街 1.70 公里——差 2.8 倍，图上却看不出来。',
    distortion:
      '所以有些站在图上隔着一格，走过去只要两三分钟，坐车反而更慢。后来的线路图会专门标出这些「走着更快」的组合。',
    history:
      '管理层起初嫌这张图太激进，1932 年才勉强试印。Frank Pick 看过之后说，比我们以往任何一张图都好。贝克此后做到 1959 年。',
  },
  sources: [
    'London Museum: How Harry Beck revolutionised the Tube map',
    '各站坐标：Wikipedia geo 数据（现代继承站）',
  ],
};

fs.writeFileSync('src/game/drawing.json', JSON.stringify(doc, null, 2) + '\n', 'utf8');

console.log('段  起→止              km    真实角  取直  偏差');
for (const l of legs) {
  console.log(
    `    ${l.from.padEnd(5)}→${l.to.padEnd(5)} ${String(l.km).padStart(5)}  ${String(l.bearing).padStart(6)}°  ${l.snap.padEnd(3)} ${String(l.offBy).padStart(6)}°`,
  );
}
const ks = legs.map((l) => l.km);
console.log(`\n最短 ${Math.min(...ks)} km，最长 ${Math.max(...ks)} km，${(Math.max(...ks) / Math.min(...ks)).toFixed(1)} 倍`);

// 验证取直后的折线不自交
let x = 0, y = 0;
const pts = [[0, 0]];
const STEP = { E: [1, 0], NE: [1, 1], N: [0, 1], NW: [-1, 1], W: [-1, 0], SW: [-1, -1], S: [0, -1], SE: [1, -1] };
for (const l of legs) { const [dx, dy] = STEP[l.snap]; x += dx; y += dy; pts.push([x, y]); }
console.log('折线：' + pts.map((p) => `(${p[0]},${p[1]})`).join(' '));
console.log('不重复顶点：' + (new Set(pts.map(String)).size === pts.length ? '是' : '否'));
