// Small hand-rolled SVG charts. No libraries, so the site works from a folder.
(() => {
  const NS = "http://www.w3.org/2000/svg";
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();

  function el(tag, attrs = {}, parent) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  }

  function tipFor(host) {
    let t = host.querySelector(".tip");
    if (!t) { t = document.createElement("div"); t.className = "tip"; t.setAttribute("aria-hidden", "true"); host.appendChild(t); }
    return t;
  }

  function placeTip(tip, host, x, y) {
    const w = tip.offsetWidth, h = tip.offsetHeight, W = host.clientWidth;
    let left = x + 14;
    if (left + w > W) left = x - w - 14;
    if (left < 0) left = Math.max(0, Math.min(W - w, x - w / 2));
    tip.style.transform = `translate(${left}px, ${Math.max(0, y - h - 12)}px)`;
  }

  const niceTicks = (min, max, n = 5) => {
    const span = max - min, step0 = span / n;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) || mag * 10;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(+v.toFixed(10));
    return out;
  };

  /* ---- build-in animation: each chart draws itself the first time it scrolls into view ---- */
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let clipN = 0;

  function whenSeen(host) {
    if (host._io || still) { if (still) host._seen = true; return; }
    host._io = new IntersectionObserver((es) => {
      if (!es.some((e) => e.isIntersecting)) return;
      host._io.disconnect();
      host._seen = true;
      host._play?.();
    }, { rootMargin: "0px 0px -18% 0px" });
    host._io.observe(host);
  }

  // Sweeps a clip rect from left to right, calling onStep with the current edge x.
  function sweep(rect, x0, full, dur, onStep, onDone) {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      rect.setAttribute("width", full * e);
      onStep?.(x0 + full * e, e);
      if (p < 1) requestAnimationFrame(tick); else onDone?.();
    };
    requestAnimationFrame(tick);
  }

  // Render on first layout and whenever the container width changes.
  function responsive(host, draw) {
    let last = 0;
    const ro = new ResizeObserver(() => {
      const w = Math.round(host.clientWidth);
      if (w && w !== last) { last = w; draw(w); }
    });
    ro.observe(host);
  }

  /* ---------------- growth of £1 (FTSE project) ---------------- */
  function growthChart(host) {
    const data = window.FTSE_GROWTH;
    const series = [
      { key: "MinVariance", label: "Min variance", color: css("--s-2") },
      { key: "EqualWeight", label: "Equal weight", color: css("--s-1") },
      { key: "FTSE", label: "FTSE 100 index", color: css("--s-bench"), dash: "4 4" },
    ];
    const tip = tipFor(host);
    const fmtM = (m) => new Date(m + "-01").toLocaleDateString("en-GB", { month: "short", year: "numeric" });

    responsive(host, (W) => {
      host.querySelector("svg")?.remove();
      const H = Math.max(240, Math.min(360, W * 0.52));
      const m = { t: 12, r: W < 520 ? 12 : 64, b: 28, l: 44 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const all = data.flatMap((d) => series.map((s) => d[s.key]));
      const yMin = Math.min(0.6, Math.min(...all)), yMax = Math.max(...all) * 1.04;
      const x = (i) => m.l + (i / (data.length - 1)) * iw;
      const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;

      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Cumulative growth of £1 invested in January 2015. Minimum variance ends at £1.69, equal weight at £1.21, FTSE 100 index at £1.21." });
      host.prepend(svg);

      const g = el("g", { class: "grid" }, svg), ax = el("g", { class: "axis" }, svg);
      niceTicks(yMin, yMax, 5).forEach((v) => {
        el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g);
        el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, ax).textContent = "£" + v.toFixed(2);
      });
      const yearEvery = W < 520 ? 3 : 2;
      data.forEach((d, i) => {
        const [yr, mo] = d.m.split("-");
        if (mo === "01" && (+yr - 2015) % yearEvery === 0)
          el("text", { x: x(i), y: H - 6, "text-anchor": "middle" }, ax).textContent = yr;
      });
      el("line", { class: "ref", x1: m.l, x2: W - m.r, y1: y(1), y2: y(1), "stroke-dasharray": "2 4" }, svg);

      // COVID shock annotation
      const covid = data.findIndex((d) => d.m === "2020-03");
      if (covid > 0 && W > 440) {
        el("line", { x1: x(covid), x2: x(covid), y1: m.t, y2: m.t + ih, stroke: css("--line-2"), "stroke-width": 1 }, svg);
        el("text", { class: "ref-label", x: x(covid) + 6, y: m.t + 12 }, svg).textContent = "Mar 2020";
      }

      // lines sit inside a clip rect so they can be traced in from left to right
      const cid = `clip-g${++clipN}`;
      const clipRect = el("rect", { x: m.l - 4, y: 0, width: host._seen ? iw + 8 : 0, height: H }, el("clipPath", { id: cid }, el("defs", {}, svg)));
      const lines = el("g", { "clip-path": `url(#${cid})` }, svg);
      [...series].reverse().forEach((s) => {
        const d = data.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[s.key]).toFixed(1)}`).join("");
        el("path", { d, fill: "none", stroke: s.color, "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round", ...(s.dash ? { "stroke-dasharray": s.dash } : {}) }, lines);
      });

      // Direct label only where lines don't collide (min variance ends well clear of the other two).
      const labels = el("g", { opacity: host._seen ? 1 : 0, style: "transition: opacity .4s" }, svg);
      if (W >= 520) {
        const last = data[data.length - 1];
        el("text", { class: "note", x: W - m.r + 8, y: y(last.MinVariance) + 4 }, labels).textContent = "£" + last.MinVariance.toFixed(2);
        el("text", { class: "note", x: W - m.r + 8, y: y(last.FTSE) + 4 }, labels).textContent = "£" + last.FTSE.toFixed(2);
      }

      host._play = () => {
        // an amber scan line leads the trace, with a dot riding each series
        const scan = el("line", { y1: m.t, y2: m.t + ih, stroke: css("--accent"), "stroke-width": 1.5, opacity: 0.9 }, svg);
        const heads = series.map((s) => el("circle", { r: 3.5, fill: s.color }, svg));
        sweep(clipRect, m.l - 4, iw + 8, 1800, (edge) => {
          scan.setAttribute("x1", edge); scan.setAttribute("x2", edge);
          const i = Math.max(0, Math.min(data.length - 1, Math.round(((edge - m.l) / iw) * (data.length - 1))));
          series.forEach((s, k) => { heads[k].setAttribute("cx", x(i)); heads[k].setAttribute("cy", y(data[i][s.key])); });
        }, () => { scan.remove(); heads.forEach((h) => h.remove()); labels.setAttribute("opacity", 1); });
      };
      whenSeen(host);

      const xh = el("line", { class: "xhair", y1: m.t, y2: m.t + ih, opacity: 0 }, svg);
      const dots = series.map((s) => el("circle", { class: "dot", r: 4.5, fill: s.color, opacity: 0 }, svg));
      const hit = el("rect", { x: m.l, y: m.t, width: iw, height: ih, fill: "transparent" }, svg);

      const show = (evt) => {
        const r = svg.getBoundingClientRect();
        const px = ((evt.clientX - r.left) / r.width) * W;
        const i = Math.max(0, Math.min(data.length - 1, Math.round(((px - m.l) / iw) * (data.length - 1))));
        const d = data[i];
        xh.setAttribute("x1", x(i)); xh.setAttribute("x2", x(i)); xh.setAttribute("opacity", 1);
        series.forEach((s, k) => { dots[k].setAttribute("cx", x(i)); dots[k].setAttribute("cy", y(d[s.key])); dots[k].setAttribute("opacity", 1); });
        const rows = [...series].sort((a, b) => d[b.key] - d[a.key])
          .map((s) => `<div class="row"><span><i class="sw" style="background:${s.color}"></i>${s.label}</span><span>£${d[s.key].toFixed(2)}</span></div>`).join("");
        tip.innerHTML = `<div class="th">${fmtM(d.m)}</div>${rows}`;
        tip.classList.add("on");
        placeTip(tip, host, (x(i) / W) * r.width, (Math.min(...series.map((s) => y(d[s.key]))) / H) * r.height);
      };
      const hide = () => { tip.classList.remove("on"); xh.setAttribute("opacity", 0); dots.forEach((c) => c.setAttribute("opacity", 0)); };
      hit.addEventListener("pointermove", show);
      hit.addEventListener("pointerdown", show);
      hit.addEventListener("pointerleave", hide);
    });

    // table view
    const tb = document.querySelector("#growth-table tbody");
    if (tb) tb.innerHTML = data.filter((d, i) => d.m.endsWith("-12") || i === 0)
      .map((d) => `<tr><td>${d.m}</td><td>£${d.MinVariance.toFixed(2)}</td><td>£${d.EqualWeight.toFixed(2)}</td><td>£${d.FTSE.toFixed(2)}</td></tr>`).join("");
  }

  /* ---------------- risk-aversion sweep (portfolio engine) ---------------- */
  function sweepChart(host) {
    const data = [
      { l: 1, sharpe: 0.438, ret: 6.97, vol: 19.9, dd: -41.4 },
      { l: 3, sharpe: 0.483, ret: 7.44, vol: 18.4, dd: -31.7, head: true },
      { l: 10, sharpe: 0.673, ret: 8.87, vol: 14.1, dd: -29.5 },
      { l: 25, sharpe: 0.809, ret: 7.55, vol: 9.6, dd: -24.9 },
      { l: 50, sharpe: 0.856, ret: 5.79, vol: 6.9, dd: -21.1 },
      { l: 1000, sharpe: 0.723, ret: 3.76, vol: 5.3, dd: -19.8 },
    ];
    const ew = 0.643, c = css("--s-1"), acc = css("--accent");
    const tip = tipFor(host);

    responsive(host, (W) => {
      host.querySelector("svg")?.remove();
      const H = Math.max(230, Math.min(320, W * 0.55));
      const m = { t: 18, r: 18, b: 40, l: 42 };
      const iw = W - m.l - m.r, ih = H - m.t - m.b;
      const lx = (v) => Math.log10(v);
      const x = (v) => m.l + (lx(v) / lx(1000)) * iw;
      const yMin = 0.4, yMax = 0.9;
      const y = (v) => m.t + ih - ((v - yMin) / (yMax - yMin)) * ih;

      const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": "Sharpe ratio against risk aversion lambda on a log scale. Sharpe rises from 0.44 at lambda 1 to 0.86 at lambda 50, then falls to 0.72 at lambda 1000. The headline uses lambda 3, Sharpe 0.48." });
      host.prepend(svg);
      const g = el("g", { class: "grid" }, svg), ax = el("g", { class: "axis" }, svg);
      [0.4, 0.5, 0.6, 0.7, 0.8, 0.9].forEach((v) => {
        el("line", { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) }, g);
        el("text", { x: m.l - 8, y: y(v) + 4, "text-anchor": "end" }, ax).textContent = v.toFixed(1);
      });
      data.forEach((d) => el("text", { x: x(d.l), y: H - 20, "text-anchor": "middle" }, ax).textContent = d.l);
      el("text", { x: m.l + iw / 2, y: H - 3, "text-anchor": "middle" }, ax).textContent = "risk aversion λ (log scale)";

      el("line", { class: "ref", x1: m.l, x2: W - m.r, y1: y(ew), y2: y(ew) }, svg);
      el("text", { class: "ref-label", x: W - m.r, y: y(ew) + 15, "text-anchor": "end" }, svg).textContent = "equal weight 0.643";

      const cid = `clip-s${++clipN}`;
      const clipRect = el("rect", { x: m.l - 10, y: 0, width: host._seen ? iw + 20 : 0, height: H }, el("clipPath", { id: cid }, el("defs", {}, svg)));
      el("path", { d: data.map((d, i) => `${i ? "L" : "M"}${x(d.l)},${y(d.sharpe)}`).join(""), fill: "none", stroke: c, "stroke-width": 2, "stroke-linejoin": "round", "clip-path": `url(#${cid})` }, svg);

      const h = data.find((d) => d.head);
      const note = el("g", { opacity: host._seen ? 1 : 0, style: "transition: opacity .4s" }, svg);
      el("circle", { cx: x(h.l), cy: y(h.sharpe), r: 9, fill: "none", stroke: acc, "stroke-width": 1.5 }, note);
      el("text", { class: "note", x: x(h.l) + 14, y: y(h.sharpe) + 16 }, note).textContent = "λ=3 · fixed in advance";

      const dots = data.map((d) => el("circle", { class: "dot", cx: x(d.l), cy: y(d.sharpe), r: host._seen ? 4.5 : 0, fill: c }, svg));

      host._play = () => sweep(clipRect, m.l - 10, iw + 20, 1400, (edge) => {
        data.forEach((d, i) => { if (x(d.l) <= edge && dots[i].getAttribute("r") === "0") dots[i].setAttribute("r", 4.5); });
        if (edge >= x(h.l)) note.setAttribute("opacity", 1);
      });
      whenSeen(host);
      const hit = el("rect", { x: m.l - 10, y: m.t, width: iw + 20, height: ih, fill: "transparent" }, svg);

      const show = (evt) => {
        const r = svg.getBoundingClientRect();
        const px = ((evt.clientX - r.left) / r.width) * W;
        let k = 0; data.forEach((d, i) => { if (Math.abs(x(d.l) - px) < Math.abs(x(data[k].l) - px)) k = i; });
        const d = data[k];
        dots.forEach((n, i) => n.setAttribute("r", i === k ? 6.5 : 4.5));
        tip.innerHTML = `<div class="th">λ = ${d.l}${d.head ? " · headline" : ""}</div>
          <div class="row"><span>Sharpe</span><span>${d.sharpe.toFixed(3)}</span></div>
          <div class="row"><span>ann. return</span><span>${d.ret.toFixed(2)}%</span></div>
          <div class="row"><span>ann. vol</span><span>${d.vol.toFixed(1)}%</span></div>
          <div class="row"><span>max drawdown</span><span>${d.dd.toFixed(1)}%</span></div>`;
        tip.classList.add("on");
        placeTip(tip, host, (x(d.l) / W) * r.width, (y(d.sharpe) / H) * r.height);
      };
      hit.addEventListener("pointermove", show);
      hit.addEventListener("pointerdown", show);
      hit.addEventListener("pointerleave", () => { tip.classList.remove("on"); dots.forEach((n) => n.setAttribute("r", 4.5)); });
    });
  }

  /* ---------------- horizontal bars (HTML) ---------------- */
  function hbars(host, rows, { max, fmt, tipRows, color }) {
    const tip = tipFor(host.parentElement);
    host.innerHTML = rows.map((r, i) => `
      <li tabindex="0" data-i="${i}" class="${r.v === 0 ? "zero" : ""}" style="--c:${r.color || color}">
        <span class="lab">${r.label}</span>
        <span class="track"><span class="fill" style="width:${still ? (r.v / max) * 100 : 0}%;--i:${i}" data-w="${(r.v / max) * 100}"></span></span>
        <span class="val">${still ? fmt(r.v) : fmt(0)}</span>
      </li>`).join("");

    // bars grow out from zero, one after another, with their values counting up alongside
    host._play = () => {
      const lis = [...host.children];
      lis.forEach((li, i) => {
        const fill = li.querySelector(".fill"), val = li.querySelector(".val"), target = rows[i].v;
        fill.style.width = fill.dataset.w + "%";
        const t0 = performance.now() + i * 70, dur = 900;
        const tick = (now) => {
          const p = Math.min(1, Math.max(0, (now - t0) / dur));
          val.textContent = fmt(target * (1 - (1 - p) ** 3));
          if (p < 1) requestAnimationFrame(tick); else val.textContent = fmt(target);
        };
        requestAnimationFrame(tick);
      });
    };
    whenSeen(host);
    const show = (li) => {
      const r = rows[+li.dataset.i];
      tip.innerHTML = `<div class="th">${r.label}</div>` + tipRows(r).map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join("");
      tip.classList.add("on");
      const hb = host.parentElement.getBoundingClientRect(), lb = li.getBoundingClientRect();
      placeTip(tip, host.parentElement, lb.left - hb.left + lb.width * 0.55, lb.top - hb.top);
    };
    host.querySelectorAll("li").forEach((li) => {
      li.addEventListener("pointerenter", () => show(li));
      li.addEventListener("focus", () => show(li));
      li.addEventListener("pointerleave", () => tip.classList.remove("on"));
      li.addEventListener("blur", () => tip.classList.remove("on"));
    });
  }

  function init() {
    const g = document.getElementById("growth"); if (g) growthChart(g);
    const s = document.getElementById("sweep"); if (s) sweepChart(s);

    const conc = document.getElementById("concentration");
    if (conc) hbars(conc, [
      { label: "Markowitz", v: 1.62, sharpe: 0.483, top: "85.2%", note: "ignores estimation error" },
      { label: "+ Ledoit-Wolf", v: 1.62, sharpe: 0.483, top: "85.1%", note: "fixes the covariance" },
      { label: "+ Resampling", v: 5.40, sharpe: 0.636, top: "47.8%", note: "averages over uncertainty in μ" },
      { label: "Equal weight", v: 7.00, sharpe: 0.643, top: "14.3%", note: "benchmark", color: css("--s-bench") },
    ], {
      max: 7, color: css("--s-1"), fmt: (v) => v.toFixed(2),
      tipRows: (r) => [["assets held >1%", r.v.toFixed(2) + " of 7"], ["mean largest weight", r.top], ["Sharpe", r.sharpe.toFixed(3)], ["", r.note]],
    });

    const wts = document.getElementById("weights");
    if (wts) {
      const names = { ULVR: "Unilever", LSEG: "LSEG", HSBA: "HSBC", DGE: "Diageo", NG: "National Grid", AZN: "AstraZeneca", GSK: "GSK", RIO: "Rio Tinto", SHEL: "Shell", VOD: "Vodafone", BATS: "BAT", BP: "BP" };
      const rows = window.FTSE_WEIGHTS.map((d) => ({ label: names[d.s] || d.s, code: d.s, v: d.w < 1e-6 ? 0 : d.w }));
      hbars(wts, rows, {
        max: 0.25, color: css("--s-2"), fmt: (v) => (v * 100).toFixed(1) + "%",
        tipRows: (r) => [["ticker", r.code + ".L"], ["min variance", (r.v * 100).toFixed(1) + "%"], ["equal weight", "8.3%"]],
      });
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
