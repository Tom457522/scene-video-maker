export const COMPOSITION_ID = 'Explainer';
/** 縦長(9:16、ショート動画向け) */
export const VERTICAL_COMPOSITION_ID = 'ExplainerVertical';

/** 書き出しの形式 */
export const EXPORT_FORMATS = {
  '720p': { label: '720p', detail: '1280×720', composition: COMPOSITION_ID, scale: 1, codec: 'h264', ext: 'mp4', sceneOnly: false },
  '1080p': { label: '1080p', detail: '1920×1080', composition: COMPOSITION_ID, scale: 1.5, codec: 'h264', ext: 'mp4', sceneOnly: false },
  vertical: { label: '縦長(ショート)', detail: '1080×1920・9:16', composition: VERTICAL_COMPOSITION_ID, scale: 1, codec: 'h264', ext: 'mp4', sceneOnly: false },
  gif: { label: 'GIF(選んだシーン)', detail: '640×360・15fps・くり返し再生', composition: COMPOSITION_ID, scale: 0.5, codec: 'gif', ext: 'gif', sceneOnly: true },
} as const;

export type ExportFormat = keyof typeof EXPORT_FORMATS;

/** 画質(H.264 の CRF。小さいほど高画質でファイルが大きい) */
export const QUALITIES = {
  light: { label: '軽い', detail: 'ファイルが小さい(共有向け)', crf: 28 },
  normal: { label: 'ふつう', detail: '標準', crf: 20 },
  high: { label: '高画質', detail: 'ファイルが大きい(保存・再編集向け)', crf: 15 },
} as const;

export type Quality = keyof typeof QUALITIES;
