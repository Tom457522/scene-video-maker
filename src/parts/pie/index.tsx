/**
 * pie: 円グラフ(ドーナツ型)。割合や内訳を見せる。区切りが順に描かれ、横に凡例と割合が出る。
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
  ease,
  field,
  fitFontSizeToBox,
  font,
  layout,
  mix,
  progress,
  settleBy,
  wrapStyleTight,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '円グラフ',
  description: '割合・内訳を円グラフ(ドーナツ型)で見せる。区切りが順に描かれ、凡例に割合が出る。',
  defaultSeconds: 6,
  order: 42,
};

export const schema = z.object({
  heading: field.text('見出し', '例: 使われている分野の割合', { max: 40, marks: true }),
  slices: field.rows(
    '区切り',
    {
      label: field.text('ラベル', '項目', { max: 16 }),
      value: field.number('値', 10, { min: 0, step: 1 }),
    },
    [
      { label: 'お金のやりとり', value: 45 },
      { label: '物流の記録', value: 25 },
      { label: '証明書', value: 18 },
      { label: 'その他', value: 12 },
    ],
    { min: 2, max: 6, itemTitle: '区切り' },
  ),
  centerLabel: field.text('真ん中の文字', '用途', { max: 8, description: '空欄なら出さない' }),
  caption: field.text('字幕', '数値は説明用の例です', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

/** 区切りの色(強調色 3 つのあと、薄めの補助の色を使う) */
const sliceColor = (i: number) => (i < 3 ? accent(i) : alpha(colors.sub, [0.75, 0.5, 0.3][(i - 3) % 3]));

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const hasCaption = props.caption.trim() !== '';
  const top = layout.contentTop;
  const bottom = hasCaption ? layout.contentBottom : layout.contentBottomFull;
  const r = Math.min(170, (bottom - top) / 2 - 20);
  const stroke = r * 0.42;
  const cx = layout.padX + r + 40;
  const cy = (top + bottom) / 2;
  const total = Math.max(1e-9, props.slices.reduce((s, x) => s + Math.max(0, x.value), 0));
  const until = settleBy(durationInFrames, 0.5);
  const drawP = progress(frame, 8, Math.max(16, until - 8), ease.inOut);
  const circ = 2 * Math.PI * r;

  const legendX = cx + r + stroke / 2 + 70;
  const legendW = 1280 - layout.padX - legendX;
  const n = props.slices.length;
  const rowH = Math.min(70, (bottom - top) / n);
  const labelSize = fitFontSizeToBox(
    props.slices.map((s) => s.label),
    { maxWidth: legendW - 160, maxHeight: rowH - 6, max: 30, min: 14, lineHeight: 1.2 },
  );

  const fracs = props.slices.map((s) => Math.max(0, s.value) / total);
  const arcs = fracs.map((frac, i) => {
    // それより前の区切りの合計が、この区切りの始まり
    const start = fracs.slice(0, i).reduce((a, b) => a + b, 0);
    // 全体の描き進み(drawP)に合わせて、この区切りが見えている長さ
    const visible = Math.max(0, Math.min(frac, drawP - start));
    return { i, frac, start, visible };
  });

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      <svg width={1280} height={720} style={{ position: 'absolute', inset: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={alpha(colors.sub, 0.12)} strokeWidth={stroke} />
        {arcs.map((a) =>
          a.visible > 0 ? (
            <circle
              key={a.i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={sliceColor(a.i)}
              strokeWidth={stroke}
              strokeDasharray={`${a.visible * circ} ${circ}`}
              strokeDashoffset={-a.start * circ}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ) : null,
        )}
      </svg>
      {props.centerLabel.trim() !== '' && (
        <div
          style={{
            position: 'absolute',
            left: cx - r,
            width: r * 2,
            top: cy,
            transform: 'translateY(-50%)',
            textAlign: 'center',
            fontSize: Math.min(34, r * 0.26),
            fontWeight: font.weight.black,
            color: colors.sub,
            opacity: progress(frame, until, 12),
          }}
        >
          {props.centerLabel}
        </div>
      )}
      <div style={{ position: 'absolute', left: legendX, top: cy - (rowH * n) / 2, width: legendW }}>
        {arcs.map((a) => {
          const at = 8 + (until - 8) * a.start;
          const p = progress(frame, at, T.enter);
          const pct = progress(frame, at, 24, ease.out);
          return (
            <div key={a.i} style={{ display: 'flex', alignItems: 'center', gap: 16, height: rowH, opacity: p, transform: `translateX(${mix(p, 30, 0)}px)` }}>
              <div style={{ flex: 'none', width: 22, height: 22, borderRadius: 6, background: sliceColor(a.i) }} />
              <div style={{ flex: 1, fontSize: labelSize, lineHeight: 1.2, ...wrapStyleTight }}>{props.slices[a.i].label}</div>
              <div style={{ flex: 'none', width: 130, textAlign: 'right', fontSize: Math.min(36, rowH * 0.5), fontWeight: font.weight.black, color: a.i < 3 ? accent(a.i) : colors.text, fontVariantNumeric: 'tabular-nums' }}>
                {countUp(pct, a.frac * 100, a.frac * 100 < 10 ? 1 : 0)}
                <span style={{ fontSize: '0.55em', color: colors.sub, marginLeft: 2 }}>%</span>
              </div>
            </div>
          );
        })}
      </div>
      <Caption text={props.caption} frame={frame} start={until} />
    </Fill>
  );
};
