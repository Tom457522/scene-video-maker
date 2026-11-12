/**
 * flow: 手順や流れ。ボックスが順に出現し、矢印が伸び、粒が矢印の上を行き来する。
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
  alpha,
  back,
  colors,
  draw,
  field,
  fitFontSizeAll,
  font,
  layout,
  pingPong,
  progress,
  settleBy,
  stagger,
  surface,
  ease,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '流れ図',
  description: '2〜5 個の手順を矢印でつなぐ。ボックスが順に出て、矢印の上を粒が行き来する。',
  defaultSeconds: 6,
  order: 30,
};

export const schema = z.object({
  heading: field.text('見出し', '取引が記録されるまで', { max: 40, marks: true }),
  steps: field.list('手順', ['取引する', 'みんなで検証', 'ブロックにまとめる', 'チェーンにつなぐ'], {
    min: 2,
    max: 5,
    itemMax: 24,
    itemTitle: '手順',
  }),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

const ARROW_GAP = 100;
const BOX_HEIGHT = 168;

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const n = props.steps.length;
  const boxW = Math.min(260, (layout.contentWidth - (n - 1) * ARROW_GAP) / n);
  const totalW = n * boxW + (n - 1) * ARROW_GAP;
  const left0 = (1280 - totalW) / 2;
  const centerY = props.caption.trim() === '' ? 420 : 400;
  const top = centerY - BOX_HEIGHT / 2;
  const textW = boxW - 36;
  const size = fitFontSizeAll(props.steps, { maxWidth: textW, max: 34, min: 20, maxLines: 3 });

  const starts = props.steps.map((_, i) => stagger(i, n, 12, settleBy(durationInFrames, 0.5), 22));
  const xOf = (i: number) => left0 + i * (boxW + ARROW_GAP);

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />

      {/* 矢印と粒(ボックスの下に描く) */}
      <svg width={1280} height={720} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {props.steps.slice(0, -1).map((_, i) => {
          const x1 = xOf(i) + boxW + 10;
          const x2 = xOf(i + 1) - 14;
          const drawStart = starts[i] + 8;
          const drawLen = Math.max(8, starts[i + 1] - drawStart + 4);
          const line = draw(frame, drawStart, drawLen);
          const head = back(frame, drawStart + drawLen - 4, 10);
          const flowStart = drawStart + drawLen + 6;
          const flowing = progress(frame, flowStart, 8, ease.linear);
          return (
            <g key={i}>
              <line
                x1={x1}
                y1={centerY}
                x2={x2}
                y2={centerY}
                stroke={colors.sub}
                strokeWidth={4}
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={line.strokeDasharray}
                strokeDashoffset={line.strokeDashoffset}
              />
              <path
                d="M -12 -10 L 2 0 L -12 10"
                fill="none"
                stroke={colors.sub}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                transform={`translate(${x2} ${centerY}) scale(${head})`}
              />
              {/* 2 つの粒を半周ずらし、行きと帰りがすれ違うようにする */}
              {[0, 1].map((phase, k) => {
                const t = pingPong(frame - flowStart + phase * 36 + i * 9, 36);
                const x = x1 + 6 + (x2 - x1 - 18) * ease.inOut(t);
                return (
                  <g key={k} opacity={flowing}>
                    <circle cx={x} cy={centerY} r={11} fill={alpha(colors.yellow, 0.25)} />
                    <circle cx={x} cy={centerY} r={5.5} fill={colors.yellow} />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      {props.steps.map((step, i) => {
        const p = back(frame, starts[i], T.enter);
        const fade = progress(frame, starts[i], 8);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: xOf(i),
              top,
              width: boxW,
              height: BOX_HEIGHT,
              borderRadius: 18,
              background: surface.fillStrong,
              border: `3px solid ${accent(i)}`,
              boxShadow: `0 10px 30px ${alpha(colors.bg, 0.6)}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: fade,
              transform: `scale(${0.6 + 0.4 * p})`,
            }}
          >
            <div style={{ color: accent(i), fontSize: 18, fontWeight: font.weight.black, letterSpacing: '0.14em' }}>STEP {i + 1}</div>
            <FitText text={step} maxWidth={textW} max={size} min={size} maxLines={3} style={{ textAlign: 'center' }} />
          </div>
        );
      })}

      <Caption text={props.caption} frame={frame} start={starts[n - 1] + T.enter} />
    </Fill>
  );
};
