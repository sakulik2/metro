import './PlatformEdge.css';

type Props = {
  /** 本站的提示。答完之后不再显示。 */
  hint: string | null;
  nextLabel: string;
  nextDisabled: boolean;
  onNext: () => void;
};

/**
 * 页脚那条线路色实带，就是站台边缘。
 * 提示用原生 <details>，不需要 JS。
 */
export function PlatformEdge({ hint, nextLabel, nextDisabled, onNext }: Props) {
  return (
    <footer className="edge">
      <div className="col edge-row">
        {hint !== null && (
          <details className="hint">
            <summary className="hint-open">看提示</summary>
            <p className="hint-body">{hint}</p>
          </details>
        )}
        <button
          type="button"
          className="next"
          disabled={nextDisabled}
          onClick={onNext}
        >
          {nextLabel}
        </button>
      </div>
    </footer>
  );
}
