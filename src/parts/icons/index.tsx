/**
 * icons: アイコンつきのカードを並べる。特徴・メリット・登場人物などを一覧で見せる。
 */
import {
  type PartComponent,
  type PartMeta,
  Caption,
  Fill,
  FitText,
  Heading,
  Icon,
  T,
  accent,
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
  name: 'アイコン一覧',
  description: 'アイコンつきのカードを 2〜6 枚並べる。特徴・メリット・登場人物などの紹介に。',
  defaultSeconds: 6,
  order: 25,
};

export const schema = z.object({
  heading: field.text('見出し', 'ブロックチェーンの 3 つの特徴', { max: 40, marks: true }),
  cards: field.rows(
    'カード',
    {
      icon: field.icon('アイコン', 'lightbulb'),
      title: field.text('名前', '特徴', { max: 16 }),
      text: field.text('説明', '説明が入ります', { max: 40, marks: true }),
    },
    [
      { icon: 'shield', title: '改ざんしにくい', text: '記録を[[鎖]]のようにつなぐ' },
      { icon: 'users', title: 'みんなで管理', text: '同じ記録を全員が持つ' },
      { icon: 'zap', title: '止まりにくい', text: '一部が止まっても動き続ける' },
    ],
    { min: 2, max: 6, itemTitle: 'カード' },
  ),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

const GAP = 24;

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const n = props.cards.length;
  const cols = n <= 4 ? n : 3;
  const rows = Math.ceil(n / cols);
  const top = layout.contentTop;
  const bottom = props.caption.trim() === '' ? layout.contentBottomFull : layout.contentBottom;
  const cardW = (layout.contentWidth - GAP * (cols - 1)) / cols;
  const cardH = Math.min(320, (bottom - top - GAP * (rows - 1)) / rows);
  const iconBox = Math.min(84, cardH * 0.34);
  const textW = cardW - 40;
  const titleSize = Math.min(...props.cards.map((c) => fitFontSize(c.title, { maxWidth: textW, max: 30, min: 16, maxLines: 1 })));
  const textSize = fitFontSizeToBox(
    props.cards.map((c) => c.text),
    { maxWidth: textW, maxHeight: cardH - iconBox - titleSize * 1.4 - 64, max: 24, min: 13 },
  );
  const until = settleBy(durationInFrames, 0.5);
  const offsetY = top + Math.max(0, (bottom - top - (rows * cardH + (rows - 1) * GAP)) / 2);

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      {props.cards.map((c, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        // 最後の行が少ないときは中央に寄せる
        const inRow = row === rows - 1 ? n - row * cols : cols;
        const rowOffset = ((cols - inRow) * (cardW + GAP)) / 2;
        const s = stagger(i, n, 12, until, 10);
        const p = progress(frame, s, T.enter);
        const ic = back(frame, s + 4, T.enter);
        const pulse = bump(frame, s + 18, 10);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: layout.padX + rowOffset + col * (cardW + GAP),
              top: offsetY + row * (cardH + GAP),
              width: cardW,
              height: cardH,
              boxSizing: 'border-box',
              padding: '22px 20px',
              borderRadius: 20,
              background: surface.fill,
              border: `2px solid ${alpha(accent(i), 0.45)}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              gap: 10,
              opacity: p,
              transform: `translateY(${mix(p, 30, 0)}px)`,
            }}
          >
            <div
              style={{
                width: iconBox,
                height: iconBox,
                borderRadius: '50%',
                background: alpha(accent(i), 0.16),
                display: 'grid',
                placeItems: 'center',
                color: accent(i),
                transform: `scale(${ic * (1 + pulse * 0.1)})`,
              }}
            >
              <Icon name={c.icon} size={iconBox * 0.52} />
            </div>
            <div style={{ fontSize: titleSize, fontWeight: font.weight.black, color: colors.text, whiteSpace: 'nowrap' }}>{c.title}</div>
            <FitText text={c.text} maxWidth={textW} max={textSize} min={textSize} maxLines={6} frame={frame} markStart={s + T.enter} style={{ color: colors.sub, fontWeight: font.weight.regular }} />
          </div>
        );
      })}
      <Caption text={props.caption} frame={frame} start={until + 4} />
    </Fill>
  );
};
