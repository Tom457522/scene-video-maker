/**
 * image: 図・スクリーンショット・写真を見せる。ゆっくり寄り、注目したい場所を丸で囲める。
 */
import {
  type PartComponent,
  type PartMeta,
  Caption,
  Fill,
  Heading,
  Picture,
  T,
  alpha,
  bump,
  colors,
  draw,
  ease,
  field,
  layout,
  mix,
  progress,
  settleBy,
  surface,
  z,
} from '../../kit';

export const meta: PartMeta = {
  name: '画像',
  description: '図・スクリーンショット・写真を見せる。ゆっくり寄り、注目したい場所を丸で囲める。',
  defaultSeconds: 6,
  order: 50,
};

export const schema = z.object({
  heading: field.text('見出し', '', { max: 40, marks: true, description: '空欄なら見出しを出さず、画像を大きく見せる' }),
  file: field.image('画像', { description: 'PNG / JPEG / GIF / WebP。「画像を追加」で projects/assets/ に入る' }),
  zoom: field.choice('動き', { slow: 'ゆっくり寄る', none: '動かさない' }, 'slow'),
  markX: field.number('丸の位置(横 %)', 0, { min: 0, max: 100, step: 1, description: '画像の枠の左端が 0、右端が 100。0 のままなら丸を出さない' }),
  markY: field.number('丸の位置(縦 %)', 50, { min: 0, max: 100, step: 1, description: '上端が 0、下端が 100' }),
  markSize: field.number('丸の大きさ(%)', 12, { min: 3, max: 50, step: 1, description: '画像の枠の幅に対する直径' }),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const hasHeading = props.heading.trim() !== '';
  const hasCaption = props.caption.trim() !== '';
  const top = hasHeading ? layout.contentTop - 8 : 48;
  const bottom = hasCaption ? layout.contentBottom - 6 : 672;
  const height = bottom - top;
  const width = Math.min(layout.contentWidth, (height * 16) / 9 + 80);
  const left = (1280 - width) / 2;

  const appear = progress(frame, 4, T.enter + 4);
  const zoom = props.zoom === 'slow' ? mix(progress(frame, 0, durationInFrames, ease.inOut), 1, 1.06) : 1;
  const markStart = settleBy(durationInFrames, 0.4);
  const ring = draw(frame, markStart, 18);
  const pulse = bump(frame, markStart + 18, 12);
  const showMark = props.markX > 0 && props.file !== '';
  const d = (props.markSize / 100) * width;

  return (
    <Fill>
      {hasHeading && <Heading text={props.heading} frame={frame} />}
      <div
        style={{
          position: 'absolute',
          left,
          top,
          width,
          height,
          borderRadius: 18,
          overflow: 'hidden',
          background: surface.fill,
          border: `2px solid ${surface.border}`,
          boxShadow: `0 18px 50px ${alpha(colors.bg, 0.55)}`,
          opacity: appear,
          transform: `translateY(${mix(appear, 30, 0)}px) scale(${mix(appear, 0.96, 1)})`,
        }}
      >
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: `${props.markX > 0 ? props.markX : 50}% ${props.markY}%` }}>
          <Picture file={props.file} />
        </div>
      </div>
      {showMark && (
        <svg width={1280} height={720} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <circle
            cx={left + (props.markX / 100) * width}
            cy={top + (props.markY / 100) * height}
            r={(d / 2) * (1 + pulse * 0.08)}
            fill={alpha(colors.yellow, 0.12 * ring.progress)}
            stroke={colors.yellow}
            strokeWidth={6}
            pathLength={1}
            strokeDasharray={ring.strokeDasharray}
            strokeDashoffset={ring.strokeDashoffset}
            transform={`rotate(-90 ${left + (props.markX / 100) * width} ${top + (props.markY / 100) * height})`}
          />
        </svg>
      )}
      <Caption text={props.caption} frame={frame} start={markStart} />
    </Fill>
  );
};
