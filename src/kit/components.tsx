/**
 * 部品が共通で使う見た目の要素。どれも frame を受け取り、frame だけから見た目を決める。
 */
import type { CSSProperties, ReactNode } from 'react';
import { colors, alpha, font, layout, setTheme, VIDEO } from './theme';
import { T, drift, ease, exitProgress, mix, progress } from './motion';
import { estimateLines, fitFontSize, parseMarks } from './text';

/** 日本語を文節で折り返す(Chrome 119 以降)。はみ出しを防ぐため、どこでも折り返せる指定も付ける */
export const wrapStyle: CSSProperties = {
  wordBreak: 'auto-phrase' as CSSProperties['wordBreak'],
  overflowWrap: 'anywhere',
  lineBreak: 'strict',
};

/** 画面いっぱいの重ね合わせ用の箱 */
export const Fill = ({ children, style }: { children?: ReactNode; style?: CSSProperties }) => (
  <div style={{ position: 'absolute', inset: 0, ...style }}>{children}</div>
);

/** 動画全体の土台(テーマ・背景色・フォント)。部品ではなく動画の側で使う */
export const Stage = ({ children, theme = 'navy' }: { children?: ReactNode; theme?: string }) => {
  // 子(部品)より先にテーマを決める
  setTheme(theme);
  return (
    <div
      lang="ja"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: colors.bg,
        color: colors.text,
        fontFamily: font.family,
        fontWeight: font.weight.bold,
        fontFeatureSettings: '"palt"',
      }}
    >
      {children}
    </div>
  );
};

/**
 * 背景: ゆっくり流れるドットと、漂う輪。動画全体のフレームを渡すとシーンをまたいでも途切れない。
 */
export const Background = ({ frame, width = VIDEO.width, height = VIDEO.height }: { frame: number; width?: number; height?: number }) => {
  const gap = 48;
  const ox = (frame * 0.3) % gap;
  const oy = (frame * 0.15) % gap;
  // 輪の位置は画面の大きさに合わせる(横長 1280×720 が基準)
  const sx = width / VIDEO.width;
  const sy = height / VIDEO.height;
  const rings = [
    { cx: 1080 * sx, cy: 140 * sy, r: 210, color: colors.teal, period: 360, phase: 0 },
    { cx: 170 * sx, cy: 620 * sy, r: 150, color: colors.yellow, period: 300, phase: 0.3 },
    { cx: 1180 * sx, cy: 640 * sy, r: 90, color: colors.coral, period: 240, phase: 0.6 },
  ];
  return (
    <Fill>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <pattern id="kit-dots" width={gap} height={gap} patternUnits="userSpaceOnUse" x={ox} y={oy}>
            <circle cx={gap / 2} cy={gap / 2} r={1.8} fill={alpha(colors.sub, 0.16)} />
          </pattern>
          <radialGradient id="kit-glow" cx="50%" cy="40%" r="75%">
            <stop offset="0%" stopColor={alpha(colors.teal, 0.08)} />
            <stop offset="100%" stopColor={alpha(colors.bg, 0)} />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#kit-glow)" />
        <rect width="100%" height="100%" fill="url(#kit-dots)" />
        {rings.map((ring, i) => (
          <g
            key={i}
            transform={`translate(${ring.cx + drift(frame, ring.period, ring.phase) * 24} ${
              ring.cy + drift(frame, ring.period * 1.3, ring.phase + 0.25) * 18
            }) rotate(${frame * 0.12 * (i % 2 === 0 ? 1 : -1)})`}
          >
            <circle r={ring.r} fill="none" stroke={alpha(ring.color, 0.12)} strokeWidth={2} />
            <circle r={ring.r * 0.72} fill="none" stroke={alpha(ring.color, 0.08)} strokeWidth={2} strokeDasharray="6 14" />
          </g>
        ))}
      </svg>
    </Fill>
  );
};

/**
 * [[ ]] で囲んだ語にマーカーを引く文。markStart から語ごとに少しずつずらして引く。
 * frame を渡さないとマーカーは引き終わった状態で描く。
 */
export const MarkedText = ({
  text,
  frame,
  markStart = 0,
  markColor = colors.yellow,
}: {
  text: string;
  frame?: number;
  markStart?: number;
  markColor?: string;
}) => {
  const segments = parseMarks(text);
  return (
    <>
      {segments.map((seg, i) => {
        if (!seg.marked) return <span key={i}>{seg.text}</span>;
        // 何番目の強調語か(語ごとに少しずつ遅らせて引く)
        const k = segments.slice(0, i).filter((s) => s.marked).length;
        const p = frame === undefined ? 1 : progress(frame, markStart + k * 6, 14, ease.out);
        return (
          <span key={i} style={{ position: 'relative', whiteSpace: 'nowrap', zIndex: 0, color: p > 0.3 ? markColor : undefined }}>
            <span
              style={{
                position: 'absolute',
                left: '-0.08em',
                right: '-0.08em',
                bottom: '0.02em',
                height: '0.36em',
                background: alpha(markColor, 0.32),
                borderRadius: '0.08em',
                transform: `scaleX(${p})`,
                transformOrigin: 'left center',
                zIndex: -1,
              }}
            />
            {seg.text}
          </span>
        );
      })}
    </>
  );
};

/**
 * 幅と行数に合わせて文字サイズを自動で決める文。長い文は縮小し、下限でも入らなければ折り返す。
 */
export const FitText = ({
  text,
  maxWidth,
  max,
  min,
  maxLines = 2,
  frame,
  markStart,
  style,
}: {
  text: string;
  maxWidth: number;
  max: number;
  min?: number;
  maxLines?: number;
  /** [[ ]] のマーカーを動かすときに渡す */
  frame?: number;
  markStart?: number;
  style?: CSSProperties;
}) => {
  const size = fitFontSize(text, { maxWidth, max, min, maxLines });
  return (
    <div style={{ fontSize: size, lineHeight: 1.4, maxWidth, ...wrapStyle, ...style }}>
      <MarkedText text={text} frame={frame} markStart={markStart} />
    </div>
  );
};

/**
 * 見出しの文字サイズ。まず 1 行に収まるよう縮め、無理なら 2 行で、本文の領域(layout.contentTop)に
 * かからない大きさにする。
 */
export const headingSize = (text: string): number => {
  const oneLine = fitFontSize(text, { maxWidth: layout.contentWidth, max: font.size.heading, min: 36, maxLines: 1 });
  if (estimateLines(text, oneLine, layout.contentWidth) <= 1) return oneLine;
  return fitFontSize(text, { maxWidth: layout.contentWidth, max: 36, min: 26, maxLines: 2 });
};

/**
 * 見出し: 左からスライドして入り、下線が左から伸びる。画面左上の決まった位置に置く。
 */
export const Heading = ({ text, frame, start = 0 }: { text: string; frame: number; start?: number }) => {
  const p = progress(frame, start, T.enter);
  const line = progress(frame, start + 8, 16, ease.inOut);
  const size = headingSize(text);
  return (
    <div
      style={{
        position: 'absolute',
        left: layout.padX,
        top: layout.headingTop,
        maxWidth: layout.contentWidth,
        opacity: p,
        transform: `translateX(${mix(p, -60, 0)}px)`,
      }}
    >
      <div style={{ display: 'inline-block', fontSize: size, fontWeight: font.weight.black, lineHeight: 1.3, ...wrapStyle }}>
        <MarkedText text={text} frame={frame} markStart={start + 20} />
        <div
          style={{
            height: 6,
            marginTop: 10,
            borderRadius: 3,
            background: colors.yellow,
            transform: `scaleX(${line})`,
            transformOrigin: 'left center',
          }}
        />
      </div>
    </div>
  );
};

/**
 * 字幕: 画面下の帯に出る補足の文。空文字なら何も出さない。
 */
export const Caption = ({ text, frame, start = T.enter }: { text: string; frame: number; start?: number }) => {
  if (text.trim() === '') return null;
  const p = progress(frame, start, T.enter);
  const size = fitFontSize(text, { maxWidth: 1000, max: font.size.caption, min: 20, maxLines: 2 });
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 36,
        display: 'flex',
        justifyContent: 'center',
        opacity: p,
        transform: `translateY(${mix(p, 16, 0)}px)`,
      }}
    >
      <div
        style={{
          maxWidth: 1040,
          padding: '10px 28px',
          borderRadius: 12,
          background: alpha(colors.bg, 0.78),
          border: `1px solid ${alpha(colors.sub, 0.22)}`,
          color: colors.text,
          fontSize: size,
          fontWeight: font.weight.regular,
          lineHeight: 1.45,
          textAlign: 'center',
          ...wrapStyle,
        }}
      >
        <MarkedText text={text} frame={frame} markStart={start + 10} />
      </div>
    </div>
  );
};

/**
 * シーンの入れ物。シーン終わりの T.exit フレームで左へスライドしながらフェードして退場する。
 * 動画の側で全シーンに自動で付くので、部品の中では使わなくてよい。
 */
export const SceneFrame = ({
  frame,
  durationInFrames,
  children,
}: {
  frame: number;
  durationInFrames: number;
  children?: ReactNode;
}) => {
  const e = exitProgress(frame, durationInFrames);
  return <Fill style={{ opacity: 1 - e, transform: `translateX(${mix(e, 0, -80)}px)` }}>{children}</Fill>;
};
