/**
 * qa: よくある質問(Q&A)。質問が出たあと、少し間をおいて答えが現れる。
 */
import {
  type PartComponent,
  type PartMeta,
  Fill,
  FitText,
  T,
  alpha,
  back,
  colors,
  field,
  fitFontSize,
  font,
  layout,
  mix,
  progress,
  settleBy,
  surface,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: 'Q&A',
  description: 'よくある質問と答え。質問のあと、少し間をおいて答えが現れる。',
  defaultSeconds: 7,
  order: 70,
};

export const schema = z.object({
  question: field.longText('質問', 'ブロックチェーンの記録は、本当に書き換えられないの?', { max: 80, marks: true }),
  answer: field.longText('答え', '[[絶対ではありません]]。ただ、書き換えるには参加者の多くを同時に動かす必要があり、現実的にはとても難しくなっています。', {
    max: 160,
    marks: true,
  }),
});

const BADGE = 76;

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const textW = layout.contentWidth - BADGE - 24 - 64;
  const qSize = fitFontSize(props.question, { maxWidth: textW, max: 40, min: 24, maxLines: 3 });
  const aSize = fitFontSize(props.answer, { maxWidth: textW, max: 34, min: 20, maxLines: 5 });
  const aStart = Math.min(settleBy(durationInFrames, 0.4), 40);
  const cards = [
    { badge: 'Q', text: props.question, size: qSize, color: colors.coral, start: 4 },
    { badge: 'A', text: props.answer, size: aSize, color: colors.teal, start: aStart },
  ];

  return (
    <Fill style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 28, padding: `0 ${layout.padX}px` }}>
      {cards.map((c) => {
        const b = back(frame, c.start, T.enter);
        const t = progress(frame, c.start + 6, T.enter);
        return (
          <div key={c.badge} style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <div
              style={{
                flex: 'none',
                width: BADGE,
                height: BADGE,
                borderRadius: 20,
                background: c.color,
                color: colors.onAccent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 44,
                fontWeight: font.weight.black,
                transform: `scale(${b}) rotate(${mix(Math.min(b, 1), -30, 0)}deg)`,
              }}
            >
              {c.badge}
            </div>
            <div
              style={{
                flex: 1,
                padding: '20px 32px',
                borderRadius: 20,
                background: c.badge === 'Q' ? surface.fill : alpha(c.color, 0.1),
                border: `2px solid ${alpha(c.color, 0.5)}`,
                opacity: t,
                transform: `translateX(${mix(t, 40, 0)}px)`,
              }}
            >
              <FitText text={c.text} maxWidth={textW} max={c.size} min={c.size} maxLines={5} frame={frame} markStart={c.start + T.enter + 4} />
            </div>
          </div>
        );
      })}
    </Fill>
  );
};
