import { LINES, lineTitle } from '../data/lines';
import type { Question } from '../data/types';
import './Transfer.css';

type Props = {
  line: number;
  score: number;
  stopsOnLine: number;
  /** 本线答错的站。空数组表示全线答对。 */
  missed: { q: Question; stop: number }[];
};

/**
 * 一条线走完后的换乘页。
 * 不只报分：列出漏掉的站和正确答案，空屏是行动的邀请而不是留白。
 */
export function Transfer({ line, score, stopsOnLine, missed }: Props) {
  const next = LINES[line + 1];

  return (
    <>
      <h2 className="xfer-done" id="result" tabIndex={-1}>
        {lineTitle(line)}　走完
      </h2>
      <p className="xfer-sub">
        这条线 {stopsOnLine} 站，答对 {score} 站。
      </p>

      {missed.length === 0 ? (
        <p className="xfer-all">全线答对。</p>
      ) : (
        <ul className="xfer-miss">
          {missed.map(({ q }) => (
            <li key={q.station}>
              <b>{q.station}</b>
              <span>{q.options[q.answer]}</span>
            </li>
          ))}
        </ul>
      )}

      <hr className="xfer-rule" />

      {next && (
        <div className="xfer-next">
          <span
            className="badge badge-sm"
            style={{ '--line': next.color } as React.CSSProperties}
          >
            {next.id}
          </span>
          <p className="xfer-to">
            {next.name}
            <small>接下来 {next.questions.length} 站</small>
          </p>
        </div>
      )}
    </>
  );
}
