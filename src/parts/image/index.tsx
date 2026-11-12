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

/** 画像の枠の位置と大きさ(見出しと字幕の有無で変わる) */
const frameBox = (hasHeading: boolean, hasCaption: boolean) => {
  const top = hasHeading ? layout.contentTop - 8 : 48;
  const bottom = hasCaption ? layout.contentBottom : 672;
  const height = bottom - top;
  const width = Math.min(layout.contentWidth, (height * 16) / 9 + 80);
  return { left: (1280 - width) / 2, top, width, height };
};

const isText = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

export const meta: PartMeta = {
  name: '画像',
  description: '図・スクリーンショット・写真を見せる。ゆっくり寄り、注目したい場所を丸で囲める。',
  defaultSeconds: 6,
  order: 50,
  // 以前は丸の位置を「枠に対する %」(markX / markY)で持っていた。画面の座標(mark)に直す
  migrate: (p) => {
    if (typeof p.markX !== 'number' || 'mark' in p) return p;
    const { markX, markY, markSize, ...rest } = p as Record<string, unknown> & { markX: number; markY?: number; markSize?: number };
    const box = frameBox(isText(p.heading), isText(p.caption));
    return {
      ...rest,
      showMark: markX > 0,
      mark: { x: Math.round(box.left + (markX / 100) * box.width), y: Math.round(box.top + ((markY ?? 50) / 100) * box.height) },
      markSize: Math.round(((markSize ?? 12) / 100) * box.width),
    };
  },
};

export const schema = z.object({
  heading: field.text('見出し', '', { max: 40, marks: true, description: '空欄なら見出しを出さず、画像を大きく見せる' }),
  file: field.image('画像', { description: 'PNG / JPEG / GIF / WebP。「画像を追加」で projects/assets/ に入る' }),
  zoom: field.choice('動き', { slow: 'ゆっくり寄る', none: '動かさない' }, 'slow'),
  showMark: field.toggle('注目する場所を丸で囲む', false),
  mark: field.point('丸の位置', { x: 640, y: 380 }, { description: '「プレビューをクリックして決める」を押してから、プレビューの上の場所をクリック' }),
  markSize: field.number('丸の大きさ(px)', 130, { min: 30, max: 600, step: 10, description: '丸の直径(画面の幅は 1280px)' }),
  caption: field.text('字幕', '', { max: 60, marks: true, description: '画面下に出す補足。空欄なら出しません' }),
});

export const Component: PartComponent<typeof schema> = ({ props, frame, durationInFrames }) => {
  const hasHeading = props.heading.trim() !== '';
  const hasCaption = props.caption.trim() !== '';
  const { left, top, width, height } = frameBox(hasHeading, hasCaption);

  const appear = progress(frame, 4, T.enter + 4);
  const zoom = props.zoom === 'slow' ? mix(progress(frame, 0, durationInFrames, ease.inOut), 1, 1.06) : 1;
  const markStart = settleBy(durationInFrames, 0.4);
  const ring = draw(frame, markStart, 18);
  const pulse = bump(frame, markStart + 18, 12);
  const showMark = props.showMark && props.file !== '';
  // 寄る動きの中心は丸の位置(枠に対する割合)
  const originX = Math.max(0, Math.min(100, ((props.mark.x - left) / width) * 100));
  const originY = Math.max(0, Math.min(100, ((props.mark.y - top) / height) * 100));

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
        <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoom})`, transformOrigin: showMark ? `${originX}% ${originY}%` : '50% 50%' }}>
          <Picture file={props.file} />
        </div>
      </div>
      {showMark && (
        <svg width={1280} height={720} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <circle
            cx={props.mark.x}
            cy={props.mark.y}
            r={(props.markSize / 2) * (1 + pulse * 0.08)}
            fill={alpha(colors.yellow, 0.12 * ring.progress)}
            stroke={colors.yellow}
            strokeWidth={6}
            pathLength={1}
            strokeDasharray={ring.strokeDasharray}
            strokeDashoffset={ring.strokeDashoffset}
            transform={`rotate(-90 ${props.mark.x} ${props.mark.y})`}
          />
        </svg>
      )}
      <Caption text={props.caption} frame={frame} start={markStart} />
    </Fill>
  );
};
