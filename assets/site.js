// Page behaviour: hero decode, market backdrop, scroll effects, count-ups, certificate showcase, nav highlight.
(() => {
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const GLYPHS = "0123456789$%+−.σμλΣΔβ∑≈";
  const rnd = (s) => s[Math.floor(Math.random() * s.length)];

  /* ---------- text decode: characters cycle through market glyphs, then lock in left to right ---------- */
  function decode(el, { text = el.dataset.text || el.textContent, delay = 0, stagger = 45, spin = 380, onDone } = {}) {
    if (still) { el.textContent = text; onDone?.(); return; }
    const chars = [...text];
    el.textContent = "";
    const spans = chars.map((c) => {
      const s = document.createElement("span");
      s.className = "ch"; s.textContent = c === " " ? " " : rnd(GLYPHS);
      if (c !== " ") s.classList.add("sc");
      el.appendChild(s);
      return s;
    });
    const t0 = performance.now() + delay;
    let last = 0;
    const tick = (now) => {
      let done = 0;
      const reroll = now - last > 55;
      if (reroll) last = now;
      chars.forEach((c, i) => {
        const s = spans[i];
        if (c === " ") { done++; return; }
        if (now >= t0 + i * stagger + spin) {
          if (s.classList.contains("sc")) { s.textContent = c; s.classList.remove("sc"); }
          done++;
        } else if (now >= t0 && reroll) s.textContent = rnd(GLYPHS);
      });
      if (done < chars.length) requestAnimationFrame(tick);
      else { el.textContent = text; onDone?.(); }
    };
    requestAnimationFrame(tick);
  }

  /* ---------- hero ---------- */
  const [first, last] = document.querySelectorAll(".hero-name .decode");
  if (first) {
    // Lock each word to its real width so the scrambled glyphs can't push the line around.
    const lock = (el) => { el.style.width = el.getBoundingClientRect().width + "px"; };
    const unlock = (el) => () => { el.style.width = ""; };
    const start = () => {
      lock(first); lock(last);
      decode(first, { delay: 100, stagger: 55, onDone: unlock(first) });
      decode(last, { delay: 330, stagger: 55, onDone: unlock(last) });
    };
    (document.fonts?.ready || Promise.resolve()).then(start);
  }
  const role = document.querySelector(".hero .decode-line");
  if (role) decode(role, { delay: 900, stagger: 12, spin: 260 });

  // under the name: quarterly candles built from my own FTSE minimum-variance portfolio
  const cs = document.getElementById("candles");
  if (cs && window.FTSE_GROWTH) {
    const NS = "http://www.w3.org/2000/svg";
    const mk = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; };
    const series = window.FTSE_GROWTH.map((d) => d.MinVariance);
    const q = [];
    for (let i = 1; i < series.length; i += 3) {
      const chunk = series.slice(i, i + 3), open = series[i - 1], close = chunk[chunk.length - 1];
      q.push({ open, close, high: Math.max(open, ...chunk), low: Math.min(open, ...chunk) });
    }
    const W = 960, H = 96, pad = 4;
    const lo = Math.min(...q.map((c) => c.low)), hi = Math.max(...q.map((c) => c.high));
    const y = (v) => pad + (H - 2 * pad) * (1 - (v - lo) / (hi - lo));
    const step = W / q.length, bw = Math.max(3, step * 0.56);
    // 4-quarter moving average of the close
    const ma = q.map((c, i) => { const w = q.slice(Math.max(0, i - 3), i + 1); return w.reduce((s, x) => s + x.close, 0) / w.length; });
    const defs = mk("defs", {}, cs), grad = mk("linearGradient", { id: "ma-fill", x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    mk("stop", { offset: "0", "stop-color": "#e8b04a", "stop-opacity": ".22" }, grad);
    mk("stop", { offset: "1", "stop-color": "#e8b04a", "stop-opacity": "0" }, grad);
    const area = mk("path", { class: "ma-area", d: "", fill: "url(#ma-fill)" }, cs);
    const maPath = mk("path", { class: "ma", d: "" }, cs);
    const groups = q.map((c, i) => {
      const x = i * step + step / 2, up = c.close >= c.open;
      const g = mk("g", { class: up ? "up" : "dn" }, cs);
      mk("line", { x1: x, x2: x, y1: y(c.high), y2: y(c.low) }, g);
      const top = y(Math.max(c.open, c.close)), h = Math.max(1.5, Math.abs(y(c.open) - y(c.close)));
      mk("rect", { x: x - bw / 2, y: top, width: bw, height: h, rx: 1 }, g);
      g.style.transformOrigin = `${x}px ${y((c.open + c.close) / 2)}px`;
      return g;
    });
    cs.insertBefore(maPath, null);
    const lastG = groups[groups.length - 1];
    const drawMA = (k) => {
      const pts = ma.slice(0, k).map((v, i) => [(i * step + step / 2).toFixed(1), y(v).toFixed(1)]);
      const line = pts.map((p, i) => `${i ? "L" : "M"}${p[0]},${p[1]}`).join("");
      maPath.setAttribute("d", line);
      if (pts.length > 1) area.setAttribute("d", `${line}L${pts[pts.length - 1][0]},${H}L${pts[0][0]},${H}Z`);
    };
    // match the chart's width to the name above it
    const fit = () => {
      const fig = cs.parentElement, words = [...document.querySelectorAll(".hero-name .decode, .hero-name .dot")];
      if (!words.length) return;
      const left = fig.getBoundingClientRect().left, right = Math.max(...words.map((w) => w.getBoundingClientRect().right));
      cs.style.width = Math.min(right - left, fig.clientWidth) + "px";
    };
    (document.fonts?.ready || Promise.resolve()).then(fit); addEventListener("resize", fit);
    if (still) { groups.forEach((g) => g.classList.add("on")); drawMA(ma.length); lastG.classList.add("last"); }
    else {
      const t0 = performance.now() + 650, per = 32;
      const tick = (now) => {
        const k = Math.min(q.length, Math.max(0, Math.floor((now - t0) / per) + 1));
        for (let i = 0; i < k; i++) groups[i].classList.add("on");
        drawMA(k);
        if (k < q.length) requestAnimationFrame(tick); else lastG.classList.add("last");
      };
      requestAnimationFrame(tick);
    }
  }

  /* ---------- status bar: live Glasgow time and whether the LSE is trading ---------- */
  const clock = document.getElementById("clock"), lse = document.getElementById("lse");
  if (clock && lse) {
    const state = lse.querySelector(".sb-state");
    const tick = () => {
      const now = new Date();
      const uk = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
      clock.textContent = uk.format(now);
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false })
        .formatToParts(now).reduce((o, p) => ((o[p.type] = p.value), o), {});
      const mins = +parts.hour * 60 + +parts.minute;
      const weekday = !["Sat", "Sun"].includes(parts.weekday);
      const open = weekday && mins >= 480 && mins < 990;          // 08:00–16:30 London
      lse.classList.toggle("open", open);
      lse.classList.toggle("shut", !open);
      state.textContent = open ? "open" : "closed";
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ---------- backdrop: faint random-walk price paths drifting left ---------- */
  const cv = document.getElementById("market");
  if (cv) {
    const ctx = cv.getContext("2d");
    const STEP = 7, SPEED = 14; // px between points, px per second
    let W = 0, H = 0, paths = [], offset = 0, lastT = 0, raf = 0;
    const mk = (band, color, width) => {
      const pts = [];
      let y = band;
      for (let x = -STEP; x <= W + STEP * 2; x += STEP) { y = walk(y, band); pts.push(y); }
      return { band, color, width, pts };
    };
    const walk = (y, band) => {
      const pull = (band - y) * 0.02;
      return y + pull + (Math.random() - 0.5) * 9;
    };
    const setup = () => {
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paths = [
        mk(H * 0.22, "rgba(58,66,60,.9)", 1),
        mk(H * 0.40, "rgba(232,176,74,.16)", 1.2),
        mk(H * 0.55, "rgba(58,66,60,.8)", 1),
        mk(H * 0.72, "rgba(57,135,229,.14)", 1.2),
      ];
      offset = 0;
    };
    const render = () => {
      ctx.clearRect(0, 0, W, H);
      for (const p of paths) {
        ctx.beginPath();
        p.pts.forEach((y, i) => { const x = i * STEP - STEP - offset; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.strokeStyle = p.color; ctx.lineWidth = p.width; ctx.stroke();
      }
    };
    const loop = (t) => {
      raf = requestAnimationFrame(loop);
      if (t - lastT < 33) return;           // ~30fps is plenty for something this slow
      const dt = lastT ? (t - lastT) / 1000 : 0; lastT = t;
      offset += SPEED * dt;
      while (offset >= STEP) {
        offset -= STEP;
        for (const p of paths) { p.pts.shift(); p.pts.push(walk(p.pts[p.pts.length - 1], p.band)); }
      }
      render();
    };
    setup(); render();
    let rt;
    addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { setup(); render(); }, 150); });
    if (!still) {
      raf = requestAnimationFrame(loop);
      document.addEventListener("visibilitychange", () => {
        cancelAnimationFrame(raf); lastT = 0;
        if (!document.hidden) raf = requestAnimationFrame(loop);
      });
    }
  }

  /* ---------- count-up numbers (hero) ---------- */
  document.querySelectorAll(".count[data-to]").forEach((el) => {
    if (still) return;
    const to = +el.dataset.to, pre = el.dataset.prefix || "", suf = el.dataset.suffix || "";
    const final = el.textContent, t0 = performance.now() + 1900, dur = 1100;
    const tick = (now) => {
      const p = Math.min(1, Math.max(0, (now - t0) / dur));
      el.textContent = pre + Math.round(to * (1 - (1 - p) ** 3)) + suf;
      if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
    };
    el.textContent = pre + "0" + suf;
    requestAnimationFrame(tick);
  });

  /* ---------- scroll entrances: one distinct, restrained effect per section ---------- */
  const ANIMS = [
    [".label", "line"],
    [".principles", "stagger"],
    [".project", "scan"],
    ["#experience .timeline", "timeline"],
    [".beyond", "pop"],
    [".showcase", "fade"],
    [".rail", "slide"],
    [".portrait-card", "focus"],
  ];
  if (!still && "IntersectionObserver" in window) {
    document.documentElement.classList.add("motion");
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      e.target.classList.add("in");
      if (e.target.dataset.anim === "scan")
        e.target.addEventListener("animationend", () => e.target.classList.add("done"), { once: true });
    }), { rootMargin: "0px 0px -12% 0px" });
    ANIMS.forEach(([sel, kind]) => document.querySelectorAll(sel).forEach((el) => {
      el.dataset.anim = kind;
      [...el.children].forEach((c, k) => c.style.setProperty("--k", k));
      io.observe(el);
    }));

    // education grades count up from zero
    const gradeIO = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      gradeIO.unobserve(e.target);
      const el = e.target, final = el.textContent, m = final.match(/^(\d+)(.*)$/);
      if (!m) return;
      const to = +m[1], suf = m[2], t0 = performance.now() + 150, dur = 900;
      const tick = (now) => {
        const p = Math.min(1, Math.max(0, (now - t0) / dur));
        el.textContent = Math.round(to * (1 - (1 - p) ** 3)) + suf;
        if (p < 1) requestAnimationFrame(tick); else el.textContent = final;
      };
      el.textContent = "0" + suf;
      requestAnimationFrame(tick);
    }), { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(".grades b").forEach((b) => gradeIO.observe(b));
  }

  /* ---------- smooth scrolling for in-page links (See the work, header nav) ---------- */
  const header = document.querySelector(".bar");
  let scrollRaf = 0;
  const glide = (targetY) => {
    cancelAnimationFrame(scrollRaf);
    const startY = scrollY, dist = targetY - startY;
    if (still || Math.abs(dist) < 2) { scrollTo(0, targetY); return; }
    const dur = Math.min(1400, 500 + Math.abs(dist) * 0.25), t0 = performance.now();
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2);
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      scrollTo(0, startY + dist * ease(p));
      if (p < 1) scrollRaf = requestAnimationFrame(tick);
    };
    scrollRaf = requestAnimationFrame(tick);
    // a wheel or touch from the user takes over straight away
    const stop = () => { cancelAnimationFrame(scrollRaf); removeEventListener("wheel", stop); removeEventListener("touchstart", stop); };
    addEventListener("wheel", stop, { passive: true, once: true });
    addEventListener("touchstart", stop, { passive: true, once: true });
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    const id = a.getAttribute("href").slice(1);
    const target = id ? document.getElementById(id) : document.documentElement;
    if (!target) return;
    e.preventDefault();
    const y = id ? target.getBoundingClientRect().top + scrollY - (header?.offsetHeight || 0) - 12 : 0;
    glide(Math.max(0, y));
    history.pushState(null, "", id ? "#" + id : location.pathname);
    if (id === "main") target.focus({ preventScroll: true });
  });

  /* ---------- certificate showcase + rail ---------- */
  const certCards = [...document.querySelectorAll(".rail .card-btn")];
  const figs = [...document.querySelectorAll(".viewer .cert")];
  const detail = document.querySelector(".detail");
  const pad = (n) => String(n).padStart(2, "0");
  let current = 0, swapTimer;

  const fill = (c) => {
    document.getElementById("cert-issuer").textContent = c.dataset.issuer;
    document.getElementById("cert-title").textContent = c.dataset.title;
    document.getElementById("cert-desc").textContent = c.dataset.desc;
    document.getElementById("cert-date").textContent = c.dataset.date;
  };

  const select = (i, { scroll = false } = {}) => {
    i = (i + certCards.length) % certCards.length;
    if (i === current && detail.dataset.ready) return;
    current = i;
    const c = certCards[i];
    certCards.forEach((x) => (x === c ? x.setAttribute("aria-current", "true") : x.removeAttribute("aria-current")));
    figs.forEach((f) => f.classList.toggle("is-on", f.dataset.cert === c.dataset.show));
    document.getElementById("cert-n").textContent = pad(i + 1);

    clearTimeout(swapTimer);
    if (still || !detail.dataset.ready) fill(c);
    else { detail.classList.add("swap"); swapTimer = setTimeout(() => { fill(c); detail.classList.remove("swap"); }, 180); }
    detail.dataset.ready = "1";

    if (scroll) c.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  };

  if (certCards.length) {
    document.getElementById("cert-total").textContent = pad(certCards.length);
    select(0);
    certCards.forEach((c, i) => {
      c.addEventListener("pointerenter", (e) => { if (e.pointerType === "mouse") select(i); });
      c.addEventListener("focus", () => select(i));
      c.addEventListener("click", () => {
        select(i);
        // On a single-column layout the certificate sits above the rail, so bring it into view.
        if (matchMedia("(max-width: 900px)").matches)
          document.querySelector(".viewer")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "center" });
      });
      c.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = (i + (e.key === "ArrowRight" ? 1 : -1) + certCards.length) % certCards.length;
        certCards[next].focus({ preventScroll: true });
        certCards[next].scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest", inline: "nearest" });
      });
    });
    document.querySelectorAll(".arrow[data-step]").forEach((b) =>
      b.addEventListener("click", () => select(current + +b.dataset.step, { scroll: true })));
  }

  /* ---------- "01 work" dropdown: a small terminal that types out the projects ---------- */
  const workLink = [...document.querySelectorAll(".bar nav a")].find((a) => /#work$/.test(a.getAttribute("href")));
  const bar = document.querySelector(".bar");
  const canHover = matchMedia("(hover: hover) and (pointer: fine)");
  if (workLink && bar) {
    const PROJECTS = [
      { perm: "drwxr-xr-x", slug: "robust-portfolio", name: "robust-portfolio/", desc: "Python · Phase 1 done" },
      { perm: "drwxr-xr-x", slug: "ftse-portfolio", name: "ftse-portfolio/", desc: "R + SQL · in progress", now: true },
      { perm: "-rw-r--r--", slug: "nike-stock-pitch", name: "nike-stock-pitch.pdf", desc: "★ best pitch in cohort" },
      { perm: "-rw-r--r--", slug: "disney-ma", name: "disney-ma.xlsx", desc: "★ 1st of 66" },
    ];
    const here = location.pathname.replace(/\/$/, "").split("/").pop();
    const dd = document.createElement("div");
    dd.className = "work-dd";
    dd.id = "work-dd";
    dd.hidden = true;
    dd.innerHTML = `
      <div class="dd-bar" aria-hidden="true"><i></i><i></i><i></i><span>zsh — ~/work</span></div>
      <div class="dd-body">
        <p class="dd-cmd" aria-hidden="true"><span class="p">$ </span><span class="t"></span></p>
        <p class="dd-total" aria-hidden="true"></p>
        <ul>${PROJECTS.map((p) => `
          <li><a href="/${p.slug}/" class="dd-row${p.slug === here ? " here" : ""}${p.now ? " now" : ""}" aria-label="${p.name.replace(/[/.].*$/, "").replace(/-/g, " ")}: ${p.desc.replace("★ ", "")}">
            <span class="perm" aria-hidden="true"></span><span class="name" aria-hidden="true"></span><span class="desc" aria-hidden="true"></span>
          </a></li>`).join("")}
        </ul>
        <p class="dd-foot" aria-hidden="true"><span class="p">$ </span><span class="cur"></span></p>
      </div>`;
    bar.appendChild(dd);
    workLink.setAttribute("aria-haspopup", "true");
    workLink.setAttribute("aria-expanded", "false");
    workLink.setAttribute("aria-controls", "work-dd");

    const rows = [...dd.querySelectorAll(".dd-row")];
    const cmd = dd.querySelector(".dd-cmd .t"), total = dd.querySelector(".dd-total");
    let typing = 0, closeTimer = 0;

    const fillAll = () => {
      typing++;
      cmd.textContent = "ls -l ~/work"; total.textContent = `total ${PROJECTS.length}`;
      rows.forEach((r, i) => {
        r.querySelector(".perm").textContent = PROJECTS[i].perm;
        r.querySelector(".name").textContent = PROJECTS[i].name;
        r.querySelector(".desc").textContent = PROJECTS[i].desc;
        r.classList.add("shown");
      });
    };

    // types each field in turn; opening again cancels the previous run
    const typeOut = async () => {
      const run = ++typing;
      const alive = () => run === typing && !dd.hidden;
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const type = async (el, text, speed) => {
        for (let i = 1; i <= text.length; i++) { if (!alive()) return false; el.textContent = text.slice(0, i); await wait(speed); }
        return true;
      };
      cmd.textContent = ""; total.textContent = "";
      rows.forEach((r) => { r.classList.remove("shown"); r.querySelectorAll("span").forEach((s) => (s.textContent = "")); });
      if (!(await type(cmd, "ls -l ~/work", 22))) return;
      await wait(90);
      if (!alive()) return;
      total.textContent = `total ${PROJECTS.length}`;
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i], p = PROJECTS[i];
        r.classList.add("shown");
        r.querySelector(".perm").textContent = p.perm;
        if (!(await type(r.querySelector(".name"), p.name, 9))) return;
        if (!(await type(r.querySelector(".desc"), p.desc, 6))) return;
      }
    };

    const place = () => {
      const b = bar.getBoundingClientRect(), a = workLink.getBoundingClientRect();
      const w = dd.offsetWidth || 560;
      dd.style.left = Math.max(12, Math.min(a.left - b.left - 18, b.width - w - 12)) + "px";
    };
    const open = () => {
      if (!canHover.matches || innerWidth <= 760) return;
      clearTimeout(closeTimer);
      if (!dd.hidden) return;
      dd.hidden = false; place();
      requestAnimationFrame(() => dd.classList.add("open"));
      workLink.setAttribute("aria-expanded", "true");
      if (still) fillAll(); else typeOut();
    };
    const close = (now) => {
      clearTimeout(closeTimer);
      const shut = () => {
        dd.classList.remove("open"); workLink.setAttribute("aria-expanded", "false"); typing++;
        setTimeout(() => { if (!dd.classList.contains("open")) dd.hidden = true; }, 160);
      };
      now ? shut() : (closeTimer = setTimeout(shut, 220));
    };

    [workLink, dd].forEach((el) => {
      el.addEventListener("mouseenter", open);
      el.addEventListener("mouseleave", () => close());
    });
    workLink.addEventListener("focus", open);
    workLink.addEventListener("blur", (e) => { if (!dd.contains(e.relatedTarget)) close(); });
    dd.addEventListener("focusout", (e) => { if (!dd.contains(e.relatedTarget) && e.relatedTarget !== workLink) close(true); });
    workLink.addEventListener("keydown", (e) => { if (e.key === "ArrowDown" && !dd.hidden) { e.preventDefault(); fillAll(); rows[0].focus(); } });
    dd.addEventListener("keydown", (e) => {
      const i = rows.indexOf(document.activeElement);
      if (e.key === "Escape") { close(true); workLink.focus(); }
      else if (e.key === "ArrowDown" && i > -1) { e.preventDefault(); rows[(i + 1) % rows.length].focus(); }
      else if (e.key === "ArrowUp" && i > -1) { e.preventDefault(); i === 0 ? workLink.focus() : rows[i - 1].focus(); }
    });
    addEventListener("resize", () => { if (!dd.hidden) place(); });
    addEventListener("scroll", () => { if (!dd.hidden && !dd.matches(":hover") && !dd.contains(document.activeElement)) close(true); }, { passive: true });
  }

  /* ---------- highlight the section currently in view ---------- */
  const links = [...document.querySelectorAll(".bar nav a")];
  const map = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const io = new IntersectionObserver((es) => {
    es.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((a) => a.removeAttribute("aria-current"));
      const a = map.get(e.target.id);
      if (!a) return;
      a.setAttribute("aria-current", "true");
      const nav = a.parentElement;
      if (nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: a.offsetLeft - 8, behavior: still ? "auto" : "smooth" });
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  map.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
})();
