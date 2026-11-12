/**
 * timeline: 年表。横線が左から伸び、点がポンと出て、時期と出来事が順に現れる。
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
  colors,
  draw,
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
  name: '年表',
  description: '2〜6 個の出来事を時系列に並べる。線が伸び、点と出来事が順に現れる。',
  defaultSeconds: 7,
  order: 35,
};

export const schema = z.object({
  heading: field.text('見出し', 'ブロックチェーンの歩み', { max: 40, marks: true }),
  events: field.rows(
    '出来事',
    {
      when: field.text('時期', '2000年', { max: 12 }),
      what: field.text('出来事', '出来事', { max: 36, marks: true }),
    },
    [
      { when: '2008年', what: 'ビットコインの[[論文]]が公開' },
      { when: '2009年', what: '最初のブロックができる' },
      { when: '2015年', what: 'イーサリアムが始まる' },
      { when: '2020年代', what: 'お金以外の記録にも広がる' },
    ],
    { min: 2, max: 6, itemTitle: '出来事' },
  ),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const n = props.events.length;
  const lineY = props.caption.trim() === '' ? 390 : 370;
  const x0 = layout.padX + 30;
  const x1 = 1280 - layout.padX - 30;
  const step = (x1 - x0) / n;
  const colW = Math.min(240, step - 16);
  const whatSize = fitFontSizeAll(
    props.events.map((e) => e.what),
    { maxWidth: colW, max: 28, min: 18, maxLines: 3 },
  );
  const whenSize = fitFontSizeAll(
    props.events.map((e) => e.when),
    { maxWidth: colW, max: 34, min: 20, maxLines: 1 },
  );
  const until = settleBy(durationInFrames, 0.5);
  const line = draw(frame, 8, Math.max(12, until - 8));

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      <svg width={1280} height={720} style={{ position: 'absolute', inset: 0 }}>
        <line
          x1={x0 - 20}
          y1={lineY}
          x2={x1 + 20}
          y2={lineY}
          stroke={colors.sub}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={line.strokeDasharray}
          strokeDashoffset={line.strokeDashoffset}
        />
      </svg>
      {props.events.map((e, i) => {
        const cx = x0 + step * (i + 0.5);
        const s = stagger(i, n, 14, until, 12);
        const dot = back(frame, s, 14);
        const label = progress(frame, s + 4, T.enter);
        return (
          <div key={i}>
            <div
              style={{
                position: 'absolute',
                left: cx,
                top: lineY,
                width: 26,
                height: 26,
                borderRadius: '50%',
                background: accent(i),
                border: `5px solid ${colors.bg}`,
                transform: `translate(-50%, -50%) scale(${dot})`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: cx - colW / 2,
                width: colW,
                bottom: 720 - lineY + 30,
                textAlign: 'center',
                color: accent(i),
                fontSize: whenSize,
                fontWeight: font.weight.black,
                opacity: label,
                transform: `translateY(${mix(label, 16, 0)}px)`,
                ...wrapStyle,
              }}
            >
              {e.when}
            </div>
            <div
              style={{
                position: 'absolute',
                left: cx - colW / 2,
                width: colW,
                top: lineY + 32,
                display: 'flex',
                justifyContent: 'center',
                opacity: label,
                transform: `translateY(${mix(label, -16, 0)}px)`,
              }}
            >
              <FitText text={e.what} maxWidth={colW} max={whatSize} min={whatSize} maxLines={3} frame={frame} markStart={s + T.enter} style={{ textAlign: 'center' }} />
            </div>
          </div>
        );
      })}
      <Caption text={props.caption} frame={frame} start={until + 6} />
    </Fill>
  );
};
