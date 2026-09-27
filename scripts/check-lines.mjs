/**
 * 题库校验。加完题跑 `npm run check:lines`。
 * 最要紧的一条：站名不能泄露答案 —— 线路图一进站就显示全部站名，
 * 站名要说「这站问什么」，不能说「答案是什么」。
 */
import fs from 'node:fs';
import path from 'node:path';

const DIR = 'src/data/lines';
const HEX = /^#[0-9A-Fa-f]{6}$/;

const problems = [];
const notes = [];
const flag = (where, why) => problems.push(`${where}：${why}`);

const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
if (files.length === 0) flag(DIR, '一个题库文件都没有');

const seenColor = new Map();
const seenId = new Map();
let totalStops = 0;

for (const file of files) {
  const at = file;
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(path.join(DIR, file), 'utf8'));
  } catch (e) {
    flag(at, `JSON 语法错误 —— ${e.message}`);
    continue;
  }

  if (typeof doc.name !== 'string' || !doc.name.trim()) flag(at, 'name 缺失');
  if (typeof doc.color !== 'string' || !HEX.test(doc.color)) {
    flag(at, 'color 要写成 #RRGGBB');
  } else if (seenColor.has(doc.color)) {
    flag(at, `线路色和 ${seenColor.get(doc.color)} 撞了，乘客分不出两条线`);
  } else {
    seenColor.set(doc.color, file);
  }

  if (!Number.isInteger(doc.id)) flag(at, 'id 要是整数');
  else if (seenId.has(doc.id)) flag(at, `id=${doc.id} 和 ${seenId.get(doc.id)} 重复`);
  else seenId.set(doc.id, file);

  if (!Array.isArray(doc.questions) || doc.questions.length === 0) {
    flag(at, '一条线至少要有一站');
    continue;
  }
  totalStops += doc.questions.length;

  const stations = new Set();

  doc.questions.forEach((q, i) => {
    const where = `${file} 第 ${i + 1} 站`;

    for (const key of ['station', 'q', 'hint', 'explain']) {
      if (typeof q[key] !== 'string' || !q[key].trim()) flag(where, `${key} 缺失或为空`);
    }
    if (typeof q.station === 'string') {
      if (stations.has(q.station)) flag(where, `站名「${q.station}」在本线重复`);
      stations.add(q.station);
      // 线路图标签写不下长站名，会被截断
      if ([...q.station].length > 4) {
        notes.push(`${where}：站名「${q.station}」偏长，线路图上可能被截断`);
      }
    }

    if (!Array.isArray(q.options) || q.options.length < 2) {
      flag(where, 'options 至少两项');
      return;
    }
    if (q.options.length > 6) flag(where, 'options 最多六项（A–F）');
    q.options.forEach((o, j) => {
      if (typeof o !== 'string' || !o.trim()) flag(where, `第 ${j + 1} 个选项为空`);
    });
    if (new Set(q.options).size !== q.options.length) flag(where, '有重复选项');

    if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
      flag(where, `answer=${q.answer} 超出选项范围`);
      return;
    }

    // 核心检查：站名泄露答案
    const station = q.station;
    if (typeof station !== 'string' || !station) return;
    const correct = q.options[q.answer];
    const inQuestion = q.q.includes(station);
    const inCorrect = correct.includes(station);
    const inWrong = q.options.some((o, j) => j !== q.answer && o.includes(station));

    if (!inQuestion && inCorrect && !inWrong) {
      flag(where, `站名「${station}」出现在正确答案里，题干里却没有 —— 泄露答案`);
    } else if (!inQuestion && !inCorrect) {
      const shared = [...station].filter((ch) => correct.includes(ch)).length;
      if (shared >= 2 && !inWrong) {
        notes.push(`${where}：站名「${station}」和正确答案用字重合较多，再看一眼`);
      }
    }
  });
}

console.log(`题库：${files.length} 条线，${totalStops} 站`);

if (notes.length) {
  console.log('\n可留意：');
  for (const n of notes) console.log('  · ' + n);
}

if (problems.length) {
  console.log('\n要修：');
  for (const p of problems) console.log('  × ' + p);
  process.exit(1);
}

console.log('\n检查通过：站名没有泄露答案，选项和答案下标都正确。');
