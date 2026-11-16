/** シーンが 1 つもないときの最初の画面: どうやって作るかを 3 つから選ぶ */
import { UiIcon } from './ui-icons';

type Props = {
  onOutline: () => void;
  onTemplate: () => void;
  onKinds: () => void;
  onImportZip: () => void;
};

export const StartPanel = ({ onOutline, onTemplate, onKinds, onImportZip }: Props) => (
  <main className="start">
    <div className="start-head">
      <h1>どうやって作りますか?</h1>
      <p>どれを選んでも、あとから自由に直せます。</p>
    </div>
    <div className="start-grid">
      <button type="button" className="start-card recommended" onClick={onOutline}>
        <div className="start-card-top">
          <span className="start-icon teal">
            <UiIcon name="doc" size={24} />
          </span>
          <span className="badge">おすすめ</span>
        </div>
        <b>文章を貼って作る</b>
        <span className="muted">見出し(#)と箇条書き(-)で書いた文章から、シーンの並びを自動で作ります。</span>
        <pre className="start-sample">{'# ブロックチェーン\n## しくみ\n- 記録をつなぐ\n- 改ざんしにくい'}</pre>
      </button>
      <button type="button" className="start-card" onClick={onTemplate}>
        <span className="start-icon yellow">
          <UiIcon name="grid" size={24} />
        </span>
        <b>ひな形から作る</b>
        <span className="muted">3 分解説・比較レビュー・ニュース風・手順の解説から始めて、( ) の中を書き換えます。</span>
      </button>
      <button type="button" className="start-card" onClick={onKinds}>
        <span className="start-icon">
          <UiIcon name="plus" size={24} />
        </span>
        <b>1 シーンずつ作る</b>
        <span className="muted">タイトル・箇条書き・グラフなどの種類を選んで、1 つずつ足していきます。</span>
      </button>
    </div>
    <p className="muted small">
      ほかの PC で作ったものは{' '}
      <button type="button" className="link" onClick={onImportZip}>
        zip から読み込む
      </button>{' '}
      ・ すべての種類の見た目は{' '}
      <a href="/?gallery" target="_blank" rel="noreferrer">
        見本を見る
      </a>
    </p>
  </main>
);
