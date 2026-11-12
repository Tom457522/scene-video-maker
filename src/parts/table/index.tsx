/**
 * table: 表。列の名前が出たあと、行が上から順に現れる。強調したい行に色の帯を引ける。
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
  colors,
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
  name: '表',
  description: '2〜4 列・1〜6 行の表。行が上から順に現れ、強調したい行に色の帯を引ける。',
  defaultSeconds: 7,
  order: 46,
};

export const schema = z.object({
  heading: field.text('見出し', '主な仮想通貨の比較(例)', { max: 40, marks: true }),
  columns: field.list('列の名前', ['名前', '始まった年', '特徴'], { min: 2, max: 4, itemMax: 12, itemTitle: '列' }),
  rows: field.list(
    '行(セルを | で区切る)',
    ['ビットコイン | 2009年 | 最初の仮想通貨', 'イーサリアム | 2015年 | プログラムを動かせる', 'リップル | 2012年 | 送金が速い'],
    { min: 1, max: 6, itemMax: 80, itemTitle: '行', marks: true, description: '例: 「ビットコイン | 2009年 | 最初の仮想通貨」。[[ ]] で強調もできる' },
  ),
  highlight: field.number('強調する行', 0, { min: 0, max: 6, step: 1, description: '何行目に色の帯を引くか(0 なら引かない)' }),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

const PAD = 18;

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const cols = props.columns.length;
  const cells = props.rows.map((r) => {
    const parts = r.split(/\s*[|｜]\s*/);
    return Array.from({ length: cols }, (_, i) => (i === cols - 1 ? parts.slice(i).join(' ') : parts[i] ?? '').trim());
  });
  const n = cells.length;
  const top = layout.contentTop;
  const bottom = props.caption.trim() === '' ? layout.contentBottomFull : layout.contentBottom;
  const headH = 56;
  const rowH = Math.min(92, (bottom - top - headH) / n);
  const colW = layout.contentWidth / cols;
  const textW = colW - PAD * 2;
  const headSize = fitFontSizeToBox(props.columns, { maxWidth: textW, maxHeight: headH - 10, max: 24, min: 13 });
  const size = fitFontSizeToBox(cells.flat(), { maxWidth: textW, maxHeight: rowH - 10, max: 28, min: 10 });
  const until = settleBy(durationInFrames, 0.5);
  const markAt = until + 8;
  const head = progress(frame, 6, T.enter);

  return (
    <Fill>
      <Heading text={props.heading} frame={frame} />
      <div style={{ position: 'absolute', left: layout.padX, top, width: layout.contentWidth }}>
        <div style={{ display: 'flex', height: headH, opacity: head, transform: `translateY(${mix(head, -12, 0)}px)`, borderBottom: `3px solid ${colors.yellow}` }}>
          {props.columns.map((c, i) => (
            <div key={i} style={{ width: colW, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', fontSize: headSize, fontWeight: font.weight.black, color: i === 0 ? colors.yellow : colors.sub }}>
              {c}
            </div>
          ))}
        </div>
        {cells.map((row, r) => {
          const s = stagger(r, n, 14, until, 10);
          const p = progress(frame, s, T.enter);
          const marked = props.highlight === r + 1;
          const m = marked ? progress(frame, markAt, 12) : 0;
          return (
            <div
              key={r}
              style={{
                position: 'relative',
                display: 'flex',
                height: rowH,
                borderBottom: `1px solid ${surface.border}`,
                background: r % 2 === 1 ? surface.fill : undefined,
                opacity: p,
                transform: `translateX(${mix(p, 40, 0)}px)`,
              }}
            >
              {marked && <div style={{ position: 'absolute', inset: 0, background: alpha(accent(0), 0.16 * m), borderLeft: `6px solid ${alpha(accent(0), m)}` }} />}
              {row.map((cell, c) => (
                <div key={c} style={{ position: 'relative', width: colW, padding: `0 ${PAD}px`, display: 'flex', alignItems: 'center', boxSizing: 'border-box' }}>
                  <FitText
                    text={cell}
                    maxWidth={textW}
                    max={size}
                    min={size}
                    maxLines={4}
                    frame={frame}
                    markStart={s + T.enter}
                    style={{ fontWeight: c === 0 ? font.weight.black : font.weight.bold, lineHeight: 1.3 }}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <Caption text={props.caption} frame={frame} start={markAt} />
    </Fill>
  );
};
