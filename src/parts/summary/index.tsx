/**
 * summary: まとめ。チェックマークが 1 つずつ描かれ、要点が並ぶ。
 */
import {
  type PartComponent,
  type PartMeta,
  Fill,
  FitText,
  Heading,
  T,
  alpha,
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
  surface,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: 'まとめ',
  description: '動画の最後に置くまとめ。チェックマークが 1 つずつ描かれる。',
  defaultSeconds: 6,
  order: 90,
};

export const schema = z.object({
  heading: field.text('見出し', 'まとめ', { max: 40, marks: true }),
  items: field.list('要点', ['記録を[[ブロック]]にまとめて鎖のようにつなぐ', 'みんなで同じ記録を持つので[[改ざんしにくい]]', 'お金以外の記録にも使われ始めている'], {
    min: 1,
    max: 5,
    itemMax: 60,
    itemTitle: '要点',
    marks: true,
  }),
});

const ICON = 52;
const PAD = 40;

const Check = ({ frame, start }: { frame: number; start: number }) => {
  const ring = draw(frame, start, 14);
  const tick = draw(frame, start + 10, 12);
  const fill = progress(frame, start + 16, 8);
  const pop = bump(frame, start + 20, 10);
  return (
    <svg width={ICON} height={ICON} viewBox="-30 -30 60 60" style={{ flex: 'none', transform: `scale(${1 + pop * 0.15})`, overflow: 'visible' }}>
      <circle r={26} fill={alpha(colors.teal, 0.18 * fill)} />
      <circle
        r={26}
        fill="none"
        stroke={colors.teal}
        strokeWidth={4}
        pathLength={1}
        strokeDasharray={ring.strokeDasharray}
        strokeDashoffset={ring.strokeDashoffset}
        transform="rotate(-90)"
      />
      <path
        d="M -12 1 L -3 10 L 14 -9"
        fill="none"
        stroke={colors.yellow}
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={tick.strokeDasharray}
        strokeDashoffset={tick.strokeDashoffset}
      />
    </svg>
  );
};

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const n = props.items.length;
  const panelTop = layout.contentTop - 6;
  const panelBottom = layout.contentBottomFull + 4;
  const rowH = Math.min(100, (panelBottom - panelTop - PAD * 2) / n);
  const textW = layout.contentWidth - PAD * 2 - ICON - 24;
  const size = fitFontSizeToBox(props.items, { maxWidth: textW, maxHeight: rowH - 8, max: Math.min(font.size.body, Math.floor(rowH * 0.42)), min: 14 });
  const panel = back(frame, 4, 20);
  const panelH = rowH * n + PAD * 2;

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          top: panelTop,
          width: layout.contentWidth,
          height: panelH,
          borderRadius: 24,
          background: surface.fill,
          border: `2px solid ${surface.border}`,
          opacity: progress(frame, 4, 10),
          transform: `scaleY(${mix(Math.min(panel, 1.05), 0.85, 1)})`,
          transformOrigin: 'top center',
        }}
      />
      <div style={{ position: 'absolute', left: layout.padX + PAD, top: panelTop + PAD, width: layout.contentWidth - PAD * 2 }}>
        {props.items.map((item, i) => {
          const s = stagger(i, n, 16, settleBy(durationInFrames, 0.4), 20);
          const textIn = progress(frame, s + 8, T.enter);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 24, height: rowH }}>
              <Check frame={frame} start={s} />
              <div style={{ opacity: textIn, transform: `translateY(${mix(textIn, 14, 0)}px)` }}>
                <FitText text={item} maxWidth={textW} max={size} min={size} frame={frame} markStart={s + 20} />
              </div>
            </div>
          );
        })}
      </div>
    </Fill>
  );
};
