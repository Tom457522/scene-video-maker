/**
 * steps: 手順を縦に並べる。左の線が上から伸び、番号の丸が順にポンと出て、文が右から入る。最後の手順に完了の印。
 * 横に並べる流れ図(flow)より多い、3〜8 個の手順に向く。
 */
import {
  type PartComponent,
  type PartMeta,
  Caption,
  Fill,
  FitText,
  Heading,
  T,
  accent,
  back,
  bump,
  colors,
  draw,
  field,
  fitFontSizeToBox,
  font,
  layout,
  mix,
  progress,
  settleBy,
  stagger,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '縦のステップ',
  description: '3〜8 個の手順を縦に並べる。線が伸び、番号が順に出て、最後に完了の印。',
  defaultSeconds: 7,
  order: 32,
};

export const schema = z.object({
  heading: field.text('見出し', '取引が記録されるまで', { max: 40, marks: true }),
  steps: field.list(
    '手順',
    ['利用者が取引を作って送る', 'ネットワークに[[取引が広がる]]', '参加者が取引を検証する', '検証済みの取引をブロックにまとめる', 'ブロックをチェーンにつなぐ'],
    { min: 2, max: 8, itemMax: 44, itemTitle: '手順', marks: true },
  ),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

const DOT = 46;

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const n = props.steps.length;
  const top = layout.contentTop - 6;
  const bottom = props.caption.trim() === '' ? layout.contentBottomFull : layout.contentBottom;
  const rowH = Math.min(96, (bottom - top) / n);
  const dot = Math.min(DOT, rowH - 10);
  const x = layout.padX + dot / 2 + 4;
  const textX = layout.padX + dot + 34;
  const textW = 1280 - layout.padX - textX;
  const size = fitFontSizeToBox(props.steps, { maxWidth: textW, maxHeight: rowH - 8, max: 34, min: 14 });
  const until = settleBy(durationInFrames, 0.5);
  const line = draw(frame, 8, Math.max(12, until - 4));
  const done = back(frame, until + 6, 16);
  const doneBump = bump(frame, until + 20, 10);

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      <svg width={1280} height={720} style={{ position: 'absolute', inset: 0 }}>
        <line
          x1={x}
          y1={top + rowH / 2}
          x2={x}
          y2={top + rowH * (n - 0.5)}
          stroke={colors.sub}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={line.strokeDasharray}
          strokeDashoffset={line.strokeDashoffset}
        />
      </svg>
      {props.steps.map((st, i) => {
        const s = stagger(i, n, 10, until, 10);
        const b = back(frame, s, T.enter);
        const t = progress(frame, s + 4, T.enter);
        const last = i === n - 1;
        const cy = top + rowH * (i + 0.5);
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: x - dot / 2,
                top: cy - dot / 2,
                width: dot,
                height: dot,
                borderRadius: '50%',
                background: last ? colors.yellow : accent(i % 2 === 0 ? 1 : 2),
                color: colors.onAccent,
                display: 'grid',
                placeItems: 'center',
                fontSize: dot * 0.46,
                fontWeight: font.weight.black,
                transform: `scale(${b * (last ? 1 + doneBump * 0.15 : 1)})`,
              }}
            >
              {last && done > 0.5 ? '✓' : i + 1}
            </div>
            <div style={{ position: 'absolute', left: textX, top: cy, transform: `translate(${mix(t, 50, 0)}px, -50%)`, opacity: t }}>
              <FitText text={st} maxWidth={textW} max={size} min={size} maxLines={4} frame={frame} markStart={s + T.enter} />
            </div>
          </div>
        );
      })}
      <Caption text={props.caption} frame={frame} start={until + 8} />
    </Fill>
  );
};
