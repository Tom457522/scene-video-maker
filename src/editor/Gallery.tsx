/**
 * 部品の見本ページ(/?gallery)。全部品を、既定の入力の 30% / 70% / 95% の時点と、
 * 最大・最小の入力の 70% の時点で並べる。新しい部品が既存の部品と見た目でそろっているかを見比べるのに使う。
 */
import { Thumbnail } from '@remotion/player';
import { useMemo, useState } from 'react';
import { themes, VIDEO } from '../kit/theme';
import { partErrors, parts, type PartDef } from '../parts/registry';
import { minimalCase, worstCase } from '../parts/samples';
import { ProjectVideo } from '../video/ProjectVideo';
import { defaultSettings, sceneFrames } from '../video/project';

const SHOTS: { label: string; ratio: number; input: 'default' | 'worst' | 'minimal' }[] = [
  { label: '既定 30%', ratio: 0.3, input: 'default' },
  { label: '既定 70%', ratio: 0.7, input: 'default' },
  { label: '既定 95%', ratio: 0.95, input: 'default' },
  { label: '最大の入力 70%', ratio: 0.7, input: 'worst' },
  { label: '最小の入力 70%', ratio: 0.7, input: 'minimal' },
];

const Shot = ({ part, theme, ratio, input }: { part: PartDef; theme: string; ratio: number; input: 'default' | 'worst' | 'minimal' }) => {
  const inputProps = useMemo(() => {
    const props = input === 'worst' ? worstCase(part.schema) : input === 'minimal' ? minimalCase(part.schema) : (part.schema.parse({}) as Record<string, unknown>);
    return { project: { title: '', settings: { ...defaultSettings(), theme }, scenes: [{ part: part.id, seconds: part.meta.defaultSeconds, props }] } };
  }, [part, theme, input]);
  const frames = sceneFrames({ seconds: part.meta.defaultSeconds });
  return (
    <Thumbnail
      component={ProjectVideo}
      inputProps={inputProps}
      compositionWidth={VIDEO.width}
      compositionHeight={VIDEO.height}
      durationInFrames={frames}
      fps={VIDEO.fps}
      frameToDisplay={Math.min(frames - 1, Math.floor(frames * ratio))}
      style={{ width: '100%' }}
    />
  );
};

export const Gallery = () => {
  const [theme, setTheme] = useState('navy');
  const [filter, setFilter] = useState('');
  const list = parts.filter((p) => !filter || p.id.includes(filter) || p.meta.name.includes(filter));
  return (
    <div className="gallery">
      <header className="gallery-head">
        <h1>部品の見本</h1>
        <span className="muted">{parts.length} 個の部品。最大の入力は schema の上限いっぱいの文字・個数(npm run stress と同じ)。</span>
        <div className="spacer" />
        <input type="text" placeholder="部品を絞り込む" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 180 }} />
        <select value={theme} onChange={(e) => setTheme(e.target.value)} style={{ width: 180 }}>
          {Object.entries(themes).map(([id, t]) => (
            <option key={id} value={id}>
              {t.name}
            </option>
          ))}
        </select>
        <a href="/">エディタに戻る</a>
      </header>
      {partErrors.length > 0 && (
        <div className="part-errors">
          {partErrors.map((e) => (
            <div key={e.id}>
              {e.id}: {e.message}
            </div>
          ))}
        </div>
      )}
      {list.map((p) => (
        <section key={p.id} className="gallery-row">
          <div className="gallery-title">
            <b>{p.meta.name}</b> <span className="mono">{p.id}</span> <span className="muted">既定 {p.meta.defaultSeconds} 秒</span>
            <div className="muted small">{p.meta.description}</div>
          </div>
          <div className="gallery-shots">
            {SHOTS.map((s) => (
              <figure key={s.label}>
                <Shot part={p} theme={theme} ratio={s.ratio} input={s.input} />
                <figcaption>{s.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
