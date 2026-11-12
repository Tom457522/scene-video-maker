/** 右列のもう 1 つのタブ: 動画全体の設定(テーマ・章の表示・チャンネル名とロゴ・エンドカード) */
import type { ReactNode } from 'react';
import { settingsSchema, type Settings } from '../video/project';
import { SchemaForm } from './SchemaForm';

export const VideoSettings = ({ settings, onChange, header }: { settings: Settings; onChange: (s: Settings) => void; header: ReactNode }) => (
  <aside className="col col-right">
    {header}
    <p className="muted small">動画全体にかかる設定です。すべてのシーンに反映されます。</p>
    <SchemaForm schema={settingsSchema} value={settings} onChange={(v) => onChange(v as Settings)} />
  </aside>
);
