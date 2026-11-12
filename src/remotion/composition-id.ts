export const COMPOSITION_ID = 'Explainer';
/** 縦長(9:16、ショート動画向け) */
export const VERTICAL_COMPOSITION_ID = 'ExplainerVertical';

/** 書き出しの形式 */
export const EXPORT_FORMATS = {
  '720p': { label: '720p', detail: '1280×720', composition: COMPOSITION_ID, scale: 1 },
  '1080p': { label: '1080p', detail: '1920×1080', composition: COMPOSITION_ID, scale: 1.5 },
  vertical: { label: '縦長(ショート)', detail: '1080×1920・9:16', composition: VERTICAL_COMPOSITION_ID, scale: 1 },
} as const;

export type ExportFormat = keyof typeof EXPORT_FORMATS;
