import { LINES, TOTAL_STOPS } from '../data/lines';
import type { Mark } from '../state/journey';
import './NetworkMap.css';

type Props = {
  total: number;
  scoreOf: (line: number) => number;
  markOf: (line: number, stop: number) => Mark;
  onRestart: () => void;
};

/**
 * 终点页。四条线并列成一张线网图，每站一个圆点：
 * 实心答对、空心答错，一眼看出哪条线薄弱。
 */
export function NetworkMap({ total, scoreOf, markOf, onRestart }: Props) {
  return (
    <>
      <h2 className="end-count" id="result" tabIndex={-1}>
        答对 {total} 站
      </h2>
      <p className="end-sub">
        {LINES.length} 条线，全程 {TOTAL_STOPS} 站，已到终点。
      </p>

      <ul className="net">
        {LINES.map((l, line) => (
          <li
            key={l.id}
            className="net-row"
            style={{ '--line': l.color } as React.CSSProperties}
          >
            <span className="badge badge-sm">{l.id}</span>
            <span className="net-name">{l.name}</span>

            <span className="net-dots">
              {l.questions.map((q, stop) => (
                <span
                  key={q.station}
                  className="net-dot"
                  data-mark={markOf(line, stop)}
                />
              ))}
            </span>

            <span className="net-score">
              {scoreOf(line)}/{l.questions.length}
            </span>
          </li>
        ))}
      </ul>

      <button type="button" className="solid" onClick={onRestart}>
        重新乘坐
      </button>
    </>
  );
}
