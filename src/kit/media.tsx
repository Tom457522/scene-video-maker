/**
 * 画像。projects/assets/ のファイル名で指定する(エディタの画像の入力欄で選んだ値)。
 * 書き出しでは画像を読み終えるまで撮影を待つ。ファイルがないときは代わりの枠を出す。
 */
import { useState, type CSSProperties } from 'react';
import { Img, staticFile } from 'remotion';
import { alpha, colors, font } from './theme';

/** 画像のファイル名から URL を作る(<img> や CSS の背景に使う) */
export const assetSrc = (file: string): string => staticFile(file);

export const Picture = ({
  file,
  fit = 'contain',
  style,
}: {
  file: string;
  /** contain: 全体を収める / cover: 枠いっぱいに広げて余りを切る */
  fit?: 'contain' | 'cover';
  style?: CSSProperties;
}) => {
  const [failed, setFailed] = useState(false);
  const box: CSSProperties = { width: '100%', height: '100%', ...style };
  if (file.trim() === '' || failed) {
    return (
      <div
        style={{
          ...box,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `3px dashed ${alpha(colors.sub, 0.5)}`,
          borderRadius: 16,
          color: colors.sub,
          fontSize: 26,
          fontWeight: font.weight.regular,
        }}
      >
        {failed ? `画像が見つかりません: ${file}` : '画像が選ばれていません'}
      </div>
    );
  }
  return <Img src={assetSrc(file)} onError={() => setFailed(true)} style={{ ...box, objectFit: fit, display: 'block' }} />;
};
