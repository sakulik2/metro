import { KEYS, stopCode } from '../data/lines';
import type { Question } from '../data/types';
import './Station.css';

type Props = {
  line: number;
  stop: number;
  question: Question;
  stopsOnLine: number;
  totalStops: number;
  /** 选了哪一项，null 表示还没答。 */
  pick: number | null;
  onChoose: (option: number) => void;
};

/** 一站 = 一道题。选完立刻判对错，附一句解释。 */
export function Station({
  line,
  stop,
  question,
  stopsOnLine,
  totalStops,
  pick,
  onChoose,
}: Props) {
  const answered = pick !== null;
  const won = pick === question.answer;

  return (
    <>
      <div className="stop-code">
        <b>{stopCode(line, stop)}</b>
        <span>
          本线 {stopsOnLine} 站　全程 {totalStops} 站
        </span>
      </div>

      <h2 className="ask" id="ask">
        {question.q}
      </h2>

      <div className="picks" role="group" aria-labelledby="ask">
        {question.options.map((text, i) => {
          const verdict = !answered
            ? undefined
            : i === question.answer
              ? 'right'
              : i === pick
                ? 'wrong'
                : undefined;

          return (
            <button
              key={text}
              type="button"
              className="pick"
              data-verdict={verdict}
              aria-disabled={answered || undefined}
              onClick={answered ? undefined : () => onChoose(i)}
            >
              <span className="pick-key">{KEYS[i]}</span>
              <span className="pick-text">{text}</span>
            </button>
          );
        })}
      </div>

      {/* 判定与解释。aria-live 让读屏在选完后播报结果。 */}
      <div className="note" aria-live="polite">
        {answered && (
          <>
            <hr className="note-rule" />
            <p className="note-call" data-verdict={won ? 'right' : 'wrong'}>
              {won ? '答对了' : `正确答案是 ${KEYS[question.answer]}`}
            </p>
            <p className="note-why">{question.explain}</p>
          </>
        )}
      </div>
    </>
  );
}
