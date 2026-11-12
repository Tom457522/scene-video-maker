/**
 * code: コードを 1 行ずつ見せ、注目する行を強調する。技術の解説に使う。
 */
import {
  type Language,
  type PartComponent,
  type PartMeta,
  Caption,
  Fill,
  Heading,
  LANGUAGES,
  accent,
  alpha,
  colors,
  field,
  font,
  highlightCode,
  layout,
  mix,
  monoWidthEm,
  parseLineSpec,
  progress,
  settleBy,
  stagger,
  surface,
  tokenColor,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: 'コード',
  description: 'コードを色分けして 1 行ずつ見せ、注目する行を強調する。',
  defaultSeconds: 7,
  order: 60,
};

export const schema = z.object({
  heading: field.text('見出し', 'データを取ってくる関数', { max: 40, marks: true, description: '空欄なら見出しを出さず、コードを大きく見せる' }),
  language: field.choice('言語', LANGUAGES, 'ts'),
  code: field.longText(
    'コード',
    "async function getUser(id: string) {\n  // サーバーに問い合わせる\n  const res = await fetch(`/api/users/${id}`);\n  if (!res.ok) throw new Error('見つかりません');\n  return res.json();\n}",
    { max: 1500, description: '30 行・80 文字くらいまでが読みやすい目安' },
  ),
  highlight: field.text('強調する行', '3', { max: 40, description: '行番号を「3」「2,5-6」のように書く。空欄なら強調しない' }),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

const PAD = 28;
const BAR = 44;

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const lines = highlightCode(props.code.replace(/\s+$/, ''), props.language as Language);
  const raw = props.code.replace(/\s+$/, '').replace(/\t/g, '  ').split(/\r?\n/);
  const n = lines.length;
  const hasHeading = props.heading.trim() !== '';
  const hasCaption = props.caption.trim() !== '';
  const top = hasHeading ? layout.contentTop - 10 : 48;
  const bottom = hasCaption ? layout.contentBottom - 6 : 672;
  const boxW = layout.contentWidth;
  const boxH = bottom - top;
  const gutterEm = String(n).length * 0.6 + 1.2;
  const maxEm = Math.max(10, ...raw.map(monoWidthEm)) + gutterEm;
  const size = Math.max(11, Math.min(26, Math.floor((boxW - PAD * 2) / maxEm), Math.floor((boxH - BAR - PAD * 2) / (n * 1.5))));
  const lineH = size * 1.5;
  const marked = parseLineSpec(props.highlight);

  const appear = progress(frame, 2, 14);
  const until = settleBy(durationInFrames, 0.45);
  const markAt = until + 10;

  return (
    <Fill>
      {hasHeading && <Heading text={props.heading} frame={frame} />}
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          top,
          width: boxW,
          height: boxH,
          borderRadius: 16,
          background: alpha(colors.bg, 0.85),
          border: `2px solid ${surface.border}`,
          boxShadow: `0 18px 50px ${alpha(colors.bg, 0.5)}`,
          overflow: 'hidden',
          opacity: appear,
          transform: `translateY(${mix(appear, 24, 0)}px)`,
        }}
      >
        <div style={{ height: BAR, display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', background: surface.fill, borderBottom: `1px solid ${surface.border}` }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: accent(2 - i) }} />
          ))}
          <div style={{ marginLeft: 10, fontSize: 16, color: colors.sub, fontWeight: font.weight.regular }}>{LANGUAGES[props.language as Language]}</div>
        </div>
        <div style={{ padding: PAD, fontFamily: font.mono, fontSize: size, lineHeight: `${lineH}px`, fontWeight: 400 }}>
          {lines.map((tokens, i) => {
            const p = progress(frame, stagger(i, n, 8, until, 5), 10);
            const isMarked = marked.has(i + 1);
            const m = isMarked ? progress(frame, markAt, 12) : 0;
            const dim = marked.size > 0 && !isMarked ? mix(progress(frame, markAt, 12), 1, 0.45) : 1;
            return (
              <div key={i} style={{ position: 'relative', whiteSpace: 'pre', height: lineH, opacity: p * dim, transform: `translateX(${mix(p, 14, 0)}px)` }}>
                {isMarked && (
                  <div
                    style={{
                      position: 'absolute',
                      left: -PAD,
                      right: -PAD,
                      top: 0,
                      bottom: 0,
                      background: alpha(colors.yellow, 0.14 * m),
                      borderLeft: `5px solid ${alpha(colors.yellow, m)}`,
                    }}
                  />
                )}
                <span style={{ position: 'relative', color: alpha(colors.sub, 0.6), display: 'inline-block', width: `${gutterEm}em` }}>{i + 1}</span>
                {tokens.map((t, k) => (
                  <span key={k} style={{ position: 'relative', color: tokenColor(t.kind), fontStyle: t.kind === 'comment' ? 'italic' : undefined }}>
                    {t.text}
                  </span>
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <Caption text={props.caption} frame={frame} start={markAt} />
    </Fill>
  );
};
