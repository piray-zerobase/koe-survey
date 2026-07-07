// koe-survey 接続設定
// Supabaseプロジェクト作成後、下記2つを埋めてコミットする。
// キーは Project Settings > API Keys の「Publishable key」（sb_publishable_…）を推奨。
// 旧形式のanonキー（eyJ…）も使えるが、Supabaseが2026年末に廃止予定。
// ※どちらも公開してよいキー（守りはRLS）。secret／service_roleキーは絶対にここに書かない。
// 両方が空文字列の間は「デモモード」で動く（回答はこの端末のlocalStorageのみに保存）。
window.KOE_CONFIG = {
  supabaseUrl: "https://tgqmbqgzouqmueuylkux.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRncW1icWd6b3VxbXVldXlsa3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMzNzI4MTUsImV4cCI6MjA5ODk0ODgxNX0.VJV_24ncsQgH-b4s39JS47RfNhlj963HZH8Cyt5BYTI"
};
