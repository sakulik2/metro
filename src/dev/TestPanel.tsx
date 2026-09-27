import { GAMES, LINES } from '../data/lines';
import { describe, hrefFor, parseTarget } from './testRoute';
import './TestPanel.css';

/**
 * 跳关索引，走 /test。
 *
 * 材料跟着绘图室走：方格纸、铅笔描边、零圆角 —— 它是钉在绘图室墙上的一张
 * 索引卡，不是通用 debug 面板。
 */
export function TestPanel({ unknown }: { unknown?: string }) {
  return (
    <div className="tp">
      <div className="tp-card">
        <p className="tp-year">测试入口</p>
        <h1 className="tp-title">跳到任意一站</h1>

        {unknown !== undefined && (
          <p className="tp-miss">
            <code>{unknown}</code> 不是有效的去处。下面这些可以。
          </p>
        )}

        <p className="tp-how">
          地址栏里写 <code>#/test/3-02</code>，就是 3 号线第 2 站。站号和界面上那块
          站号牌是同一套写法，看到什么码就能敲什么码。
        </p>

        {/* 游戏排在最前，它们是最常要跳的去处 */}
        <section className="tp-group">
          <h2 className="tp-group-name">游戏</h2>
          <ul className="tp-list">
            {Object.entries(GAMES).map(([line, id]) => {
              const slug = id === 'booking' ? 'ticket' : 'drawing';
              return (
                <li key={id}>
                  <a href={hrefFor(slug)}>
                    <code>{slug}</code>
                    <span>{describe({ kind: 'game', line: Number(line) })}</span>
                  </a>
                </li>
              );
            })}
            <li>
              <a href={hrefFor('end')}>
                <code>end</code>
                <span>终点，线网图</span>
              </a>
            </li>
          </ul>
        </section>

        {/* 四条线，每条列出全部站 */}
        {LINES.map((l, line) => (
          <section key={l.id} className="tp-group" style={{ '--line': l.color } as React.CSSProperties}>
            <h2 className="tp-group-name">
              <span className="tp-badge">{l.id}</span>
              {l.name}
            </h2>
            <ul className="tp-list">
              {l.questions.map((q, stop) => {
                const code = `${l.id}-${String(stop + 1).padStart(2, '0')}`;
                return (
                  <li key={q.station}>
                    <a href={hrefFor(code)}>
                      <code>{code}</code>
                      <span>{q.station}</span>
                    </a>
                  </li>
                );
              })}
              {line < LINES.length - 1 && (
                <li>
                  <a href={hrefFor(`${l.id}-x`)}>
                    <code>{l.id}-x</code>
                    <span>本线走完，换乘页</span>
                  </a>
                </li>
              )}
            </ul>
          </section>
        ))}

        <p className="tp-also">
          也认线路短名：<code>origins</code> <code>engineering</code>{' '}
          <code>drawings</code> <code>operations</code>，跳到那条线开头。
          单个数字 <code>{parseTarget('3') ? '3' : ''}</code> 是 3 号线第一站。
        </p>

        <p className="tp-back">
          <a href="#/">回到正常流程</a>
        </p>
      </div>
    </div>
  );
}
