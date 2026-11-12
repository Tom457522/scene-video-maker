/**
 * number: 大きな数字を 1 つ見せる。数字がカウントアップし、周りの輪が描かれる。
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
  countUp,
  draw,
  ease,
  field,
  fitFontSize,
  font,
  layout,
  measureEm,
  mix,
  progress,
  settleBy,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '大きな数字',
  description: '印象に残したい数字を 1 つ、大きく見せる。カウントアップと輪の動き付き。',
  defaultSeconds: 5,
  order: 55,
};

export const schema = z.object({
  heading: field.text('見出し', '', { max: 40, marks: true, description: '空欄なら見出しを出さない' }),
  value: field.number('数値', 1000000, { step: 1 }),
  prefix: field.text('前に付ける文字', '約', { max: 8, description: '「約」「$」など(空欄可)' }),
  unit: field.text('単位', '件/日', { max: 10 }),
  label: field.text('説明', '世界中で記録される[[取引]]の数(例)', { max: 50, marks: true }),
  note: field.text('注記', '', { max: 60, description: '出典など、小さく出す文(空欄可)' }),
});

const decimalsOf = (v: number): number => Math.min(2, (String(v).split('.')[1] ?? '').length);

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const hasHeading = props.heading.trim() !== '';
  const cy = hasHeading ? 420 : 360;
  const until = settleBy(durationInFrames, 0.5);
  const count = progress(frame, 10, Math.max(16, until - 10), ease.out);
  const ring = draw(frame, 6, Math.max(16, until - 6));
  const pop = back(frame, 4, T.enter);
  const done = bump(frame, until, 12);
  const label = progress(frame, until - 6, T.enter);
  const text = `${props.prefix}${countUp(1, props.value, decimalsOf(props.value))}${props.unit}`;
  const numSize = fitFontSize(text, { maxWidth: 900, max: 150, min: 60, maxLines: 1 });
  // 数字の幅に合わせて伸びる、角の丸い枠
  const frameW = Math.min(1120, measureEm(text) * numSize * 0.62 + 140);
  const frameH = numSize * 1.5;
  const fy = cy - 30 - frameH / 2;

  return (
    <Fill>
      {hasHeading && <Heading text={props.heading} frame={frame} />}
      <svg width={1280} height={720} style={{ position: 'absolute', inset: 0 }}>
        <rect x={640 - frameW / 2} y={fy} width={frameW} height={frameH} rx={frameH / 2} fill={alpha(colors.yellow, 0.05)} stroke={alpha(colors.sub, 0.2)} strokeWidth={8} />
        <rect
          x={640 - frameW / 2}
          y={fy}
          width={frameW}
          height={frameH}
          rx={frameH / 2}
          fill="none"
          stroke={colors.yellow}
          strokeWidth={8}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={ring.strokeDasharray}
          strokeDashoffset={ring.strokeDashoffset}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: cy - 30,
          transform: `translateY(-50%) scale(${pop * (1 + done * 0.06)})`,
          textAlign: 'center',
          fontWeight: font.weight.black,
          whiteSpace: 'nowrap',
          lineHeight: 1,
        }}
      >
        <span style={{ fontSize: numSize * 0.4, color: colors.sub, marginRight: 8 }}>{props.prefix}</span>
        <span style={{ fontSize: numSize, color: colors.text, fontVariantNumeric: 'tabular-nums' }}>{countUp(count, props.value, decimalsOf(props.value))}</span>
        <span style={{ fontSize: numSize * 0.4, color: colors.yellow, marginLeft: 10 }}>{props.unit}</span>
      </div>
      <div
        style={{
          position: 'absolute',
          left: layout.padX,
          right: layout.padX,
          top: fy + frameH + 36,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          opacity: label,
          transform: `translateY(${mix(label, 16, 0)}px)`,
        }}
      >
        <FitText text={props.label} maxWidth={1000} max={36} min={22} maxLines={2} frame={frame} markStart={until + 8} style={{ textAlign: 'center' }} />
        {props.note.trim() !== '' && (
          <div style={{ fontSize: 20, color: colors.sub, fontWeight: font.weight.regular, textAlign: 'center' }}>{props.note}</div>
        )}
      </div>
    </Fill>
  );
};
