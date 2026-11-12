/** 画像の管理: projects/assets/ の画像の一覧と、使っているプロジェクト。使っていない画像を削除できる */
import { useCallback, useEffect, useState } from 'react';
import { assetUrl, refreshAssets, uploadAsset } from './assets';
import { Modal } from './Modal';

type Usage = { name: string; size: number; usedBy: string[] };

const fetchUsage = async (): Promise<Usage[]> => {
  const res = await fetch('/api/assets?usage');
  const data = (await res.json()) as { assets?: Usage[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? `エラー (${res.status})`);
  return data.assets ?? [];
};

export const AssetsDialog = ({ current, usedNow, onClose }: { current: string; usedNow: Set<string>; onClose: () => void }) => {
  const [list, setList] = useState<Usage[] | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      fetchUsage().then(
        (a) => setList(a),
        (e: Error) => setError(e.message),
      ),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);

  const remove = async (a: Usage, users: string[]) => {
    const msg = users.length > 0 ? `「${a.name}」は ${users.join('、')} で使われています。削除すると、そこは「画像が見つかりません」になります。削除しますか?` : `「${a.name}」を削除しますか?`;
    if (!window.confirm(`${msg}\n(projects/.trash/ に移るので、手で戻すこともできます)`)) return;
    const res = await fetch(`/api/assets/${encodeURIComponent(a.name)}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!res.ok) window.alert(((await res.json()) as { error?: string }).error ?? '削除できませんでした');
    await refreshAssets();
    await load();
  };

  const unused = list?.filter((a) => a.usedBy.length === 0 && !usedNow.has(a.name)) ?? [];
  return (
    <Modal title="画像の管理" onClose={onClose} wide>
      <div className="row-between">
        <p className="muted small">
          projects/assets/ の画像です。「使っているプロジェクト」は保存済みのプロジェクトと、いま編集中の内容から調べています。
          {list && ` ${list.length} 枚(使っていない画像 ${unused.length} 枚)`}
        </p>
        <label className="upload">
          画像を追加
          <input
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              try {
                await uploadAsset(f);
                await load();
              } catch (err) {
                window.alert(`画像を追加できませんでした: ${(err as Error).message}`);
              }
            }}
          />
        </label>
      </div>
      {error && <p className="warn">{error}</p>}
      {list?.length === 0 && <p className="muted">画像はまだありません。</p>}
      <div className="asset-grid">
        {list?.map((a) => {
          const users = [...new Set([...a.usedBy.filter((u) => u !== current), ...(usedNow.has(a.name) ? [`${current}(編集中)`] : a.usedBy.includes(current) ? [current] : [])])];
          return (
            <div key={a.name} className={users.length === 0 ? 'asset-card unused' : 'asset-card'}>
              <img src={assetUrl(a.name)} alt="" />
              <div className="asset-name" title={a.name}>
                {a.name}
              </div>
              <div className="muted small">{Math.max(1, Math.round(a.size / 1024))} KB</div>
              <div className="small">{users.length > 0 ? `使用: ${users.join('、')}` : <span className="warn">どこでも使っていません</span>}</div>
              <button type="button" className="small-btn" onClick={() => void remove(a, users)}>
                削除
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
