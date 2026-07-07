// 回答画面：設問定義(JSON) → フォーム描画 → 送信
(function () {
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function questionHtml(q) {
    const req = q.required ? `<span class="q-req">必須</span>` : `<span class="q-opt-label">任意</span>`;
    let body = "";
    if (q.type === "choice") {
      body = `<div class="choice-list">` + q.options.map(opt =>
        `<label><input type="radio" name="${esc(q.id)}" value="${esc(opt)}">${esc(opt)}</label>`
      ).join("") + `</div>`;
    } else if (q.type === "nps") {
      body = `<div class="scale-row" data-q="${esc(q.id)}">` +
        Array.from({ length: 11 }, (_, i) =>
          `<button type="button" data-v="${i}" aria-label="${i}点">${i}</button>`).join("") +
        `</div><div class="scale-labels"><span>${esc(q.low || "全く思わない")}</span><span>${esc(q.high || "強くそう思う")}</span></div>`;
    } else if (q.type === "likert5") {
      body = `<div class="scale-row" data-q="${esc(q.id)}">` +
        [1, 2, 3, 4, 5].map(i => `<button type="button" data-v="${i}" aria-label="${i}">${i}</button>`).join("") +
        `</div><div class="scale-labels"><span>1：${esc(q.low || "そう思わない")}</span><span>5：${esc(q.high || "そう思う")}</span></div>`;
    } else if (q.type === "text") {
      body = `<textarea name="${esc(q.id)}" placeholder="${esc(q.placeholder || "ご自由にお書きください")}"></textarea>`;
    }
    const help = q.help ? `<p class="note">${esc(q.help)}</p>` : "";
    return `<div class="q-block" id="qb-${esc(q.id)}"><p class="q-text">${esc(q.text)}${req}</p>${help}${body}<p class="error-msg" hidden>この質問は必須です</p></div>`;
  }

  async function render(el, slug, channel) {
    el.innerHTML = `<div class="loading">読み込み中…</div>`;
    let survey;
    try { survey = await window.api.getSurvey(slug); }
    catch (e) { el.innerHTML = `<div class="card"><p>読み込みに失敗しました。電波状況をご確認のうえ、再度お試しください。</p><p class="note">${esc(e.message)}</p></div>`; return; }
    if (!survey) { el.innerHTML = `<div class="card"><p>このアンケートは現在受付していません。</p></div>`; return; }

    const def = survey.definition;
    const answered = localStorage.getItem(`koe_done_${slug}`);
    const answeredNote = answered ? `<p class="note">※${answered} にもご回答いただいています（再度の回答も歓迎です）</p>` : "";

    el.innerHTML = `
      <div class="card">
        <h1>${esc(survey.title)}</h1>
        <p class="sub">${esc(def.intro || "")}</p>
        <p class="note">${esc(def.anonymous_note || "回答は匿名です。個人が特定されることはありません。")}</p>
        ${answeredNote}
      </div>
      <div class="card"><form id="koe-form">${def.questions.map(questionHtml).join("")}</form></div>
      <div class="submit-area">
        <button class="btn" id="koe-submit">回答を送信する</button>
        <p class="error-msg" id="submit-err" hidden></p>
      </div>`;

    const answers = {};
    // スケールボタンの選択挙動
    el.querySelectorAll(".scale-row").forEach(row => {
      row.addEventListener("click", e => {
        const btn = e.target.closest("button[data-v]");
        if (!btn) return;
        row.querySelectorAll("button").forEach(b => b.classList.remove("sel"));
        btn.classList.add("sel");
        answers[row.dataset.q] = Number(btn.dataset.v);
      });
    });

    document.getElementById("koe-submit").addEventListener("click", async () => {
      // 収集
      for (const q of def.questions) {
        if (q.type === "choice") {
          const c = el.querySelector(`input[name="${q.id}"]:checked`);
          if (c) answers[q.id] = c.value; else delete answers[q.id];
        } else if (q.type === "text") {
          const v = el.querySelector(`textarea[name="${q.id}"]`).value.trim();
          if (v) answers[q.id] = v; else delete answers[q.id];
        }
      }
      // 必須チェック
      let firstMissing = null;
      for (const q of def.questions) {
        const missing = q.required && (answers[q.id] === undefined || answers[q.id] === "");
        const msg = el.querySelector(`#qb-${q.id} .error-msg`);
        if (msg) msg.hidden = !missing;
        if (missing && !firstMissing) firstMissing = q.id;
      }
      if (firstMissing) {
        document.getElementById(`qb-${firstMissing}`).scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      // 送信
      const btn = document.getElementById("koe-submit");
      btn.disabled = true; btn.textContent = "送信中…";
      try {
        await window.api.submitResponse({ survey_id: survey.id, channel, answers });
        localStorage.setItem(`koe_done_${slug}`, new Date().toLocaleDateString("ja-JP"));
        el.innerHTML = `<div class="card thanks">
            <p class="big">ありがとうございました</p>
            <p>${esc(def.thanks || "いただいた声は、より良いサービスづくりに活かしてまいります。")}</p>
          </div>`;
        window.scrollTo(0, 0);
      } catch (e) {
        btn.disabled = false; btn.textContent = "回答を送信する";
        const err = document.getElementById("submit-err");
        err.hidden = false;
        err.textContent = "送信に失敗しました。電波状況をご確認のうえ、もう一度お試しください。";
      }
    });
  }

  window.surveyView = { render };
})();
