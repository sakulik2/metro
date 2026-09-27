import { KEYS, LINES, TOTAL_STOPS, stopCode } from '../data/lines';
import './StopList.css';

type Props = {
  pickAt: (line: number, stop: number) => number | null;
};

/**
 * 站点一览：全部题目平铺成纯文本，答过的站标出对错。
 * 它读的是同一份 picks，不另存一套状态，所以不会和答题区不同步。
 */
export function StopList({ pickAt }: Props) {
  return (
    <section>
      <h2 className="list-head">站点一览</h2>
      <p className="list-sub">
        {LINES.length} 条线，全程 {TOTAL_STOPS} 站。已答过的站会标出对错。
      </p>

      {LINES.map((l, line) => (
        <section
          key={l.id}
          className="list-line"
          style={{ '--line': l.color } as React.CSSProperties}
        >
          <div className="list-line-head">
            <span className="badge badge-sm">{l.id}</span>
            <h3 className="list-line-name">{l.name}</h3>
          </div>

          <ol className="list">
            {l.questions.map((q, stop) => {
              const pick = pickAt(line, stop);
              const answered = pick !== null;

              return (
                <li key={q.station} className="list-stop">
                  <p className="list-q">
                    {stopCode(line, stop)}　{q.q}
                  </p>

                  <ul className="list-opts">
                    {q.options.map((text, i) => {
                      const verdict = !answered
                        ? undefined
                        : i === q.answer
                          ? 'right'
                          : i === pick
                            ? 'wrong'
                            : undefined;
                      return (
                        <li key={text} data-verdict={verdict}>
                          <b>{KEYS[i]}</b>
                          <span>{text}</span>
                        </li>
                      );
                    })}
                  </ul>

                  {answered && <p className="list-note">{q.explain}</p>}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </section>
  );
}
