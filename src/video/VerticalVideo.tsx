/**
 * 縦長(9:16、ショート動画向け)。横長の動画をそのまま中央に置き、上にタイトル、下に今の章と進み具合を出す。
 * 部品は横長のまま使えるので、縦長のために部品を作り直す必要はない。
 */
import { useCurrentFrame } from 'remotion';
import { Background, Stage, wrapStyle } from '../kit/components';
import { fitFontSize } from '../kit/text';
import { alpha, colors, font, VIDEO } from '../kit/theme';
import { ProjectVideo, useChapters, type ProjectVideoProps } from './ProjectVideo';
import { defaultSettings, scenesFrames } from './project';

export const VERTICAL = { width: 1080, height: 1920 } as const;
const SCALE = VERTICAL.width / VIDEO.width;
const FRAME_H = VIDEO.height * SCALE;
const FRAME_TOP = Math.round((VERTICAL.height - FRAME_H) / 2);

export const VerticalVideo = ({ project }: ProjectVideoProps) => {
  const frame = useCurrentFrame();
  const settings = project.settings ?? defaultSettings();
  const chapters = useChapters(project);
  const total = scenesFrames(project);
  const idx = chapters.findIndex((c) => frame >= c.from && frame < c.from + c.durationInFrames);
  const title = project.title.trim();
  return (
    <Stage theme={settings.theme}>
      <Background frame={frame} width={VERTICAL.width} height={VERTICAL.height} />
      {/* 上: チャンネル名とタイトル */}
      <div
        style={{
          position: 'absolute',
          left: 60,
          right: 60,
          top: 0,
          height: FRAME_TOP - 40,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          gap: 18,
        }}
      >
        {settings.channelName && <div style={{ fontSize: 34, color: colors.sub }}>{settings.channelName}</div>}
        {title && (
          <div
            style={{
              fontSize: fitFontSize(title, { maxWidth: 960, max: 76, min: 44, maxLines: 3 }),
              fontWeight: font.weight.black,
              lineHeight: 1.3,
              ...wrapStyle,
            }}
          >
            {title}
          </div>
        )}
        <div style={{ width: 120, height: 8, borderRadius: 4, background: colors.yellow }} />
      </div>
      {/* 中央: 横長の動画 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: FRAME_TOP,
          width: VIDEO.width,
          height: VIDEO.height,
          transform: `scale(${SCALE})`,
          transformOrigin: 'top left',
          overflow: 'hidden',
          boxShadow: `0 30px 80px ${alpha('#000000', 0.45)}`,
        }}
      >
        <ProjectVideo project={project} embedded />
      </div>
      {/* 下: 今の章と進み具合 */}
      {frame < total && (
        <div style={{ position: 'absolute', left: 60, right: 60, top: FRAME_TOP + FRAME_H + 60, display: 'flex', flexDirection: 'column', gap: 22 }}>
          {idx >= 0 && chapters.length > 1 && (
            <div style={{ fontSize: 40, ...wrapStyle }}>
              <span style={{ color: colors.yellow, marginRight: 16, fontVariantNumeric: 'tabular-nums' }}>
                {idx + 1}/{chapters.length}
              </span>
              {chapters[idx].label}
            </div>
          )}
          <div style={{ height: 10, borderRadius: 5, background: alpha(colors.sub, 0.25), overflow: 'hidden' }}>
            <div style={{ height: '100%', background: colors.yellow, transform: `scaleX(${Math.min(1, frame / Math.max(1, total))})`, transformOrigin: 'left' }} />
          </div>
        </div>
      )}
    </Stage>
  );
};
