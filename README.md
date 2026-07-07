# コエ（koe-survey）

**声が活きるアンケート** — クライアント横断で使い回せる、エンゲージメント／NPS測定Webアプリ。

- 回答者：QRコード → ログイン不要・匿名・スマホで3〜5分
- 管理者：ログイン → NPSスコア・ERG軸別スコア・月次推移・自由記述・CSV出力
- 設計思想・データ構造は [PLAN.md](PLAN.md) 参照

## 構成

| 層 | 技術 | 費用 |
|---|---|---|
| フロント | 素のHTML/CSS/JS（ビルド不要） | — |
| ホスティング | GitHub Pages | 無料 |
| DB・認証 | Supabase（Pro） | 月25ドル |

## セットアップ（初回のみ）

### 1. Supabase
1. [supabase.com](https://supabase.com) でProプランにアップグレードし、新規プロジェクトを作成（リージョン: Tokyo）
2. **SQL Editor** で `supabase/schema.sql` の全文を貼り付けて実行
3. **Authentication > Users > Add user** で管理者を1人作成（メール＋パスワード。「Auto Confirm User」をON）
4. **Project Settings > API** から `Project URL` と `anon public` キーをコピー

### 2. このリポジトリ
1. `js/config.js` に上記のURLとanonキーを記入してコミット＆プッシュ
   （anonキーは公開してよい設計。**service_roleキーは絶対に書かない**）
2. GitHubリポジトリの **Settings > Pages** で `main` ブランチ / `/ (root)` を公開

### 3. 動作確認
- `https://<user>.github.io/koe-survey/#/admin` にログインできればOK

## 運用

### 新しいアンケートを作る
1. 設問定義JSONを用意（`surveys/demo-nps.json` が見本。Claude Codeに「◯◯用のサーベイJSON作って」と依頼→コピペが早い）
2. 管理画面 > 新規サーベイ に貼り付けて登録 → 状態を `open` に
3. **クライアント名・slugは仮名にする**（リポジトリもURLも公開のため。例: 西尾歯科→`nd`）

### 設問タイプ
| type | 説明 | 主なオプション |
|---|---|---|
| `choice` | 単一選択 | `options` |
| `nps` | 0〜10の11段階 | `low` / `high`（両端ラベル） |
| `likert5` | 5段階 | `low` / `high`、`axis`（E/R/G） |
| `text` | 自由記述 | `placeholder` / `help` |

`definition.scoring` で `nps_question`（NPS計算対象）・`headline`（ヘッドライン設問）・`erg_axes`（ERG軸別集計）を指定。

### QRコードを作る
管理画面のダッシュボード下部に配布用URLが出る。QR画像化は：
```bash
python3 tools/make_qr.py --survey "https://<user>.github.io/koe-survey/#/s/<slug>" unit1 unit2 unit3
```

### 匿名性のルール（変えない）
- 回答にIP・氏名・メール・時刻を持たない（日付のみ）
- 回答数5件未満の属性クロスはスコア非表示
- 結果の解釈・共有は「個人探し」に使わない前提でクライアントと合意する

## デモモード

`js/config.js` が空のままなら**デモモード**で動く：
- サーベイは `surveys/*.json` から読み込み
- 回答はブラウザのlocalStorageのみに保存（サーバー送信なし）
- 管理画面はログイン不要、「デモ回答を30件生成」ボタンでダッシュボードを試せる

ローカルで試す：
```bash
python3 -m http.server 8000
# → http://localhost:8000/#/s/demo-nps （回答画面）
# → http://localhost:8000/#/admin      （管理画面）
```
