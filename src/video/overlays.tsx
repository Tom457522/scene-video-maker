/**
 * 動画全体にかぶせる表示(シーンをまたいで動く)。部品ではなく動画の側で付ける。
 *   - 章の表示: 右上に今の章、下の端に進み具合
 *   - チャンネル名・ロゴ: 右上
 *   - エンドカード: 最後に付く締めの画面
 */
import { Img, staticFile } from 'remotion';
import { Background, Fill, MarkedText, wrapStyle } from '../kit/components';
import { ease, mix, progress, T, back, drift } from '../kit/motion';
import { fitFontSize } from '../kit/text';
import { accent, alpha, colors, font } from '../kit/theme';
import type { Chapter } from './chapters';
import { END_CARD_FRAMES } from './project';

const Logo = ({ file, size }: { file: string; size: number }) =>
  file ? <Img src={staticFile(file)} style={{ height: size, maxWidth: size * 3, objectFit: 'contain', display: 'block' }} /> : null;

/** 右上の帯: 章の名前(章の表示がオンのとき)とチャンネル名・ロゴ */
export const TopRight = ({
  frame,
  chapters,
  showChapters,
  channelName,
  logo,
}: {
  frame: number;
  chapters: Chapter[];
  showChapters: boolean;
  channelName: string;
  logo: string;
}) => {
  const idx = chapters.findIndex((c) => frame >= c.from && frame < c.from + c.durationInFrames);
  const chapter = idx >= 0 ? chapters[idx] : null;
  const hasBrand = channelName.trim() !== '' || logo !== '';
  if (!hasBrand && !(showChapters && chapter)) return null;
  // 章が変わるたびに少しだけフェードし直す
  const fade = chapter ? progress(frame, chapter.from, 10) : 1;
  return (
    <div style={{ position: 'absolute', top: 18, right: 24, display: 'flex', alignItems: 'center', gap: 14, zIndex: 10 }}>
      {showChapters && chapter && chapters.length > 1 && (
        <div
          style={{
            opacity: fade,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '5px 14px',
            borderRadius: 999,
            background: alpha(colors.bg, 0.7),
            border: `1px solid ${alpha(colors.sub, 0.3)}`,
            fontSize: 17,
            color: colors.sub,
            fontWeight: font.weight.regular,
            maxWidth: 420,
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: colors.yellow, fontWeight: font.weight.bold, fontVariantNumeric: 'tabular-nums' }}>
            {idx + 1}/{chapters.length}
          </span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{chapter.label}</span>
        </div>
      )}
      {hasBrand && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9 }}>
          <Logo file={logo} size={30} />
          {channelName && <span style={{ fontSize: 17, color: colors.text, fontWeight: font.weight.bold }}>{channelName}</span>}
        </div>
      )}
    </div>
  );
};

/** 下の端の進み具合(章ごとに区切った細い帯) */
export const ChapterBar = ({ frame, chapters, total }: { frame: number; chapters: Chapter[]; total: number }) => (
  <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, display: 'flex', gap: 3, zIndex: 10 }}>
    {chapters.map((c, i) => {
      const filled = Math.max(0, Math.min(1, (frame - c.from) / c.durationInFrames));
      return (
        <div key={i} style={{ flex: c.durationInFrames / total, background: alpha(colors.sub, 0.25), position: 'relative' }}>
          <div style={{ position: 'absolute', inset: 0, background: colors.yellow, transform: `scaleX(${filled})`, transformOrigin: 'left' }} />
        </div>
      );
    })}
  </div>
);

/** 最後の締めの画面。frame はエンドカードの先頭を 0 とした番号 */
export const EndCard = ({ frame, message, channelName, logo }: { frame: number; message: string; channelName: string; logo: string }) => {
  const chars = Array.from(message);
  const size = fitFontSize(message, { maxWidth: 1040, max: 64, min: 36, maxLines: 2 });
  const sub = progress(frame, 8 + chars.length * 1.5, T.enter);
  const out = progress(frame, END_CARD_FRAMES - 14, 14, ease.in);
  return (
    <Fill style={{ opacity: 1 - out }}>
      <Background frame={frame + 1000} />
      {[0, 1, 2].map((i) => {
        const p = back(frame, i * 5, 22);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 640,
              top: 360,
              width: 420 + i * 160,
              height: 420 + i * 160,
              borderRadius: '50%',
              border: `3px solid ${alpha(accent(i), 0.35 - i * 0.08)}`,
              transform: `translate(-50%, -50%) scale(${p}) rotate(${drift(frame, 200, i * 0.3) * 6}deg)`,
            }}
          />
        );
      })}
      <Fill style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
        <div style={{ fontSize: size, fontWeight: font.weight.black, textAlign: 'center', maxWidth: 1040, lineHeight: 1.3, ...wrapStyle }}>
          {chars.map((ch, i) => {
            const p = progress(frame, 6 + i * 1.5, 12);
            return (
              <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: p, transform: `translateY(${mix(p, 24, 0)}px)` }}>
                {ch}
              </span>
            );
          })}
        </div>
        {(channelName || logo) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, opacity: sub, transform: `translateY(${mix(sub, 16, 0)}px)` }}>
            <Logo file={logo} size={56} />
            {channelName && (
              <div style={{ fontSize: 34, color: colors.sub }}>
                <MarkedText text={channelName} />
              </div>
            )}
          </div>
        )}
      </Fill>
    </Fill>
  );
};
