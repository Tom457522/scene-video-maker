/** キー操作の一覧(? キーで開く) */
import { Modal } from './Modal';

const KEYS: [string, string][] = [
  ['スペース', '再生 / 停止'],
  ['↑ ↓', 'シーンを選ぶ'],
  ['Alt + ↑ ↓', 'シーンを並べ替える'],
  ['Ctrl + D', 'シーンを複製'],
  ['Delete', 'シーンを削除'],
  ['Ctrl + C / Ctrl + V', 'シーンをコピー / 選んでいるシーンの後ろに貼り付け'],
  ['L', '選んでいるシーンだけを繰り返し再生'],
  ['Ctrl + S', 'すぐに保存して、前の版として残す(ふだんは自動で保存されます)'],
  ['Ctrl + Z / Ctrl + Y', '元に戻す / やり直し'],
  ['Ctrl + B', '入力欄で選んだ語を [[ ]] で囲んで強調'],
  ['?', 'この一覧'],
];

export const KeysDialog = ({ onClose }: { onClose: () => void }) => (
  <Modal title="キー操作の一覧" onClose={onClose}>
    <table className="keys-table">
      <tbody>
        {KEYS.map(([k, v]) => (
          <tr key={k}>
            <td>
              <kbd>{k}</kbd>
            </td>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="muted small">入力欄の中では、矢印・Delete・スペースなどは文字の入力に使われます(シーンの操作は入力欄の外で)。</p>
  </Modal>
);
