// バックエンド抽象化層
// Supabase設定済み → REST API（PostgREST + GoTrue）
// 未設定 → デモモード（surveys/*.json ＋ localStorage）
(function () {
  const cfg = window.KOE_CONFIG || {};
  const isDemo = !cfg.supabaseUrl || !cfg.supabaseAnonKey;

  // ---------- 共通ヘルパー ----------
  function localDateJST() {
    // 匿名性のため「日」まで。端末のローカル日付を使う（サーバーUTCとのズレ回避）
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  // ---------- Supabase実装 ----------
  function token() { return sessionStorage.getItem("koe_token") || ""; }

  async function sbFetch(path, { method = "GET", body, auth = false, headers = {} } = {}) {
    const h = {
      apikey: cfg.supabaseAnonKey,
      "Content-Type": "application/json",
      ...headers
    };
    // Authorizationヘッダー：ログイン済みならユーザートークン。
    // 未ログイン時は旧形式キー（eyJ…のJWT）のみBearerに載せる。
    // 新形式キー（sb_publishable_…）はJWTではないためBearerに載せると401になる（apikeyだけで匿名アクセスできる）。
    const bearer = auth && token() ? token() : (cfg.supabaseAnonKey.startsWith("eyJ") ? cfg.supabaseAnonKey : null);
    if (bearer) h.Authorization = `Bearer ${bearer}`;
    const res = await fetch(`${cfg.supabaseUrl}${path}`, {
      method, headers: h, body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 401 && auth) {
      sessionStorage.removeItem("koe_token");
      throw new Error("セッションが切れました。もう一度ログインしてください。");
    }
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`通信エラー (${res.status}) ${t.slice(0, 200)}`);
    }
    if (res.status === 204) return null;
    return res.json();
  }

  const sbApi = {
    isDemo: false,

    async getSurvey(slug) {
      const data = await sbFetch(`/rest/v1/rpc/get_survey`, { method: "POST", body: { p_slug: slug } });
      return data || null;
    },

    async submitResponse({ survey_id, channel, answers }) {
      await sbFetch(`/rest/v1/responses`, {
        method: "POST",
        body: { survey_id, channel: channel || null, answers, answered_on: localDateJST() },
        headers: { Prefer: "return=minimal" }
      });
    },

    async login(email, password) {
      const res = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: cfg.supabaseAnonKey, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      if (!res.ok) throw new Error("ログインに失敗しました。メールアドレスとパスワードを確認してください。");
      const data = await res.json();
      sessionStorage.setItem("koe_token", data.access_token);
    },

    logout() { sessionStorage.removeItem("koe_token"); },
    isLoggedIn() { return !!token(); },

    async listSurveys() {
      return sbFetch(`/rest/v1/surveys?select=id,slug,client,title,status,definition,created_at&order=created_at.desc`, { auth: true });
    },

    async getResponses(surveyId) {
      return sbFetch(`/rest/v1/responses?survey_id=eq.${surveyId}&select=channel,answers,answered_on&order=answered_on.desc`, {
        auth: true, headers: { Range: "0-9999" }
      });
    },

    async createSurvey(row) {
      const data = await sbFetch(`/rest/v1/surveys`, {
        method: "POST", auth: true, body: row, headers: { Prefer: "return=representation" }
      });
      return data[0];
    },

    async updateSurveyStatus(id, status) {
      await sbFetch(`/rest/v1/surveys?id=eq.${encodeURIComponent(id)}`, {
        method: "PATCH", auth: true, body: { status }, headers: { Prefer: "return=minimal" }
      });
    }
  };

  // ---------- デモモード実装 ----------
  const DEMO_KEY = "koe_demo_responses";
  const DEMO_SURVEY_KEY = "koe_demo_surveys";

  function demoResponses() { return JSON.parse(localStorage.getItem(DEMO_KEY) || "[]"); }
  function saveDemoResponses(arr) { localStorage.setItem(DEMO_KEY, JSON.stringify(arr)); }
  function demoLocalSurveys() { return JSON.parse(localStorage.getItem(DEMO_SURVEY_KEY) || "[]"); }

  async function demoFileSurveys() {
    try {
      const manifest = await (await fetch("surveys/index.json")).json();
      const out = [];
      for (const slug of manifest.surveys) {
        try { out.push(await (await fetch(`surveys/${slug}.json`)).json()); } catch (e) { /* skip */ }
      }
      return out;
    } catch (e) { return []; }
  }

  const demoApi = {
    isDemo: true,

    async getSurvey(slug) {
      const all = [...(await demoFileSurveys()), ...demoLocalSurveys()];
      const s = all.find(x => x.slug === slug && x.status === "open");
      return s ? { id: s.id, slug: s.slug, title: s.title, definition: s.definition } : null;
    },

    async submitResponse({ survey_id, channel, answers }) {
      const arr = demoResponses();
      arr.push({ survey_id, channel: channel || null, answers, answered_on: localDateJST() });
      saveDemoResponses(arr);
    },

    async login() { sessionStorage.setItem("koe_token", "demo"); },
    logout() { sessionStorage.removeItem("koe_token"); },
    isLoggedIn() { return true; },  // デモは常にログイン扱い

    async listSurveys() { return [...(await demoFileSurveys()), ...demoLocalSurveys()]; },

    async getResponses(surveyId) {
      return demoResponses().filter(r => r.survey_id === surveyId)
        .sort((a, b) => b.answered_on.localeCompare(a.answered_on));
    },

    async createSurvey(row) {
      const s = { ...row, id: "local-" + Date.now(), created_at: new Date().toISOString() };
      const arr = demoLocalSurveys(); arr.push(s);
      localStorage.setItem(DEMO_SURVEY_KEY, JSON.stringify(arr));
      return s;
    },

    async updateSurveyStatus(id, status) {
      const arr = demoLocalSurveys();
      const s = arr.find(x => x.id === id);
      if (s) { s.status = status; localStorage.setItem(DEMO_SURVEY_KEY, JSON.stringify(arr)); }
    },

    // デモ専用：ダッシュボード確認用のダミー回答を生成
    async seedDemo(survey, n = 30) {
      const arr = demoResponses();
      const qs = survey.definition.questions;
      for (let i = 0; i < n; i++) {
        const answers = {};
        for (const q of qs) {
          if (q.type === "nps") answers[q.id] = Math.min(10, Math.max(0, Math.round(7 + (Math.random() * 6 - 3))));
          else if (q.type === "likert5") answers[q.id] = Math.min(5, Math.max(1, Math.round(3.6 + (Math.random() * 3 - 1.5))));
          else if (q.type === "choice") answers[q.id] = q.options[Math.floor(Math.random() * q.options.length)];
          else if (q.type === "text" && Math.random() < 0.3) answers[q.id] = "（ダミー自由記述 " + (i + 1) + "）スタッフの方が丁寧でした。";
        }
        const ch = (survey.definition.channels || [null])[Math.floor(Math.random() * (survey.definition.channels || [null]).length)];
        const d = new Date(); d.setDate(d.getDate() - Math.floor(Math.random() * 120));
        arr.push({
          survey_id: survey.id, channel: ch, answers,
          answered_on: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
        });
      }
      saveDemoResponses(arr);
    }
  };

  window.api = isDemo ? demoApi : sbApi;
})();
