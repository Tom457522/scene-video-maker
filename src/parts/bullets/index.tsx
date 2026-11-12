/**
 * bullets: 見出しと箇条書き。番号バッジが回転して登場し、文が右から入り、[[ ]] の語にマーカーが引かれる。
 * 新しい部品を作るときの見本(PARTS_GUIDE.md で解説している)。
 */
import {
  type PartComponent,
  type PartMeta,
  Fill,
  FitText,
  Heading,
  T,
  accent,
  back,
  colors,
  field,
  fitFontSizeAll,
  font,
  layout,
  mix,
  progress,
  settleBy,
  stagger,
  z,
} from '../../kit';

// 1. meta: 一覧に出す名前・説明・既定の秒数
export const meta: PartMeta = {
  name: '箇条書き',
  description: '見出しと 1〜6 個の要点。[[ ]] で囲んだ語にマーカーが引かれる。',
  defaultSeconds: 6,
};

// 2. schema: 入力項目。kit の field を使うと、フォームの項目名や入力欄の種類が自動で決まる
export const schema = z.object({
  heading: field.text('見出し', 'ブロックチェーンとは', { max: 40, marks: true }),
  items: field.list('項目', ['取引の記録を[[ブロック]]にまとめる', 'ブロックを[[鎖]]のようにつなぐ', 'みんなで同じ記録を[[共有]]する'], {
    min: 1,
    max: 6,
    itemMax: 60,
    marks: true,
  }),
});

const BADGE = 60;
const BADGE_GAP = 28;

// 3. Component: props と frame だけから見た目を決める
export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const n = props.items.length;
  const top = layout.contentTop;
  const bottom = layout.contentBottom + 40;
  const rowHeight = Math.min(112, (bottom - top) / n);
  const textWidth = layout.contentWidth - BADGE - BADGE_GAP;

  // 全項目を同じ文字サイズにそろえる。行の高さに合わせて上限を下げ、長い文は 2 行まで折り返す
  const size = fitFontSizeAll(props.items, {
    maxWidth: textWidth,
    max: Math.min(font.size.body, Math.floor(rowHeight * 0.4)),
    min: 22,
    maxLines: 2,
  });

  // 登場のタイミング: 見出しのあとに始め、シーンの 50% までに全項目を出す
  const from = 14;
  const until = settleBy(durationInFrames, 0.5);

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      <div style={{ position: 'absolute', left: layout.padX, top, width: layout.contentWidth }}>
        {props.items.map((item, i) => {
          const s = stagger(i, n, from, until, 14);
          const badge = back(frame, s, T.enter);
          const textIn = progress(frame, s + 4, T.enter);
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', height: rowHeight, gap: BADGE_GAP }}>
              <div
                style={{
                  flex: 'none',
                  width: BADGE,
                  height: BADGE,
                  borderRadius: '50%',
                  background: accent(i),
                  color: colors.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 30,
                  fontWeight: font.weight.black,
                  opacity: Math.min(1, badge * 2),
                  transform: `rotate(${mix(badge, -200, 0)}deg) scale(${badge})`,
                }}
              >
                {i + 1}
              </div>
              <div style={{ opacity: textIn, transform: `translateX(${mix(textIn, 80, 0)}px)` }}>
                <FitText text={item} maxWidth={textWidth} max={size} min={size} frame={frame} markStart={s + T.enter} />
              </div>
            </div>
          );
        })}
      </div>
    </Fill>
  );
};
