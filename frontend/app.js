/* OpenLoop frontend: vanilla JS, no build step.
   Every POST returns a full Bundle; the whole UI is re-rendered from it. */
(() => {
  'use strict';

  const CASE_ID = 'demo-1';
  const MOCK = new URLSearchParams(location.search).get('mock') === '1';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_MS = 86400000;

  const REQ_STATUS = {
    SATISFIED:    { cls: 'ok',      label: 'Satisfied' },
    OPEN_WAITING: { cls: 'wait',    label: 'Open · waiting' },
    CONTRADICTED: { cls: 'bad',     label: 'Contradicted' },
    NEEDS_REVIEW: { cls: 'review',  label: 'Needs review' },
    EXPIRED:      { cls: 'expired', label: 'Expired' },
  };
  const TIMER_STATUS = {
    PENDING:   { cls: 'wait',  label: 'Pending' },
    FIRED:     { cls: 'bad',   label: 'Fired' },
    CANCELLED: { cls: 'muted', label: 'Cancelled' },
  };
  const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

  const S = {
    bundle: null,
    prev: null,        // snapshot of the previous render, for "what is new"
    tab: 'triage',
    busy: false,
    verify: null,      // {ok, length, broken_at} until the next bundle arrives
    open: new Set(),   // keys of expanded collapsibles (survive re-renders)
    resetArmed: false,
    resetTimer: null,
  };

  const $ = (id) => document.getElementById(id);

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad2 = (n) => String(n).padStart(2, '0');
  const arr = (x) => (Array.isArray(x) ? x : []);

  // All dates are formatted in UTC by hand so the projector laptop's locale/timezone cannot change the demo.
  function parseDate(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function fmtFull(iso) { // 31 Oct 2026 09:00
    const d = parseDate(iso);
    if (!d) return iso ? String(iso) : '–';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  function fmtShort(iso) { // 31 Oct 09:00
    const d = parseDate(iso);
    if (!d) return iso ? String(iso) : '–';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  function fmtDate(iso) { // 31 Oct 2026
    const d = parseDate(iso);
    if (!d) return iso ? String(iso) : '–';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  function dayOf(iso, b) {
    const t = parseDate(iso), o = parseDate(b.case && b.case.opened_at);
    if (!t || !o) return null;
    return Math.floor((t.getTime() - o.getTime()) / DAY_MS);
  }
  function whenLabel(iso, b) { // Day 2 · 30 Oct 09:00
    const n = dayOf(iso, b);
    return (n === null ? '' : `Day ${n} · `) + fmtShort(iso);
  }
  function rel(due, now) {
    const a = parseDate(due), n = parseDate(now);
    if (!a || !n) return '';
    const h = Math.round((a - n) / 36e5);
    if (h === 0) return 'now';
    const abs = Math.abs(h);
    const txt = abs < 24 ? `${abs}h` : `${Math.round(abs / 24)}d`;
    return h > 0 ? `in ${txt}` : `${txt} ago`;
  }
  const shortHash = (h) => (h ? `${String(h).slice(0, 4)}…` : '–');
  const humanize = (s) => String(s ?? '').replace(/_/g, ' ');

  function typeClass(t) {
    t = String(t || '').toUpperCase();
    if (/DENY|DENIED|REJECT|BLOCK/.test(t)) return 't-deny';
    if (/EXCEPTION/.test(t)) return /RESOLV|CLOS/.test(t) ? 't-ok' : 't-exc';
    if (/RESOLV|SATISF/.test(t)) return 't-ok';
    if (/TIMER|CLOCK|TIME|ADVANCE/.test(t)) return 't-time';
    if (/DOCUMENT|EMAIL|INBOUND|RECEIVED/.test(t)) return 't-doc';
    if (/AGENT|TOOL|STEP|JUDGE/.test(t)) return 't-agent';
    if (/REQUIREMENT/.test(t)) return 't-req';
    return 't-sys';
  }

  function docLabel(b, id) {
    const d = arr(b.documents).find((x) => x.id === id);
    return (d && d.name) || id || 'Document';
  }

  /* ---------------- collapsibles that survive re-render ---------------- */
  function coll(key, head, body, extra = '') {
    const o = S.open.has(key);
    return `<div class="coll ${o ? 'open' : ''} ${extra}" data-key="${esc(key)}">` +
      `<button type="button" class="coll-head" data-toggle aria-expanded="${o}">${head}</button>` +
      `<div class="coll-body">${body}</div></div>`;
  }

  /* ---------------- network ---------------- */
  class ApiError extends Error {
    constructor(msg, status) { super(msg); this.status = status; }
  }
  async function api(method, path, body) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      throw new ApiError('Backend not reachable', 0);
    }
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { /* non-JSON body */ }
    if (!res.ok) {
      let detail = data && data.detail;
      if (detail && typeof detail !== 'string') detail = JSON.stringify(detail);
      throw new ApiError(detail || `HTTP ${res.status}`, res.status);
    }
    return data;
  }

  /* ---------------- toasts ---------------- */
  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), type === 'error' ? 7000 : 4000);
  }

  /* ---------------- diff against previous render ---------------- */
  const reqSig = (r) => `${r.status}|${r.updated_at}|${r.reason}`;
  const traceKey = (t) => `${t.seq}|${t.sim_time}|${t.tool}`;

  function snapshot(b) {
    return {
      sim: b.case && b.case.sim_now,
      hashes: new Set(arr(b.events).map((e) => e.hash)),
      reqSig: new Map(arr(b.requirements).map((r) => [r.id, reqSig(r)])),
      trace: new Set(arr(b.trace).map(traceKey)),
      openExc: new Set(arr(b.exceptions).filter((x) => x.status === 'OPEN').map((x) => x.id)),
    };
  }

  function diffOf(b) {
    const p = S.prev;
    const d = { first: !p, newHashes: new Set(), changedReq: new Set(), newTrace: new Set(), freshOpen: [], simChanged: false };
    if (!p) return d;
    const events = arr(b.events);
    // Tracked by hash, not seq: a reset restarts seq at 1.
    events.forEach((e) => { if (!p.hashes.has(e.hash)) d.newHashes.add(e.hash); });
    if (events.length && d.newHashes.size === events.length) d.newHashes.clear(); // full replacement (reset): no flash storm
    arr(b.requirements).forEach((r) => { if (p.reqSig.get(r.id) !== reqSig(r)) d.changedReq.add(r.id); });
    const tr = arr(b.trace);
    tr.forEach((t) => { if (!p.trace.has(traceKey(t))) d.newTrace.add(traceKey(t)); });
    if (tr.length && d.newTrace.size === tr.length) d.newTrace.clear();
    d.freshOpen = arr(b.exceptions).filter((x) => x.status === 'OPEN' && !p.openExc.has(x.id));
    d.simChanged = p.sim !== (b.case && b.case.sim_now);
    return d;
  }

  /* ---------------- rendering ---------------- */
  function safe(name, fn) {
    try { fn(); } catch (e) { console.error(`render ${name} failed`, e); }
  }

  function applyBundle(b) {
    if (!b || !b.case) throw new ApiError('Unexpected response from backend', 0);
    const d = diffOf(b);
    S.bundle = b;
    S.verify = null; // the chain may have changed

    if (d.freshOpen.length && S.tab !== 'triage') {
      S.tab = 'triage';
      toast(`New exception for review: ${d.freshOpen[0].title || d.freshOpen[0].id}`, 'info');
      requestAnimationFrame(() => {
        const t = $('tab-triage');
        t.classList.remove('ping'); void t.offsetWidth; t.classList.add('ping');
      });
    }

    safe('header', () => renderHeader(b, d));
    safe('inbound', () => renderInbound(b));
    safe('ledger', () => renderLedger(b, d));
    safe('requirements', () => renderRequirements(b, d));
    safe('timers', () => renderTimers(b));
    safe('documents', () => renderDocuments(b));
    safe('metrics', () => renderMetrics(b));
    safe('triage', () => renderTriage(b, d));
    safe('trace', () => renderTrace(b, d));
    safe('tabs', renderTabs);

    S.prev = snapshot(b);
    hideBoot();
  }

  function renderHeader(b, d) {
    const c = b.case || {};
    const cfg = b.config || {};
    $('case-title').textContent = c.title || '–';
    $('case-title').title = c.goal ? `Goal: ${c.goal}` : '';
    const st = $('case-status');
    st.textContent = c.status || '';
    st.className = `status-chip st-${String(c.status || '').toLowerCase()}`;
    $('clock-day').textContent = `Day ${c.day ?? '?'}`;
    $('clock-date').textContent = fmtFull(c.sim_now);
    if (d.simChanged && !d.first) pulseClock();

    const mk = (label, val, liveVal) => {
      const v = val || '?';
      return `<span class="badge ${v === liveVal ? 'live' : ''}">${esc(label)}: ${esc(v)}</span>`;
    };
    const thr = cfg.judge_threshold != null ? ` title="Judge threshold ${esc(cfg.judge_threshold)}"` : '';
    $('badges').innerHTML =
      mk('Agent', cfg.agent_mode, 'bedrock') +
      mk('Judge', cfg.judge_mode, 'featherless').replace('<span', `<span${thr}`);
    $('mock-flag').hidden = !MOCK;
    renderVerify();
  }

  function pulseClock() {
    const el = $('clock');
    el.classList.remove('pulse');
    void el.offsetWidth; // restart the animation
    el.classList.add('pulse');
  }

  function renderVerify() {
    const el = $('verify-result');
    const v = S.verify;
    if (!v) { el.textContent = ''; el.className = 'verify'; return; }
    if (v.ok) {
      el.textContent = `✓ chain intact (${v.length} events)`;
      el.className = 'verify ok';
    } else {
      el.textContent = `✗ broken at #${v.broken_at}`;
      el.className = 'verify bad';
    }
  }

  function renderInbound(b) {
    const items = arr(b.scenario);
    if (!items.length) { $('inbound').innerHTML = '<p class="empty">No scripted items.</p>'; return; }
    const nextId = (items.find((i) => !i.delivered) || {}).id;
    $('inbound').innerHTML = items.map((it) => {
      if (it.delivered) {
        return `<button type="button" class="inb done" disabled><span class="ico">✓</span><span>${esc(it.label)}</span></button>`;
      }
      return `<button type="button" class="inb act ${it.id === nextId ? 'next' : ''}" data-act="inbound" data-id="${esc(it.id)}">` +
        `<span class="ico">▸</span><span>${esc(it.label)}</span></button>`;
    }).join('');
  }

  function renderLedger(b, d) {
    const evs = arr(b.events).slice().sort((x, y) => (y.seq ?? 0) - (x.seq ?? 0));
    $('ledger-count').textContent = evs.length ? `${evs.length} events` : '';
    if (!evs.length) { $('ledger').innerHTML = '<p class="empty">No events yet.</p>'; return; }
    $('ledger').innerHTML = evs.map((e) => {
      const actor = e.actor && e.actor.id ? ` title="${esc(e.actor.type)}: ${esc(e.actor.id)}"` : '';
      return `<div class="led ${d.newHashes.has(e.hash) ? 'flash' : ''}"${actor}>` +
        `<div class="led-top"><span class="chip ${typeClass(e.type)}">${esc(humanize(e.type))}</span>` +
        `<span class="led-time">${esc(whenLabel(e.sim_time, b))}</span><span class="led-seq">#${esc(e.seq)}</span></div>` +
        `<div class="led-sum">${esc(e.summary)}</div>` +
        `<div class="led-hash"><b>${esc(shortHash(e.hash))}</b><span class="arrow">←</span>${esc(shortHash(e.prev_hash))}</div>` +
        `</div>`;
    }).join('');
  }

  function evidenceHtml(b, r) {
    const ev = arr(r.evidence);
    if (!ev.length) return '';
    return `<div class="ev-list">` + ev.map((x, i) => {
      const key = `ev:${r.id}:${i}`;
      const o = S.open.has(key);
      return `<button type="button" class="ev ${o ? 'open' : ''}" data-key="${esc(key)}" data-toggle aria-expanded="${o}">` +
        `<span class="ev-meta"><span class="ev-doc">${esc(docLabel(b, x.doc_id))}</span>` +
        (x.field ? `<span class="ev-field">${esc(x.field)}</span>` : '') +
        `<span class="ev-caret">▼</span></span>` +
        `<span class="ev-quote">“${esc(x.quote)}”</span></button>`;
    }).join('') + `</div>`;
  }

  function renderRequirements(b, d) {
    const reqs = arr(b.requirements);
    const counts = {};
    reqs.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
    $('req-legend').innerHTML = Object.keys(REQ_STATUS)
      .filter((k) => counts[k])
      .map((k) => `<span class="lg ${REQ_STATUS[k].cls}">${counts[k]} ${esc(REQ_STATUS[k].label.toLowerCase())}</span>`)
      .join('');
    if (!reqs.length) { $('requirements').innerHTML = '<p class="empty">No requirements.</p>'; return; }
    $('requirements').innerHTML = reqs.map((r) => {
      const s = REQ_STATUS[r.status] || { cls: 'muted', label: r.status || 'Unknown' };
      return `<article class="req s-${s.cls} ${d.changedReq.has(r.id) ? 'flash' : ''}">` +
        `<div class="req-head"><h3 class="req-title"><span class="req-id">${esc(r.id)}</span>${esc(r.title)}</h3>` +
        `<span class="pill ${s.cls}">${esc(s.label)}</span></div>` +
        (r.reason ? `<p class="req-reason">${esc(r.reason)}</p>` : '') +
        (arr(r.rule_ids).length ? `<div class="req-rules">${arr(r.rule_ids).map((id) => `<span class="chip rule">${esc(id)}</span>`).join('')}</div>` : '') +
        evidenceHtml(b, r) +
        (r.updated_at ? `<div class="req-foot">Updated ${esc(whenLabel(r.updated_at, b))}</div>` : '') +
        `</article>`;
    }).join('');
  }

  function renderTimers(b) {
    const ts = arr(b.timers).slice().sort((x, y) => String(x.due).localeCompare(String(y.due)));
    if (!ts.length) { $('timers').innerHTML = '<li class="empty">No timers.</li>'; return; }
    const now = b.case && b.case.sim_now;
    $('timers').innerHTML = ts.map((t) => {
      const s = TIMER_STATUS[t.status] || { cls: 'muted', label: t.status || '?' };
      const r = t.status === 'PENDING' ? rel(t.due, now) : '';
      return `<li class="timer ${esc(String(t.status).toLowerCase())}"><div class="li-main">` +
        `<div class="kind ${esc(t.kind)}">${esc(humanize(t.kind))}</div>` +
        `<div class="li-title">${esc(t.label)}</div>` +
        `<div class="li-sub">Due <b>${esc(fmtFull(t.due))}</b>${r ? ` · ${esc(r)}` : ''}</div></div>` +
        `<span class="pill ${s.cls}">${esc(s.label)}</span></li>`;
    }).join('');
  }

  function renderDocuments(b) {
    const ds = arr(b.documents);
    if (!ds.length) { $('documents').innerHTML = '<li class="empty">No documents yet.</li>'; return; }
    $('documents').innerHTML = ds.map((d) =>
      `<li><div class="li-main"><div class="li-title">${esc(d.name || d.id)}</div>` +
      `<div class="li-sub">Received <b>${esc(fmtDate(d.received_at))}</b>` +
      (d.issued_at ? ` · issued <b>${esc(fmtDate(d.issued_at))}</b>` : '') + `</div></div>` +
      `<span class="chip">${esc(humanize(d.type))}</span></li>`
    ).join('');
  }

  function renderMetrics(b) {
    const m = b.metrics || {};
    const tiles = [
      ['agent_steps', 'Agent steps', ''],
      ['tool_calls', 'Tool calls', ''],
      ['auto_resolved', 'Auto-resolved', 'good'],
      ['sent_to_human', 'Sent to human', ''],
      ['denied_actions', 'Denied actions', m.denied_actions > 0 ? 'warn' : ''],
    ];
    $('metrics').innerHTML = tiles.map(([k, label, cls]) =>
      `<div class="metric ${cls}"><div class="v">${esc(m[k] ?? 0)}</div><div class="k">${esc(label)}</div></div>`).join('');
  }

  function snippetsHtml(b, x) {
    const sn = arr(x.snippets);
    if (!sn.length) return '';
    return `<div class="snips">` + sn.map((s) =>
      `<figure class="snip"><figcaption>${esc(s.label || docLabel(b, s.doc_id))}</figcaption>` +
      `<blockquote class="doc">${esc(s.quote)}</blockquote></figure>`).join('') + `</div>`;
  }

  function judgeHtml(x, b) {
    const j = x.judge;
    if (!j || typeof j !== 'object') return '';
    const thr = Number(j.threshold ?? (b.config && b.config.judge_threshold) ?? 0.9);
    const probs = Object.entries(j.probs || {}).map(([k, v]) => [k, Number(v) || 0]).sort((a, c) => c[1] - a[1]);
    if (!probs.length) return '';
    const topP = probs[0][1];
    const pass = topP >= thr;
    const bars = probs.map(([label, p], i) =>
      `<div class="bar-row ${i === 0 ? 'top' : ''} ${i === 0 && pass ? 'pass' : ''}">` +
      `<span class="bar-label" title="${esc(label)}">${esc(humanize(label))}</span>` +
      `<div class="bar" role="img" aria-label="${esc(label)} ${Math.round(p * 100)}%"><div class="fill" style="width:${Math.max(0, Math.min(100, p * 100))}%"></div>` +
      `<div class="thr" style="left:${Math.max(0, Math.min(100, thr * 100))}%"></div></div>` +
      `<span class="pct">${Math.round(p * 100)}%</span></div>`).join('');
    return `<div class="judge"><div class="judge-head"><span class="judge-tag">Judge</span>` +
      `<span class="judge-q">${esc(j.question || 'Fuzzy match')}</span></div>${bars}` +
      `<div class="judge-note"><span class="sw"></span>Threshold ${thr.toFixed(2)} · ` +
      (pass ? 'above threshold' : `top label ${Math.round(topP * 100)}% is below it, so an analyst decides`) + `</div></div>`;
  }

  function excCard(x, b, d) {
    const sev = String(x.severity || 'low').toLowerCase();
    const fresh = d.freshOpen.some((f) => f.id === x.id);
    const rule = x.rule && (x.rule.id || x.rule.text)
      ? `<div class="rulebox"><span class="chip rule">${esc(x.rule.id)}</span><span>${esc(x.rule.text)}</span></div>` : '';
    const actions = arr(x.actions).map((a, i) => {
      const secondary = /dismiss|reject|false|ignore/i.test(a.id || '');
      return `<button type="button" class="btn act ${secondary || i > 0 ? '' : 'primary'}" data-act="resolve" data-exc="${esc(x.id)}" data-action="${esc(a.id)}">${esc(a.label || a.id)}</button>`;
    }).join('');
    return `<article class="exc sev-${esc(sev)} ${fresh ? 'flash' : ''}">` +
      `<div class="exc-head"><span class="sev ${esc(sev)}">${esc(sev)}</span>` +
      `<span class="exc-id">${esc(x.id)}${x.requirement_id ? ` · ${esc(x.requirement_id)}` : ''}</span></div>` +
      `<h3 class="exc-title">${esc(x.title)}</h3>` +
      `<p class="exc-sum">${esc(x.summary)}</p>` + rule + snippetsHtml(b, x) + judgeHtml(x, b) +
      `<div class="actions">${actions}</div></article>`;
  }

  function renderTriage(b, d) {
    const exs = arr(b.exceptions);
    const open = exs.filter((x) => x.status === 'OPEN')
      .sort((p, q) => (SEV_RANK[String(p.severity).toLowerCase()] ?? 9) - (SEV_RANK[String(q.severity).toLowerCase()] ?? 9));
    const done = exs.filter((x) => x.status !== 'OPEN');
    let html = open.length
      ? open.map((x) => excCard(x, b, d)).join('')
      : `<div class="empty-state"><b>No open exceptions</b>The agent is working the file. Anything it cannot settle by rule will appear here.</div>`;
    if (done.length) {
      const body = done.map((x) =>
        `<div class="res-card"><h3><span class="tick">✓</span>${esc(x.title)}<span class="exc-id" style="margin-left:auto">${esc(x.id)}</span></h3>` +
        `<p>${esc(x.summary)}</p></div>`).join('');
      html += coll('resolved', `Resolved <span class="count">${done.length}</span>`, body, 'resolved-sec');
    }
    $('pane-triage').innerHTML = html;
  }

  function gateHtml(g) {
    g = String(g ?? '-');
    if (g === 'ALLOW') return '<span class="gate allow">ALLOW</span>';
    if (g.startsWith('DENY')) return `<span class="gate deny" title="${esc(g)}">${esc(g)}</span>`;
    return `<span class="gate none">${esc(g)}</span>`;
  }

  function renderTrace(b, d) {
    const tr = arr(b.trace).slice().sort((x, y) => (y.seq ?? 0) - (x.seq ?? 0));
    if (!tr.length) { $('pane-trace').innerHTML = '<div class="empty-state">No agent steps yet.</div>'; return; }
    $('pane-trace').innerHTML = tr.map((t) => {
      const k = traceKey(t);
      const g = String(t.gate ?? '-');
      const cls = g === 'ALLOW' ? 'allow' : g.startsWith('DENY') ? 'deny' : '';
      const hasInput = t.input !== undefined && t.input !== null && !(typeof t.input === 'object' && !Object.keys(t.input).length);
      const input = hasInput ? coll(`in:${k}`, 'Input JSON', `<pre class="json">${esc(JSON.stringify(t.input, null, 2))}</pre>`) : '';
      const outText = t.output == null ? '' : (typeof t.output === 'string' ? t.output : JSON.stringify(t.output, null, 2));
      const ko = `out:${k}`;
      const out = outText
        ? `<button type="button" class="out ${S.open.has(ko) ? 'open' : ''}" data-key="${esc(ko)}" data-toggle>${esc(outText)}</button>` : '';
      return `<article class="step ${cls} ${d.newTrace.has(k) ? 'flash' : ''}">` +
        `<div class="step-top"><span class="step-seq">#${esc(t.seq)}</span><code class="tool">${esc(t.tool)}</code>${gateHtml(t.gate)}</div>` +
        `<p class="step-reason">${esc(t.reason)}</p>${input}${out}` +
        `<div class="step-time">${esc(whenLabel(t.sim_time, b))}</div></article>`;
    }).join('');
  }

  function renderTabs() {
    const b = S.bundle || {};
    const nOpen = arr(b.exceptions).filter((x) => x.status === 'OPEN').length;
    const nSteps = arr(b.trace).length;
    $('tab-triage').textContent = `Triage (${nOpen} open)`;
    $('tab-trace').textContent = `Agent trace (${nSteps})`;
    ['triage', 'trace'].forEach((name) => {
      const on = S.tab === name;
      $(`tab-${name}`).classList.toggle('active', on);
      $(`tab-${name}`).setAttribute('aria-selected', String(on));
      $(`pane-${name}`).hidden = !on;
    });
  }

  /* ---------------- boot overlay ---------------- */
  function hideBoot() { $('boot').classList.add('gone'); }
  function bootError(msg) {
    const el = $('boot');
    el.classList.remove('gone');
    el.classList.add('error');
    $('boot-msg').textContent = msg;
    $('boot-actions').hidden = false;
  }
  function bootLoading() {
    const el = $('boot');
    el.classList.remove('gone', 'error');
    $('boot-msg').textContent = 'Loading case…';
    $('boot-actions').hidden = true;
  }

  /* ---------------- actions ---------------- */
  async function run(btn, label, fn) {
    if (S.busy) return;
    if (MOCK) { toast(`Mock mode: "${label}" does nothing here`, 'info'); return; }
    S.busy = true;
    document.body.classList.add('is-busy');
    if (btn) btn.classList.add('loading');
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast(`${label} failed: ${err.message || err}`, 'error');
    } finally {
      S.busy = false;
      document.body.classList.remove('is-busy');
      if (btn) btn.classList.remove('loading');
    }
  }

  const post = async (path, body) => applyBundle(await api('POST', path, body));

  function disarmReset() {
    S.resetArmed = false;
    clearTimeout(S.resetTimer);
    const b = $('btn-reset');
    b.classList.remove('armed');
    b.textContent = 'Reset demo';
  }

  function onClick(e) {
    // collapsibles
    const tg = e.target.closest('[data-toggle]');
    if (tg) {
      const host = tg.closest('[data-key]');
      if (host) {
        const key = host.dataset.key;
        const on = !host.classList.contains('open');
        host.classList.toggle('open', on);
        tg.setAttribute('aria-expanded', String(on));
        if (on) S.open.add(key); else S.open.delete(key);
      }
      return;
    }
    // tabs
    const tab = e.target.closest('[data-tab]');
    if (tab) { S.tab = tab.dataset.tab; renderTabs(); return; }

    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    const id = (S.bundle && S.bundle.case && S.bundle.case.id) || CASE_ID;

    if (act !== 'reset' && S.resetArmed) disarmReset();

    if (act === 'advance') {
      const days = Number(btn.dataset.days);
      run(btn, `+${days} day${days > 1 ? 's' : ''}`, () => post(`/api/cases/${id}/advance`, { days }));
    } else if (act === 'inbound') {
      run(btn, 'Deliver item', () => post(`/api/cases/${id}/inbound`, { item_id: btn.dataset.id }));
    } else if (act === 'resolve') {
      run(btn, 'Resolve exception', () =>
        post(`/api/cases/${id}/exceptions/${encodeURIComponent(btn.dataset.exc)}/resolve`, { action_id: btn.dataset.action, note: '' }));
    } else if (act === 'verify') {
      run(btn, 'Verify ledger', async () => {
        S.verify = await api('GET', `/api/cases/${id}/verify`);
        renderVerify();
      });
    } else if (act === 'reset') {
      if (MOCK) { toast('Mock mode: "Reset demo" does nothing here', 'info'); return; }
      if (!S.resetArmed) {
        S.resetArmed = true;
        btn.classList.add('armed');
        btn.textContent = 'Click again to confirm';
        S.resetTimer = setTimeout(disarmReset, 3500);
        return;
      }
      disarmReset();
      run(btn, 'Reset demo', async () => {
        S.tab = 'triage';
        await post('/api/demo/reset', {});
        toast('Demo reset to Day 0', 'success');
      });
    }
  }

  /* ---------------- init ---------------- */
  async function load() {
    bootLoading();
    try {
      let b;
      if (MOCK) {
        const res = await fetch('mock-bundle.json');
        if (!res.ok) throw new ApiError(`mock-bundle.json: HTTP ${res.status}`, res.status);
        b = await res.json();
      } else {
        try {
          b = await api('GET', `/api/cases/${CASE_ID}/bundle`);
        } catch (err) {
          if (err.status === 404) b = await api('POST', '/api/demo/reset', {});
          else throw err;
        }
      }
      applyBundle(b);
    } catch (err) {
      console.error(err);
      bootError(`Could not load the case: ${err.message || err}`);
    }
  }

  document.addEventListener('click', onClick);
  $('boot-retry').addEventListener('click', load);
  load();
})();
