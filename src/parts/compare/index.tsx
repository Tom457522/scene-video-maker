/**
 * compare: 2 つを比べる。左右のパネルが両側から入り、項目が交互に現れ、真ん中に「VS」。
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
  field,
  fitFontSize,
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
  name: '比較',
  description: '2 つのものを左右に並べて比べる。項目が交互に現れる。',
  defaultSeconds: 7,
  order: 45,
};

export const schema = z.object({
  heading: field.text('見出し', 'ふつうの台帳との違い', { max: 40, marks: true }),
  leftTitle: field.text('左の名前', 'ふつうの台帳', { max: 16 }),
  leftItems: field.list('左の項目', ['管理者が 1 人', '書き換えやすい', '止まると使えない'], { min: 1, max: 5, itemMax: 30, marks: true }),
  rightTitle: field.text('右の名前', 'ブロックチェーン', { max: 16 }),
  rightItems: field.list('右の項目', ['みんなで管理', '[[改ざんしにくい]]', '一部が止まっても動く'], { min: 1, max: 5, itemMax: 30, marks: true }),
  vs: field.toggle('真ん中に VS を出す', true),
});

const GAP = 64;

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const top = layout.contentTop;
  const height = layout.contentBottomFull - top;
  const panelW = (layout.contentWidth - GAP) / 2;
  const rows = Math.max(props.leftItems.length, props.rightItems.length);
  const rowH = Math.min(84, (height - 110) / rows);
  const textW = panelW - 64;
  const size = fitFontSizeToBox([...props.leftItems, ...props.rightItems], { maxWidth: textW, maxHeight: rowH - 6, max: Math.min(30, Math.floor(rowH * 0.42)), min: 13 });
  const until = settleBy(durationInFrames, 0.5);
  const sides = [
    { title: props.leftTitle, items: props.leftItems, color: colors.coral, x: layout.padX, from: -60 },
    { title: props.rightTitle, items: props.rightItems, color: colors.teal, x: layout.padX + panelW + GAP, from: 60 },
  ];
  const vs = back(frame, 16, 16);
  const vsBump = bump(frame, until + 6, 12);

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      {sides.map((side, si) => {
        const p = progress(frame, 6 + si * 4, T.enter);
        return (
          <div
            key={si}
            style={{
              position: 'absolute',
              left: side.x,
              top,
              width: panelW,
              height,
              borderRadius: 20,
              background: surface.fill,
              border: `2px solid ${alpha(side.color, 0.6)}`,
              opacity: p,
              transform: `translateX(${mix(p, side.from, 0)}px)`,
              padding: '22px 32px',
              boxSizing: 'border-box',
            }}
          >
            <div
              style={{
                fontSize: fitFontSize(side.title, { maxWidth: panelW - 64, max: 34, min: 14, maxLines: 1 }),
                fontWeight: font.weight.black,
                color: side.color,
                paddingBottom: 12,
                marginBottom: 12,
                borderBottom: `2px solid ${alpha(side.color, 0.35)}`,
                whiteSpace: 'nowrap',
              }}
            >
              {side.title}
            </div>
            {side.items.map((item, i) => {
              // 左右の項目を交互に出す(左1 → 右1 → 左2 → …)
              const s = stagger(i * 2 + si, rows * 2, 20, until, 8);
              const q = progress(frame, s, T.enter);
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, height: rowH, opacity: q, transform: `translateY(${mix(q, 12, 0)}px)` }}>
                  <div style={{ flex: 'none', width: 12, height: 12, borderRadius: 3, background: side.color, transform: 'rotate(45deg)' }} />
                  <FitText text={item} maxWidth={textW} max={size} min={size} maxLines={6} frame={frame} markStart={s + T.enter} />
                </div>
              );
            })}
          </div>
        );
      })}
      {props.vs && (
        <div
          style={{
            position: 'absolute',
            left: 640,
            top: top + height / 2,
            width: 76,
            height: 76,
            borderRadius: '50%',
            background: colors.yellow,
            color: colors.onAccent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
            fontWeight: font.weight.black,
            transform: `translate(-50%, -50%) scale(${vs * (1 + vsBump * 0.15)}) rotate(${mix(Math.min(vs, 1), -90, 0)}deg)`,
          }}
        >
          VS
        </div>
      )}
    </Fill>
  );
};
