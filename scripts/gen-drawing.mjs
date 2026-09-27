/**
 * 生成 src/game/drawing.json。那个文件是生成的，别手改。
 *
 * 每条线在下面的 SETS 里写清楚，几何全部由坐标算出来 —— 方位角、段长、
 * 取直方向、偏差，一个都不手写。
 *
 * 揭示那句 spacing 的数字也是插值的。以前是手写的，那会埋一个很难发现的坑：
 * 加第二条线时，伦敦的站名和公里数会悄悄配到纽约的段上，而且没有任何东西
 * 会报错。数字是 legs 的函数，就该在生成这一侧算出来。
 */
import fs from 'node:fs';

const DIRS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'];

/* y 向下，和 drawing.ts 的 STEP、check-drawing.mjs 保持同一套约定。
   以前这里是 y 向上的，虽然对「顶点是否重合」没影响，但两套约定并存迟早咬人。 */
const STEP = { E: [1, 0], NE: [1, -1], N: [0, -1], NW: [-1, -1], W: [-1, 0], SW: [-1, 1], S: [0, 1], SE: [1, 1] };

const SETS = [
  {
    station: '绘图',
    title: '信号绘图室',
    year: 1931,
    who: 'Harry Beck，伦敦地铁绘图员',
    intro:
      '贝克 1925 年进伦敦地铁，在信号工程师办公室画电路图。这条 1863 年的老线在地理图上歪歪扭扭，他想试试把它画成电路图那样——只用横线、竖线和 45 度斜线。',
    rule: '横、竖、45 度斜线，三种之外不画。',
    colour: '#9B0056',
    colourHover: '#B4116A',
    blindHint: '贝克画图时靠的也不是随手可查的坐标。',
    // 1863 年大都会铁路原始七站。坐标取各站现代继承站的 Wikipedia geo 数据。
    // 两点说明：法灵顿街 1865 年迁址，帕丁顿(Bishop's Road)原站房在跨线桥上，
    // 所以这是「当代继承站」的位置，不是 1863 年的精确站址。
    raw: [
      ['帕丁顿', "Paddington (Bishop's Road)", 51.5186, -0.1785],
      ['埃奇韦尔路', 'Edgware Road', 51.5200, -0.1678],
      ['贝克街', 'Baker Street', 51.5220, -0.1570],
      ['波特兰路', 'Portland Road', 51.5238, -0.1438],
      ['高尔街', 'Gower Street', 51.5258, -0.1358],
      ['国王十字', "King's Cross", 51.5302, -0.1241],
      ['法灵顿街', 'Farringdon Street', 51.5206, -0.1050],
    ],
    reveal: {
      title: '图画好了，代价也来了',
      distortion:
        '所以有些站在图上隔着一格，走过去只要两三分钟，坐车反而更慢。后来的线路图会专门标出这些「走着更快」的组合。',
      history:
        '管理层起初嫌这张图太激进，1932 年才勉强试印。Frank Pick 看过之后说，比我们以往任何一张图都好。贝克此后做到 1959 年。',
    },
    sources: [
      'London Museum: How Harry Beck revolutionised the Tube map',
      '各站坐标：Wikipedia geo 数据（现代继承站）',
    ],
  },
];

/** 把一条线的原始站点算成 stations + legs。 */
function build(set) {
  const { raw } = set;
  const lat0 = raw.reduce((s, r) => s + r[2], 0) / raw.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);

  const haversine = (a, b) => {
    const R = 6371, toR = (d) => (d * Math.PI) / 180;
    const p1 = toR(a[2]), p2 = toR(b[2]);
    const dp = p2 - p1, dl = toR(b[3] - a[3]);
    const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const stations = raw.map(([name, old, lat, lon]) => ({
    name,
    historicName: old,
    lat,
    lon,
  }));

  const legs = [];
  for (let i = 0; i < raw.length - 1; i++) {
    const a = raw[i], b = raw[i + 1];
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

  return { stations, legs };
}

/** 揭示第一句：图上等长、地面上不等。数字全部来自 legs。 */
function spacingLine(legs) {
  const ks = legs.map((l) => l.km);
  const min = Math.min(...ks), max = Math.max(...ks);
  const shortest = legs.find((l) => l.km === min);
  const longest = legs.find((l) => l.km === max);
  const ratio = (Math.round((max / min) * 10) / 10).toFixed(1);
  return (
    '图上每段一样长，地面上不是。' +
    `${shortest.from}到${shortest.to} ${min.toFixed(2)} 公里，` +
    `${longest.from}到${longest.to} ${max.toFixed(2)} 公里——差 ${ratio} 倍，图上却看不出来。`
  );
}

const lines = SETS.map((set) => {
  const { stations, legs } = build(set);
  return {
    station: set.station,
    title: set.title,
    year: set.year,
    who: set.who,
    intro: set.intro,
    // 站数插值，不手写 —— 每条线站数不一样
    task: `逐段选方向，把 ${stations.length} 个站连起来。每段只能取 45 度的整数倍，而且要挑最接近真实走向的那一个。`,
    rule: set.rule,
    colour: set.colour,
    colourHover: set.colourHover,
    ...(set.colourNote ? { colourNote: set.colourNote } : {}),
    blindHint: set.blindHint,
    stations,
    legs,
    reveal: {
      title: set.reveal.title,
      spacing: spacingLine(legs),
      distortion: set.reveal.distortion,
      history: set.reveal.history,
    },
    sources: set.sources,
  };
});

fs.writeFileSync('src/game/drawing.json', JSON.stringify({ lines }, null, 2) + '\n', 'utf8');

/* ── 自检。有问题就退出非零，不能只是打印。 ─────────── */

let bad = 0;
for (const line of lines) {
  console.log(`\n${line.title}`);
  console.log('段  起→止              km    真实角  取直  偏差');
  for (const l of line.legs) {
    console.log(
      `    ${l.from.padEnd(5)}→${l.to.padEnd(5)} ${String(l.km).padStart(5)}  ` +
        `${String(l.bearing).padStart(6)}°  ${l.snap.padEnd(3)} ${String(l.offBy).padStart(6)}°`,
    );
  }
  const ks = line.legs.map((l) => l.km);
  const ratio = Math.max(...ks) / Math.min(...ks);
  console.log(`最短 ${Math.min(...ks)} km，最长 ${Math.max(...ks)} km，${ratio.toFixed(1)} 倍`);

  let x = 0, y = 0;
  const pts = [[0, 0]];
  for (const l of line.legs) { const [dx, dy] = STEP[l.snap]; x += dx; y += dy; pts.push([x, y]); }
  console.log('折线：' + pts.map((p) => `(${p[0]},${p[1]})`).join(' '));

  if (new Set(pts.map(String)).size !== pts.length) {
    console.error('  × 取直后有两个站落在同一个格点上');
    bad++;
  }
  if (ratio < 1.5) {
    console.error(`  × 段长比只有 ${ratio.toFixed(1)}×，揭示撑不起来`);
    bad++;
  }
  if (new Set(line.legs.map((l) => l.snap)).size < 3) {
    console.error('  × 只用到不到三个方向，罗盘成了摆设');
    bad++;
  }
}

if (bad) {
  console.error(`\n生成了，但有 ${bad} 处问题 —— 跑 npm run check:drawing 看完整清单。`);
  process.exit(1);
}
console.log(`\n写好了：${lines.length} 条线。`);
