/**
 * title: 動画の最初に置く表題。文字が 1 文字ずつ跳ねて登場し、下線とサブタイトルが続く。
 */
import {
  type PartComponent,
  type PartMeta,
  Fill,
  T,
  accent,
  alpha,
  back,
  bump,
  colors,
  drift,
  field,
  fitFontSize,
  font,
  layout,
  measureEm,
  mix,
  progress,
  ease,
  settleBy,
  wrapStyle,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: 'タイトル',
  description: '動画の表題。文字が 1 文字ずつ跳ねて登場し、下線とサブタイトルが続く。',
  defaultSeconds: 4,
};

export const schema = z.object({
  kicker: field.text('上の小見出し', '解説', { max: 20, description: '空欄にすると出しません' }),
  title: field.text('タイトル', 'ブロックチェーン', { max: 40 }),
  subtitle: field.text('サブタイトル', 'しくみを 3 分で', { max: 60, description: '空欄にすると出しません' }),
});

/** 周りに漂う図形 */
const shapes = [
  { kind: 'circle', x: 170, y: 150, size: 70 },
  { kind: 'triangle', x: 1090, y: 170, size: 80 },
  { kind: 'square', x: 1120, y: 560, size: 60 },
  { kind: 'plus', x: 210, y: 560, size: 50 },
  { kind: 'circle', x: 980, y: 90, size: 28 },
] as const;

const Shape = ({ kind, size, color }: { kind: (typeof shapes)[number]['kind']; size: number; color: string }) => {
  const s = size / 2;
  const common = { fill: 'none', stroke: color, strokeWidth: 5, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const };
  return (
    <svg width={size + 10} height={size + 10} viewBox={`${-s - 5} ${-s - 5} ${size + 10} ${size + 10}`} style={{ overflow: 'visible' }}>
      {kind === 'circle' && <circle r={s} {...common} />}
      {kind === 'square' && <rect x={-s} y={-s} width={size} height={size} rx={8} {...common} />}
      {kind === 'triangle' && <polygon points={`0,${-s} ${s},${s * 0.8} ${-s},${s * 0.8}`} {...common} />}
      {kind === 'plus' && <path d={`M0 ${-s} V${s} M${-s} 0 H${s}`} {...common} />}
    </svg>
  );
};

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const chars = Array.from(props.title);
  const maxWidth = layout.contentWidth;
  const size = fitFontSize(props.title, { maxWidth, max: font.size.hero, min: 52, maxLines: 2, letterSpacing: 0.02 });

  // 1 文字ずつの登場。長い題でも、全体の 45% までに出そろうよう間隔を詰める
  const charsFrom = 8;
  const charsUntil = Math.max(charsFrom, settleBy(durationInFrames, 0.45) - 14);
  const gap = chars.length > 1 ? Math.min(3, (charsUntil - charsFrom) / (chars.length - 1)) : 0;
  const charsDone = charsFrom + gap * Math.max(0, chars.length - 1) + 14;

  const kickerP = progress(frame, 0, T.enter);
  const lineP = progress(frame, charsDone - 4, 18, ease.inOut);
  const subP = progress(frame, charsDone + 4, T.enter);

  // 下線の幅は文字幅の見積もりから決める(2 行になるときは最大幅)
  const lineWidth = Math.min(maxWidth, measureEm(props.title) * size * 1.02);

  return (
    <Fill>
      {shapes.map((sh, i) => {
        const appear = back(frame, 4 + i * 4, 20);
        const dx = drift(frame, 150 + i * 23, i * 0.21) * 14;
        const dy = drift(frame, 120 + i * 31, i * 0.37) * 18;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: sh.x,
              top: sh.y,
              opacity: 0.85 * Math.min(1, appear),
              transform: `translate(-50%, -50%) translate(${dx}px, ${dy}px) rotate(${frame * (i % 2 === 0 ? 0.4 : -0.3)}deg) scale(${appear})`,
            }}
          >
            <Shape kind={sh.kind} size={sh.size} color={accent(i)} />
          </div>
        );
      })}

      <Fill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: `0 ${layout.padX}px` }}>
        {props.kicker.trim() !== '' && (
          <div
            style={{
              marginBottom: 28,
              padding: '6px 22px',
              borderRadius: 999,
              border: `2px solid ${colors.teal}`,
              color: colors.teal,
              fontSize: font.size.small,
              letterSpacing: '0.12em',
              opacity: kickerP,
              transform: `translateY(${mix(kickerP, -14, 0)}px)`,
            }}
          >
            {props.kicker}
          </div>
        )}

        <div
          style={{
            maxWidth,
            textAlign: 'center',
            fontSize: size,
            fontWeight: font.weight.black,
            lineHeight: 1.25,
            letterSpacing: '0.02em',
            ...wrapStyle,
          }}
        >
          {chars.map((ch, i) => {
            const s = charsFrom + i * gap;
            const p = back(frame, s, 16);
            const fade = progress(frame, s, 6, ease.linear);
            const land = bump(frame, s + 10, 8);
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  whiteSpace: 'pre',
                  opacity: fade,
                  transform: `translateY(${mix(p, -0.8 * size, 0)}px) scale(${1 + land * 0.08}, ${1 - land * 0.06})`,
                  transformOrigin: 'center bottom',
                }}
              >
                {ch}
              </span>
            );
          })}
        </div>

        <div
          style={{
            width: lineWidth,
            height: 8,
            marginTop: 18,
            borderRadius: 4,
            background: colors.yellow,
            transform: `scaleX(${lineP})`,
            transformOrigin: 'center',
          }}
        />

        {props.subtitle.trim() !== '' && (
          <div
            style={{
              marginTop: 30,
              maxWidth,
              textAlign: 'center',
              color: colors.sub,
              fontSize: fitFontSize(props.subtitle, { maxWidth, max: 40, min: 24, maxLines: 2 }),
              fontWeight: font.weight.bold,
              lineHeight: 1.4,
              opacity: subP,
              transform: `translateY(${mix(subP, 20, 0)}px)`,
              textShadow: `0 2px 12px ${alpha(colors.bg, 0.8)}`,
              ...wrapStyle,
            }}
          >
            {props.subtitle}
          </div>
        )}
      </Fill>
    </Fill>
  );
};
