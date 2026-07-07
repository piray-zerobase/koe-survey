// SVGチャート描画（依存ライブラリなし）
// 配色は検証済みパレット: 単一シリーズ=青 #2a78d6 / NPS極性=青(推奨)・灰(中立)・赤(批判)
(function () {
  const C = {
    accent: "#2a78d6", grid: "#e1e0d9", baseline: "#c3c2b7",
    ink2: "#52514e", muted: "#898781",
    promoter: "#2a78d6", passive: "#f0efec", detractor: "#e34948"
  };

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // 横棒グラフ（設問別平均・ERG軸別平均など）
  // items: [{label, value, note}], max: 目盛り上限
  function hbar(items, max, { width = 560, valueFmt = v => v.toFixed(2) } = {}) {
    const rowH = 30, labelW = 230, pad = 8;
    const h = items.length * rowH + 24;
    const plotW = width - labelW - 60;
    let s = `<svg viewBox="0 0 ${width} ${h}" width="100%" role="img">`;
    // 目盛り線（控えめ）
    for (let g = 1; g <= max; g++) {
      const x = labelW + (g / max) * plotW;
      s += `<line x1="${x}" y1="4" x2="${x}" y2="${h - 20}" stroke="${C.grid}" stroke-width="1"/>`;
      s += `<text x="${x}" y="${h - 6}" font-size="10" fill="${C.muted}" text-anchor="middle">${g}</text>`;
    }
    items.forEach((it, i) => {
      const y = i * rowH + pad;
      const barW = Math.max(2, (it.value / max) * plotW);
      s += `<text x="${labelW - 8}" y="${y + 13}" font-size="11" fill="${C.ink2}" text-anchor="end">${esc(truncate(it.label, 18))}</text>`;
      s += `<rect x="${labelW}" y="${y}" width="${barW}" height="16" rx="4" fill="${C.accent}">` +
           `<title>${esc(it.label)}: ${valueFmt(it.value)}${it.note ? " — " + esc(it.note) : ""}</title></rect>`;
      s += `<text x="${labelW + barW + 6}" y="${y + 13}" font-size="11" fill="${C.ink2}">${valueFmt(it.value)}</text>`;
    });
    s += `<line x1="${labelW}" y1="4" x2="${labelW}" y2="${h - 20}" stroke="${C.baseline}" stroke-width="1"/>`;
    return s + "</svg>";
  }

  // 折れ線（月次推移）。points: [{label, value, n}]
  function line(points, { width = 560, height = 180, yMin = null, yMax = null, valueFmt = v => String(Math.round(v)) } = {}) {
    if (points.length === 0) return `<p class="note">データがまだありません</p>`;
    const padL = 40, padR = 16, padT = 14, padB = 28;
    const vals = points.map(p => p.value);
    let lo = yMin !== null ? yMin : Math.min(...vals), hi = yMax !== null ? yMax : Math.max(...vals);
    if (lo === hi) { lo -= 1; hi += 1; }
    const plotW = width - padL - padR, plotH = height - padT - padB;
    const x = i => padL + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
    const y = v => padT + (1 - (v - lo) / (hi - lo)) * plotH;
    let s = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">`;
    // 水平グリッド3本
    for (let g = 0; g <= 2; g++) {
      const gv = lo + ((hi - lo) * g) / 2, gy = y(gv);
      s += `<line x1="${padL}" y1="${gy}" x2="${width - padR}" y2="${gy}" stroke="${C.grid}" stroke-width="1"/>`;
      s += `<text x="${padL - 6}" y="${gy + 4}" font-size="10" fill="${C.muted}" text-anchor="end">${valueFmt(gv)}</text>`;
    }
    const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    s += `<path d="${path}" fill="none" stroke="${C.accent}" stroke-width="2" stroke-linejoin="round"/>`;
    points.forEach((p, i) => {
      s += `<circle cx="${x(i)}" cy="${y(p.value)}" r="4" fill="${C.accent}" stroke="#fcfcfb" stroke-width="2">` +
           `<title>${esc(p.label)}: ${valueFmt(p.value)}${p.n ? `（n=${p.n}）` : ""}</title></circle>`;
      // ラベルは最初と最後だけ（間引き）
      if (i === 0 || i === points.length - 1) {
        s += `<text x="${x(i)}" y="${y(p.value) - 10}" font-size="11" fill="${C.ink2}" text-anchor="middle">${valueFmt(p.value)}</text>`;
      }
      s += `<text x="${x(i)}" y="${height - 8}" font-size="10" fill="${C.muted}" text-anchor="middle">${esc(p.label)}</text>`;
    });
    return s + "</svg>";
  }

  // NPS分布（0〜10の縦棒・極性で塗り分け）counts: 長さ11の配列
  function npsDist(counts, { width = 560, height = 170 } = {}) {
    const total = counts.reduce((a, b) => a + b, 0);
    const padL = 12, padB = 26, padT = 16;
    const plotH = height - padT - padB;
    const bw = (width - padL * 2) / 11;
    const maxC = Math.max(1, ...counts);
    let s = `<svg viewBox="0 0 ${width} ${height}" width="100%" role="img">`;
    counts.forEach((c, score) => {
      const barH = (c / maxC) * plotH;
      const xx = padL + score * bw + 3, yy = padT + plotH - barH;
      const fill = score <= 6 ? C.detractor : score <= 8 ? C.passive : C.promoter;
      const stroke = score >= 7 && score <= 8 ? ` stroke="${C.baseline}" stroke-width="1"` : "";
      s += `<rect x="${xx}" y="${yy}" width="${bw - 6}" height="${Math.max(barH, c > 0 ? 3 : 0)}" rx="4" fill="${fill}"${stroke}>` +
           `<title>${score}点: ${c}件${total ? `（${Math.round((c / total) * 100)}%）` : ""}</title></rect>`;
      if (c > 0) s += `<text x="${xx + (bw - 6) / 2}" y="${yy - 4}" font-size="10" fill="${C.ink2}" text-anchor="middle">${c}</text>`;
      s += `<text x="${xx + (bw - 6) / 2}" y="${height - 8}" font-size="10" fill="${C.muted}" text-anchor="middle">${score}</text>`;
    });
    s += `<line x1="${padL}" y1="${padT + plotH}" x2="${width - padL}" y2="${padT + plotH}" stroke="${C.baseline}" stroke-width="1"/>`;
    return s + "</svg>";
  }

  function truncate(s, n) { return s.length > n ? s.slice(0, n) + "…" : s; }

  window.charts = { hbar, line, npsDist, colors: C, esc };
})();
