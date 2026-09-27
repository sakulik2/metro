import type { Coin } from '../money/coins';
import './CoinFace.css';

type Props = {
  coin: Coin;
  /** 叠了几枚。1 枚时不显示角标。 */
  count?: number;
  onClick?: () => void;
  disabled?: boolean;
};

/**
 * 一枚硬币，按真实直径画。
 *
 * 比例是这一关的主角：银三便士 16mm 比青铜法寻 20mm 还小，却值它 12 倍。
 * 换算成像素后差出两倍半，这个荒谬只有画出来才讲得清。
 */
export function CoinFace({ coin, count, onClick, disabled }: Props) {
  const size = `${coin.diameter * 1.7}px`;

  const body = (
    <>
      <span className="coin-mark">{coin.mark}</span>
      {count !== undefined && count > 1 && (
        <span className="coin-count" aria-hidden="true">
          {count}
        </span>
      )}
    </>
  );

  const style = { '--size': size } as React.CSSProperties;
  // 小币面上放不下两个字符，交给 CSS 缩一号
  const small = coin.diameter <= 19 || undefined;
  const label = `${coin.name} ${coin.mark}，直径 ${coin.diameter} 毫米`;

  if (!onClick) {
    return (
      <span
        className="coin"
        data-metal={coin.metal}
        data-small={small}
        style={style}
        title={label}
      >
        {body}
      </span>
    );
  }

  return (
    <button
      type="button"
      className="coin coin-pick"
      data-metal={coin.metal}
      data-small={small}
      style={style}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
    >
      {body}
    </button>
  );
}
