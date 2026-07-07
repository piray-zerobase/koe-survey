// koe-survey 接続設定
// Supabaseプロジェクト作成後、下記2つを埋めてコミットする。
// ※anonキーは公開してよい設計（守りはRLS）。service_roleキーは絶対にここに書かない。
// 両方が空文字列の間は「デモモード」で動く（回答はこの端末のlocalStorageのみに保存）。
window.KOE_CONFIG = {
  supabaseUrl: "",     // 例: "https://xxxxxxxxxxxx.supabase.co"
  supabaseAnonKey: ""  // Project Settings > API > anon public
};
