/**
 * quote: 引用・名言・大事な一文を大きく見せる。引用符がポンと出て、文が少しずつ現れる。
 */
import {
  type PartComponent,
  type PartMeta,
  Fill,
  MarkedText,
  T,
  alpha,
  back,
  colors,
  drift,
  field,
  fitFontSize,
  font,
  mix,
  parseMarks,
  progress,
  settleBy,
  wrapStyle,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '引用',
  description: '名言・大事な一文・利用者の声などを、大きな文字で見せる。',
  defaultSeconds: 6,
  order: 65,
};

export const schema = z.object({
  text: field.longText('文', 'ブロックチェーンは、[[信頼]]をしくみで置き換える技術だ。', { max: 120, marks: true }),
  source: field.text('出典・話した人', '', { max: 40, description: '空欄なら出さない' }),
});

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const size = fitFontSize(props.text, { maxWidth: 940, max: 58, min: 30, maxLines: 4 });
  const mark = back(frame, 2, T.enter);
  const until = settleBy(durationInFrames, 0.45);
  // 文は左から右へ、覆いが外れるように現れる
  const reveal = progress(frame, 10, Math.max(12, until - 10));
  const source = progress(frame, until, T.enter);
  const hasMarks = parseMarks(props.text).some((s) => s.marked);

  return (
    <Fill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 940, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <svg
        width={150}
        height={110}
        viewBox="0 0 150 110"
        style={{
          marginLeft: -10,
          overflow: 'visible',
          transform: `scale(${mark}) rotate(${mix(Math.min(mark, 1), -20, 0) + drift(frame, 180) * 2}deg)`,
          transformOrigin: '30% 60%',
        }}
      >
        {/* 引用符「“」を 2 つの丸としっぽで描く */}
        {[10, 78].map((x) => (
          <path
            key={x}
            fill={alpha(colors.yellow, 0.9)}
            d={`M ${x + 28} 98 a 28 28 0 1 1 0.1 0 Z M ${x + 2} 72 C ${x} 40 ${x + 18} 12 ${x + 54} 4 L ${x + 58} 18 C ${x + 34} 28 ${x + 26} 46 ${x + 28} 62 Z`}
          />
        ))}
      </svg>
        <div
          style={{
            fontSize: size,
            lineHeight: 1.55,
            fontWeight: font.weight.bold,
            clipPath: `inset(0 ${100 - reveal * 100}% 0 0)`,
            ...wrapStyle,
          }}
        >
          <MarkedText text={props.text} frame={frame} markStart={hasMarks ? until + 4 : 0} />
        </div>
        {props.source.trim() !== '' && (
          <div
            style={{
              alignSelf: 'flex-end',
              fontSize: 28,
              color: colors.sub,
              opacity: source,
              transform: `translateX(${mix(source, 30, 0)}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div style={{ width: 40 * source, height: 3, background: colors.sub }} />
            {props.source}
          </div>
        )}
      </div>
    </Fill>
  );
};
