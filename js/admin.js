// 管理画面：ログイン／サーベイ一覧／ダッシュボード／新規登録／QR用URL
(function () {
  const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const MIN_N = 5; // これ未満の属性クロスはスコア非表示（匿名性の担保）

  // ---------- 集計 ----------
  function npsCounts(responses, qid) {
    const counts = Array(11).fill(0);
    for (const r of responses) {
      const v = r.answers[qid];
      if (typeof v === "number" && v >= 0 && v <= 10) counts[v]++;
    }
    return counts;
  }
  function npsScore(counts) {
    const total = counts.reduce((a, b) => a + b, 0);
    if (!total) return null;
    const promoters = counts[9] + counts[10];
    const detractors = counts.slice(0, 7).reduce((a, b) => a + b, 0);
    return Math.round(((promoters - detractors) / total) * 100);
  }
  function avg(responses, qid) {
    const vals = responses.map(r => r.answers[qid]).filter(v => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  function byMonth(responses) {
    const m = {};
    for (const r of responses) {
      const key = (r.answered_on || "").slice(0, 7);
      if (!key) continue;
      (m[key] = m[key] || []).push(r);
    }
    return Object.keys(m).sort().map(k => ({ month: k, rows: m[k] }));
  }

  // ---------- CSV ----------
  function toCsv(survey, responses) {
    const qs = survey.definition.questions;
    const head = ["回答日", "チャネル", ...qs.map(q => q.text)];
    const rows = responses.map(r => [r.answered_on, r.channel || "", ...qs.map(q => r.answers[q.id] ?? "")]);
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    return "﻿" + [head, ...rows].map(row => row.map(q).join(",")).join("\r\n");
  }
  function download(filename, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- 画面 ----------
  async function render(el, sub) {
    el.classList.add("wide");
    if (!window.api.isLoggedIn()) return renderLogin(el);
    if (sub.startsWith("new")) return renderNew(el);
    if (sub) return renderDashboard(el, decodeURIComponent(sub));
    return renderList(el);
  }

  function demoBanner() {
    return window.api.isDemo
      ? `<div class="demo-banner">⚠️ デモモードで動作中（Supabase未接続）。回答はこの端末のブラウザ内にのみ保存されます。本番運用には js/config.js に接続情報を設定してください。</div>`
      : "";
  }

  function renderLogin(el) {
    el.innerHTML = `${demoBanner()}
      <div class="card login-box">
        <h1>コエ 管理画面</h1>
        <p class="sub" style="margin-bottom:16px">管理者ログイン</p>
        <input type="email" id="login-email" placeholder="メールアドレス" autocomplete="username">
        <input type="password" id="login-pass" placeholder="パスワード" autocomplete="current-password">
        <button class="btn" id="login-btn" style="width:100%">ログイン</button>
        <p class="error-msg" id="login-err" hidden></p>
      </div>`;
    document.getElementById("login-btn").addEventListener("click", async () => {
      try {
        await window.api.login(document.getElementById("login-email").value, document.getElementById("login-pass").value);
        render(el, "");
      } catch (e) {
        const err = document.getElementById("login-err");
        err.hidden = false; err.textContent = e.message;
      }
    });
  }

  async function renderList(el) {
    el.innerHTML = `${demoBanner()}<div class="loading">読み込み中…</div>`;
    let surveys;
    try { surveys = await window.api.listSurveys(); }
    catch (e) { el.innerHTML = `<div class="card"><p class="error-msg">${esc(e.message)}</p></div>`; return; }

    const rows = surveys.map(s => `
      <tr class="rowlink" data-id="${esc(s.id)}">
        <td><strong>${esc(s.title)}</strong><br><span class="note">${esc(s.slug)}</span></td>
        <td>${esc(s.client)}</td>
        <td><span class="badge ${esc(s.status)}">${esc(s.status)}</span></td>
        <td>${esc((s.created_at || "").slice(0, 10))}</td>
      </tr>`).join("");

    el.innerHTML = `${demoBanner()}
      <div class="admin-bar">
        <h1>コエ 管理画面</h1>
        <div>
          <a class="btn btn-sm" href="#/admin/new">＋ 新規サーベイ</a>
          <button class="btn btn-sub btn-sm" id="logout-btn">ログアウト</button>
        </div>
      </div>
      <div class="card">
        <table class="list">
          <thead><tr><th>タイトル</th><th>クライアント</th><th>状態</th><th>作成日</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="4" class="note">サーベイがまだありません</td></tr>`}</tbody>
        </table>
      </div>`;
    el.querySelectorAll("tr.rowlink").forEach(tr =>
      tr.addEventListener("click", () => { location.hash = `#/admin/${encodeURIComponent(tr.dataset.id)}`; }));
    document.getElementById("logout-btn").addEventListener("click", () => { window.api.logout(); location.hash = "#/admin"; location.reload(); });
  }

  async function renderDashboard(el, surveyId) {
    el.innerHTML = `${demoBanner()}<div class="loading">集計中…</div>`;
    let surveys, responses;
    try {
      surveys = await window.api.listSurveys();
      responses = await window.api.getResponses(surveyId);
    } catch (e) { el.innerHTML = `<div class="card"><p class="error-msg">${esc(e.message)}</p></div>`; return; }
    const survey = surveys.find(s => String(s.id) === String(surveyId));
    if (!survey) { el.innerHTML = `<div class="card"><p>サーベイが見つかりません</p><p><a href="#/admin">← 一覧へ</a></p></div>`; return; }

    const def = survey.definition;
    const scoring = def.scoring || {};
    const n = responses.length;

    // --- タイル ---
    let tiles = `<div class="tile"><div class="t-label">回答数</div><div class="t-value">${n}</div></div>`;
    let npsSection = "";
    if (scoring.nps_question) {
      const counts = npsCounts(responses, scoring.nps_question);
      const score = npsScore(counts);
      const total = counts.reduce((a, b) => a + b, 0);
      const pro = counts[9] + counts[10], det = counts.slice(0, 7).reduce((a, b) => a + b, 0);
      tiles += `<div class="tile"><div class="t-label">NPS</div><div class="t-value">${score === null ? "—" : (score > 0 ? "+" : "") + score}</div><div class="t-note">推奨者${total ? Math.round(pro / total * 100) : 0}% − 批判者${total ? Math.round(det / total * 100) : 0}%</div></div>`;
      npsSection = `<div class="card"><h2>NPS分布（0〜10点）</h2><div class="chart-wrap">${charts.npsDist(counts)}</div>
        <div class="legend">
          <span><span class="chip" style="background:${charts.colors.detractor}"></span>批判者 0–6</span>
          <span><span class="chip" style="background:${charts.colors.passive}"></span>中立 7–8</span>
          <span><span class="chip" style="background:${charts.colors.promoter}"></span>推奨者 9–10</span>
        </div></div>`;
    }

    const likertQs = def.questions.filter(q => q.type === "likert5");
    if (likertQs.length) {
      const allAvg = likertQs.map(q => avg(responses, q.id)).filter(v => v !== null);
      if (allAvg.length) {
        const engScore = allAvg.reduce((a, b) => a + b, 0) / allAvg.length;
        tiles += `<div class="tile"><div class="t-label">5段階 全設問平均</div><div class="t-value">${engScore.toFixed(2)}</div><div class="t-note">5点満点</div></div>`;
      }
    }
    if (scoring.headline) {
      const h = avg(responses, scoring.headline);
      const hq = def.questions.find(q => q.id === scoring.headline);
      if (h !== null) tiles += `<div class="tile"><div class="t-label">${esc((hq && hq.short) || "ヘッドライン")}</div><div class="t-value">${h.toFixed(2)}</div><div class="t-note">${esc(hq ? hq.text : "")}</div></div>`;
    }

    // --- 月次推移 ---
    const months = byMonth(responses);
    let trendSection = "";
    if (months.length >= 2) {
      let pts, fmt, title;
      if (scoring.nps_question) {
        pts = months.map(m => ({ label: m.month.slice(2).replace("-", "/"), value: npsScore(npsCounts(m.rows, scoring.nps_question)) ?? 0, n: m.rows.length }));
        fmt = v => String(Math.round(v)); title = "NPS 月次推移";
      } else {
        const target = scoring.headline || (likertQs[0] && likertQs[0].id);
        pts = months.map(m => ({ label: m.month.slice(2).replace("-", "/"), value: avg(m.rows, target) ?? 0, n: m.rows.length }));
        fmt = v => v.toFixed(2); title = "月次推移（ヘッドライン設問）";
      }
      trendSection = `<div class="card"><h2>${title}</h2><div class="chart-wrap">${charts.line(pts, { valueFmt: fmt })}</div></div>`;
    }

    // --- ERG軸別 ---
    let ergSection = "";
    if (scoring.erg_axes) {
      const axes = { E: "E：生存（待遇・環境）", R: "R：関係（承認・つながり）", G: "G：成長（強み・挑戦）" };
      const items = Object.keys(axes).map(ax => {
        const qids = def.questions.filter(q => q.axis === ax).map(q => q.id);
        const vals = qids.map(qid => avg(responses, qid)).filter(v => v !== null);
        return vals.length ? { label: axes[ax], value: vals.reduce((a, b) => a + b, 0) / vals.length } : null;
      }).filter(Boolean);
      if (items.length) ergSection = `<div class="card"><h2>ERG軸別スコア</h2><div class="chart-wrap">${charts.hbar(items, 5)}</div><p class="note">低い軸が「いま満たされていない欲求」＝打ち手の優先順位</p></div>`;
    }

    // --- 設問別平均（低い順） ---
    let itemSection = "";
    if (likertQs.length) {
      const items = likertQs.map(q => ({ label: q.text, value: avg(responses, q.id) })).filter(it => it.value !== null)
        .sort((a, b) => a.value - b.value);
      if (items.length) itemSection = `<div class="card"><h2>設問別平均（低い順）</h2><div class="chart-wrap">${charts.hbar(items, 5)}</div></div>`;
    }

    // --- チャネル別 ---
    let channelSection = "";
    if (def.channels && def.channels.length) {
      const rows = def.channels.map(ch => {
        const rs = responses.filter(r => r.channel === ch);
        let scoreCell = "—";
        if (rs.length >= MIN_N && scoring.nps_question) scoreCell = String(npsScore(npsCounts(rs, scoring.nps_question)));
        else if (rs.length >= MIN_N && scoring.headline) scoreCell = (avg(rs, scoring.headline) ?? 0).toFixed(2);
        else if (rs.length > 0 && rs.length < MIN_N) scoreCell = `<span class="note">n&lt;${MIN_N}のため非表示</span>`;
        return `<tr><td>${esc(ch)}</td><td>${rs.length}</td><td>${scoreCell}</td></tr>`;
      }).join("");
      channelSection = `<div class="card"><h2>チャネル別（配布経路）</h2>
        <table class="list"><thead><tr><th>チャネル</th><th>回答数</th><th>スコア</th></tr></thead><tbody>${rows}</tbody></table>
        <p class="note">回答数${MIN_N}件未満のスコアは匿名性確保のため表示しません</p></div>`;
    }

    // --- 自由記述 ---
    const textQs = def.questions.filter(q => q.type === "text");
    let textSection = "";
    for (const q of textQs) {
      const items = responses.filter(r => r.answers[q.id]).map(r =>
        `<div class="freetext-item">${esc(r.answers[q.id])}<div class="meta">${esc(r.answered_on)}${r.channel ? "・" + esc(r.channel) : ""}</div></div>`).join("");
      if (items) textSection += `<div class="card"><h2>${esc(q.text)}</h2>${items}</div>`;
    }

    // --- QR用URL ---
    const base = location.href.split("#")[0];
    const urls = (def.channels && def.channels.length ? def.channels : [null]).map(ch => {
      const u = `${base}#/s/${survey.slug}${ch ? `?ch=${encodeURIComponent(ch)}` : ""}`;
      return `<div><strong>${esc(ch || "共通")}</strong><div class="qr-url">${esc(u)}</div></div>`;
    }).join("");

    const demoSeedBtn = window.api.isDemo
      ? `<button class="btn btn-sub btn-sm" id="seed-btn">デモ回答を30件生成</button>` : "";

    el.innerHTML = `${demoBanner()}
      <div class="admin-bar">
        <div class="crumb"><a href="#/admin">← 一覧</a></div>
        <div>
          ${demoSeedBtn}
          <button class="btn btn-sub btn-sm" id="csv-btn">CSVダウンロード</button>
          <button class="btn btn-sub btn-sm" id="status-btn">${survey.status === "open" ? "受付を締め切る" : "受付を開始する"}</button>
        </div>
      </div>
      <div class="card">
        <h1>${esc(survey.title)} <span class="badge ${esc(survey.status)}">${esc(survey.status)}</span></h1>
        <p class="note">クライアント: ${esc(survey.client)} ／ slug: ${esc(survey.slug)}</p>
      </div>
      <div class="tiles">${tiles}</div>
      ${npsSection}${trendSection}${ergSection}${itemSection}${channelSection}${textSection}
      <div class="card"><h2>配布用URL（QRコード化はREADME参照）</h2>${urls}</div>`;

    document.getElementById("csv-btn").addEventListener("click", () =>
      download(`koe_${survey.slug}_${new Date().toISOString().slice(0, 10)}.csv`, toCsv(survey, responses)));
    document.getElementById("status-btn").addEventListener("click", async () => {
      await window.api.updateSurveyStatus(survey.id, survey.status === "open" ? "closed" : "open");
      renderDashboard(el, surveyId);
    });
    const seedBtn = document.getElementById("seed-btn");
    if (seedBtn) seedBtn.addEventListener("click", async () => {
      await window.api.seedDemo(survey, 30);
      renderDashboard(el, surveyId);
    });
  }

  function renderNew(el) {
    el.innerHTML = `${demoBanner()}
      <div class="admin-bar"><div class="crumb"><a href="#/admin">← 一覧</a></div></div>
      <div class="card">
        <h1>新規サーベイ登録</h1>
        <p class="sub">サーベイ定義JSONを貼り付けて登録します（設問の作成はClaude Codeに依頼→コピペ運用）。形式は surveys/demo-nps.json 参照。</p>
        <textarea class="json-editor" id="new-json" placeholder='{"slug": "...", "client": "...", "title": "...", "status": "draft", "definition": { ... }}'></textarea>
        <div style="margin-top:12px"><button class="btn" id="new-btn">登録する</button></div>
        <p class="error-msg" id="new-err" hidden></p>
      </div>`;
    document.getElementById("new-btn").addEventListener("click", async () => {
      const err = document.getElementById("new-err");
      try {
        const obj = JSON.parse(document.getElementById("new-json").value);
        for (const k of ["slug", "client", "title", "definition"]) {
          if (!obj[k]) throw new Error(`${k} がありません`);
        }
        if (!Array.isArray(obj.definition.questions) || !obj.definition.questions.length) throw new Error("definition.questions が空です");
        obj.status = obj.status || "draft";
        await window.api.createSurvey(obj);
        location.hash = "#/admin";
      } catch (e) {
        err.hidden = false; err.textContent = e.message;
      }
    });
  }

  window.adminView = { render };
})();
