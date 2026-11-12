/**
 * line: 折れ線グラフ。推移を見せる。線が左から描かれ、点がポンと出て、値が表示される。
 */
import {
  type PartComponent,
  type PartMeta,
  Caption,
  Fill,
  Heading,
  T,
  alpha,
  back,
  colors,
  countUp,
  draw,
  field,
  fitFontSize,
  font,
  layout,
  progress,
  settleBy,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '折れ線グラフ',
  description: '2〜10 個の値の推移を折れ線で見せる。線が左から描かれ、点と値が順に出る。',
  defaultSeconds: 6,
  order: 41,
};

export const schema = z.object({
  heading: field.text('見出し', '例: 利用者数の推移', { max: 40, marks: true }),
  points: field.rows(
    '点',
    {
      label: field.text('ラベル(横軸)', '2020', { max: 10 }),
      value: field.number('値', 10, { step: 1 }),
    },
    [
      { label: '2019', value: 12 },
      { label: '2020', value: 18 },
      { label: '2021', value: 35 },
      { label: '2022', value: 42 },
      { label: '2023', value: 58 },
      { label: '2024', value: 80 },
    ],
    { min: 2, max: 10, itemTitle: '点' },
  ),
  unit: field.text('単位', '万人', { max: 8 }),
  caption: field.text('字幕', '数値は説明用の例です', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

const decimalsOf = (v: number): number => Math.min(2, (String(v).split('.')[1] ?? '').length);

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const hasCaption = props.caption.trim() !== '';
  const n = props.points.length;
  const x0 = layout.padX + 70;
  const x1 = 1280 - layout.padX - 30;
  const y0 = layout.contentTop + 50;
  const y1 = (hasCaption ? layout.contentBottom : layout.contentBottomFull) - 46;
  const values = props.points.map((p) => p.value);
  const lo = Math.min(0, ...values);
  const hi = Math.max(...values, lo + 1e-9);
  const span = hi - lo || 1;
  const xOf = (i: number) => (n === 1 ? (x0 + x1) / 2 : x0 + ((x1 - x0) * i) / (n - 1));
  const yOf = (v: number) => y1 - ((v - lo) / span) * (y1 - y0);
  const pts = props.points.map((p, i) => ({ x: xOf(i), y: yOf(p.value), ...p }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const until = settleBy(durationInFrames, 0.55);
  const axis = draw(frame, 2, 14);
  const line = draw(frame, 10, Math.max(16, until - 10));
  const labelW = (x1 - x0) / Math.max(1, n - 1);
  const labelSize = Math.min(...props.points.map((p) => fitFontSize(p.label, { maxWidth: Math.max(40, labelW - 6), max: 24, min: 12, maxLines: 1 })));
  const valueTexts = pts.map((p) => `${countUp(1, p.value, decimalsOf(p.value))}`);
  const valueSize = Math.min(...valueTexts.map((t) => fitFontSize(t, { maxWidth: Math.max(40, labelW - 8), max: 26, min: 12, maxLines: 1 })));

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      <svg width={1280} height={720} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path
          d={`M ${x0 - 30} ${y0 - 20} L ${x0 - 30} ${y1} L ${x1 + 20} ${y1}`}
          fill="none"
          stroke={alpha(colors.sub, 0.5)}
          strokeWidth={3}
          pathLength={1}
          strokeDasharray={axis.strokeDasharray}
          strokeDashoffset={axis.strokeDashoffset}
        />
        <path d={`${d} L ${pts[n - 1].x} ${y1} L ${pts[0].x} ${y1} Z`} fill={alpha(colors.teal, 0.12 * line.progress)} />
        <path
          d={d}
          fill="none"
          stroke={colors.teal}
          strokeWidth={6}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={line.strokeDasharray}
          strokeDashoffset={line.strokeDashoffset}
        />
        {pts.map((p, i) => {
          // 線がその点を通り過ぎるころに点を出す
          const at = 10 + (Math.max(16, until - 10) * i) / Math.max(1, n - 1);
          const s = back(frame, at, 12);
          return <circle key={i} cx={p.x} cy={p.y} r={9 * s} fill={i === n - 1 ? colors.yellow : colors.teal} stroke={colors.bg} strokeWidth={3} />;
        })}
      </svg>
      {pts.map((p, i) => {
        const at = 10 + (Math.max(16, until - 10) * i) / Math.max(1, n - 1);
        const v = progress(frame, at + 4, T.enter);
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: p.x - labelW / 2,
                width: labelW,
                top: p.y - valueSize - 22,
                textAlign: 'center',
                fontSize: valueSize,
                fontWeight: font.weight.black,
                color: i === n - 1 ? colors.yellow : colors.text,
                opacity: v,
                fontVariantNumeric: 'tabular-nums',
                whiteSpace: 'nowrap',
              }}
            >
              {valueTexts[i]}
              {i === n - 1 && <span style={{ fontSize: '0.6em', color: colors.sub, marginLeft: 3 }}>{props.unit}</span>}
            </div>
            <div
              style={{
                position: 'absolute',
                left: p.x - labelW / 2,
                width: labelW,
                top: y1 + 12,
                textAlign: 'center',
                fontSize: labelSize,
                color: colors.sub,
                opacity: progress(frame, 4, 12),
                whiteSpace: 'nowrap',
              }}
            >
              {p.label}
            </div>
          </div>
        );
      })}
      <Caption text={props.caption} frame={frame} start={until} />
    </Fill>
  );
};
