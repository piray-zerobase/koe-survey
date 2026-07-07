// ハッシュルーター
//   #/s/<slug>?ch=<channel>  → 回答画面
//   #/admin                  → 管理画面（一覧）
//   #/admin/new              → 新規サーベイ
//   #/admin/<survey-id>      → ダッシュボード
(function () {
  function route() {
    const el = document.getElementById("app");
    el.classList.remove("wide");
    const hash = location.hash || "#/";
    const [path, query] = hash.slice(1).split("?");
    const parts = path.split("/").filter(Boolean);

    if (parts[0] === "s" && parts[1]) {
      const params = new URLSearchParams(query || "");
      window.surveyView.render(el, parts[1], params.get("ch") || null);
    } else if (parts[0] === "admin") {
      window.adminView.render(el, parts.slice(1).join("/"));
    } else {
      el.innerHTML = `
        <div class="card" style="margin-top:60px; text-align:center">
          <h1>コエ</h1>
          <p class="sub">声が活きるアンケート</p>
          <p class="note" style="margin-top:12px">回答用URLは配布されたQRコードからアクセスしてください</p>
          <p style="margin-top:16px"><a href="#/admin">管理画面</a></p>
        </div>`;
    }
  }
  window.addEventListener("hashchange", route);
  route();
})();
