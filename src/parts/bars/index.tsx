/**
 * bars: 横棒グラフ。棒が伸びながら数字がカウントアップする。
 */
import {
  type PartComponent,
  type PartMeta,
  Caption,
  Fill,
  Heading,
  T,
  accent,
  alpha,
  colors,
  countUp,
  draw,
  ease,
  field,
  fitFontSizeAll,
  font,
  layout,
  mix,
  progress,
  settleBy,
  stagger,
  wrapStyle,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '横棒グラフ',
  description: '1〜6 本の横棒で量を比べる。棒が伸びながら数字がカウントアップする。',
  defaultSeconds: 6,
  order: 40,
};

export const schema = z.object({
  heading: field.text('見出し', '例: 知っている仮想通貨(アンケート)', { max: 40, marks: true }),
  rows: field.rows(
    '棒',
    {
      label: field.text('ラベル', '項目', { max: 16 }),
      value: field.number('値', 50, { min: 0, step: 1 }),
    },
    [
      { label: 'ビットコイン', value: 92 },
      { label: 'イーサリアム', value: 64 },
      { label: 'リップル', value: 41 },
      { label: 'その他', value: 18 },
    ],
    { min: 1, max: 6, itemTitle: '棒' },
  ),
  unit: field.text('単位', '%', { max: 8, description: '数字のうしろに付く(空欄可)' }),
  max: field.number('最大値', 0, { min: 0, description: '棒の長さの基準。0 なら一番大きい値に合わせる' }),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

const LABEL_W = 250;
const VALUE_W = 190;
const GAP = 24;

const decimalsOf = (v: number): number => Math.min(2, (String(v).split('.')[1] ?? '').length);

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const n = props.rows.length;
  const hasCaption = props.caption.trim() !== '';
  const top = layout.contentTop + 8;
  const bottom = hasCaption ? layout.contentBottom - 10 : layout.contentBottom + 40;
  const rowH = Math.min(96, (bottom - top) / n);
  const barH = Math.max(18, Math.min(44, rowH * 0.52));
  const barX = layout.padX + LABEL_W + GAP;
  const barMaxW = 1280 - layout.padX - VALUE_W - barX;
  const maxValue = props.max > 0 ? props.max : Math.max(1e-9, ...props.rows.map((r) => r.value));
  const labelSize = fitFontSizeAll(
    props.rows.map((r) => r.label),
    { maxWidth: LABEL_W, max: Math.min(30, Math.floor(rowH * 0.36)), min: 18, maxLines: 2 },
  );
  const valueSize = Math.min(36, rowH * 0.46);

  const axis = draw(frame, 6, 16);
  const usedH = rowH * n;
  const listTop = top + Math.max(0, (bottom - top - usedH) / 2);

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />

      {/* 棒の付け根の縦線 */}
      <svg width={1280} height={720} style={{ position: 'absolute', inset: 0 }}>
        <line
          x1={barX - 2}
          y1={listTop - 8}
          x2={barX - 2}
          y2={listTop + usedH + 8}
          stroke={alpha(colors.sub, 0.5)}
          strokeWidth={3}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={axis.strokeDasharray}
          strokeDashoffset={axis.strokeDashoffset}
        />
      </svg>

      {props.rows.map((row, i) => {
        const s = stagger(i, n, 14, settleBy(durationInFrames, 0.45), 10);
        const grow = progress(frame, s, 32, ease.out);
        const labelIn = progress(frame, s - 4, T.enter);
        const ratio = Math.min(1, Math.max(0, row.value / maxValue));
        const w = barMaxW * ratio * grow;
        const y = listTop + i * rowH + rowH / 2;
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: layout.padX,
                width: LABEL_W,
                top: y,
                transform: `translate(${mix(labelIn, -20, 0)}px, -50%)`,
                opacity: labelIn,
                textAlign: 'right',
                fontSize: labelSize,
                lineHeight: 1.2,
                color: colors.text,
                ...wrapStyle,
              }}
            >
              {row.label}
            </div>
            <div
              style={{
                position: 'absolute',
                left: barX,
                top: y - barH / 2,
                width: Math.max(0, w),
                height: barH,
                borderRadius: `0 ${barH / 3}px ${barH / 3}px 0`,
                background: `linear-gradient(90deg, ${alpha(accent(i), 0.65)}, ${accent(i)})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: barX + w + 16,
                top: y,
                transform: 'translateY(-50%)',
                opacity: progress(frame, s, 6),
                fontSize: valueSize,
                fontWeight: font.weight.black,
                color: accent(i),
                whiteSpace: 'nowrap',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {countUp(grow, row.value, decimalsOf(row.value))}
              <span style={{ fontSize: valueSize * 0.6, marginLeft: 4, color: colors.sub }}>{props.unit}</span>
            </div>
          </div>
        );
      })}

      <Caption text={props.caption} frame={frame} start={settleBy(durationInFrames, 0.45)} />
    </Fill>
  );
};
