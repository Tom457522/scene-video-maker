/**
 * カードの文からアイコンを選ぶ(AI は使わず、言葉の一覧で決める)。
 * 「- [shield] 名前: 説明」のように [ ] で書けば、そのアイコンを使う。
 */
import { ICON_OPTIONS, type IconName } from '../kit/icon-names';

/** 言葉 → アイコン。上から順に調べ、最初に見つかったものを使う */
const WORDS: [RegExp, IconName][] = [
  [/安全|守|防|セキュリ|保護|リスク/, 'shield'],
  [/暗号|鍵|ロック|認証|パスワード|秘密/, 'lock'],
  [/速|高速|すぐ|瞬時|効率/, 'zap'],
  [/時間|期間|待ち|遅延|年|月|日/, 'clock'],
  [/人|ユーザー|利用者|参加|みんな|社会|チーム|顧客/, 'users'],
  [/会話|相談|チャット|コミュニケーション|対話/, 'message'],
  [/メール|連絡|通知/, 'mail'],
  [/成長|増加|伸び|拡大|上昇|向上|改善/, 'trend'],
  [/お金|費用|コスト|価格|料金|円|ドル|収益|売上|投資|資金/, 'coins'],
  [/貯金|節約|貯蓄/, 'piggy'],
  [/買|購入|販売|EC|ショッピング/, 'cart'],
  [/配送|物流|輸送/, 'truck'],
  [/会社|企業|組織|政府|行政|機関/, 'building'],
  [/世界|国際|グローバル|海外|各国/, 'globe'],
  [/地域|場所|地図|位置/, 'map'],
  [/つなが|連携|接続|ネットワーク|リンク/, 'link'],
  [/組み合わせ|統合|互換/, 'puzzle'],
  [/設定|調整|仕組み|運用|管理/, 'settings'],
  [/コード|プログラム|開発|ソフト/, 'code'],
  [/AI|人工知能|機械学習|モデル|ロボット|自動/, 'bot'],
  [/頭脳|思考|判断|知能|考え/, 'brain'],
  [/計算|処理|性能|CPU|チップ|半導体/, 'cpu'],
  [/サーバー|基盤|インフラ/, 'server'],
  [/データ|情報|記録|保存/, 'database'],
  [/クラウド|オンライン|インターネット|ネット/, 'cloud'],
  [/スマホ|携帯|アプリ|モバイル/, 'phone'],
  [/学|教育|勉強|研究/, 'study'],
  [/本|知識|文献/, 'book'],
  [/書類|文書|契約|法|規制|ルール/, 'file'],
  [/注意|危険|問題|課題|懸念|欠点|デメリット/, 'alert'],
  [/目標|狙い|目的|ゴール/, 'target'],
  [/開始|始|導入|立ち上げ|スタート/, 'rocket'],
  [/発見|見つけ|調べ|探|検索|分析/, 'search'],
  [/見える|可視|透明|監視/, 'eye'],
  [/自然|環境|エコ|植物|森/, 'leaf'],
  [/再利用|循環|リサイクル|持続/, 'recycle'],
  [/エネルギー|太陽|電力|電気/, 'sun'],
  [/人気|好き|健康|医療|命/, 'heart'],
  [/一番|首位|優勝|勝/, 'trophy'],
  [/評価|品質|おすすめ|特徴/, 'star'],
  [/写真|画像|カメラ|映像/, 'camera'],
  [/荷物|商品|製品|パッケージ/, 'package'],
  [/重な|層|レイヤー|階層/, 'layers'],
  [/確認|完了|達成|正しい|メリット|利点/, 'check'],
  [/アイデア|ひらめ|発想|工夫/, 'lightbulb'],
];

const FALLBACK: IconName[] = ['lightbulb', 'star', 'target', 'check', 'rocket', 'flag'];

export const isIconName = (name: string): name is IconName => name in ICON_OPTIONS;

/** 文に合うアイコン。used に入っているものはなるべく避ける(同じ絵が並ばないように) */
export const guessIcon = (text: string, used: ReadonlySet<string> = new Set()): IconName => {
  const hits = WORDS.filter(([re]) => re.test(text)).map(([, icon]) => icon);
  return hits.find((i) => !used.has(i)) ?? hits[0] ?? FALLBACK.find((i) => !used.has(i)) ?? 'lightbulb';
};
