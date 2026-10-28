/* OpenLoop frontend v2: vanilla JS, no build step.
   Every POST returns a full Bundle; the whole UI is re-rendered from it. Spec: docs/ui-design.md */
(() => {
  'use strict';

  const CASE_ID = 'demo-1';
  const MOCK = new URLSearchParams(location.search).get('mock') === '1';
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const DAY_MS = 86400000;

  const STATUS = {
    SATISFIED:    { word: 'Verified',     cls: 'st-ok',      icon: 'check' },
    OPEN_WAITING: { word: 'Waiting',      cls: 'st-wait',    icon: 'clock' },
    CONTRADICTED: { word: 'Conflict',     cls: 'st-bad',     icon: 'cross' },
    NEEDS_REVIEW: { word: 'Needs review', cls: 'st-review',  icon: 'question' },
    EXPIRED:      { word: 'Expired',      cls: 'st-expired', icon: 'hourglass' },
  };
  const statusOf = (s) => STATUS[s] || { word: sentence(humanize(s || 'Unknown')), cls: 'st-wait', icon: 'clock' };
  const SEV_RANK = { critical: 0, high: 1, medium: 2, low: 3 };
  const JUDGE_LABELS = {
    same_address: 'Same place', different_address: 'Different place',
    same_person: 'Same person', different_person: 'Different person',
  };
  const ICONS = {
    check: '<path d="M3.5 8.5l3 3 6-7"/>',
    cross: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
    question: '<path d="M5.8 5.9a2.3 2.3 0 1 1 3.4 2c-.8.45-1.2.95-1.2 1.75v.35"/><circle cx="8" cy="12.6" r=".6" fill="currentColor"/>',
    clock: '<circle cx="8" cy="8" r="5.8"/><path d="M8 4.9V8l2.2 1.4"/>',
    hourglass: '<path d="M4.5 2.5h7M4.5 13.5h7M5.3 2.5c0 3.2 5.4 3.4 5.4 5.5s-5.4 2.3-5.4 5.5M10.7 2.5c0 3.2-5.4 3.4-5.4 5.5s5.4 2.3 5.4 5.5"/>',
  };
  const icon = (name, extra = '') => `<svg class="ico ${extra}" viewBox="0 0 16 16" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  const S = {
    bundle: null,
    prev: null,          // snapshot of the previous render, for "what is new"
    tab: 'reasoning',
    busy: false,
    verify: null,        // {ok, length, broken_at} until the next bundle arrives
    open: new Set(),     // keys of expanded disclosures (survive re-renders)
    sel: null,           // selected requirement id
    resetArmed: false,
    resetTimer: null,
    railReady: false,
  };

  const $ = (id) => document.getElementById(id);

  /* ---------------- helpers ---------------- */
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
  const pad2 = (n) => String(n).padStart(2, '0');
  const arr = (x) => (Array.isArray(x) ? x : []);
  const humanize = (s) => String(s ?? '').replace(/_/g, ' ');
  const sentence = (s) => { s = String(s ?? ''); return s ? s[0].toUpperCase() + s.slice(1) : s; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : (many || one + 's')}`;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const uniq = (xs) => [...new Set(xs)];
  // Plain-language clean-up for labels that come from the API.
  const joinPlus = (s) => {
    const parts = s.split(/\s+\+\s+/);
    return parts.length < 2 ? s : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
  };
  const tidy = (s) => joinPlus(String(s ?? '')
    .replace(/\s*(→|->)\s*/g, ', ')
    .replace(/\s+·\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim());

  // Agent and ledger text sometimes carries raw status codes; show the plain words instead.
  const CODE_WORDS = { SATISFIED: 'verified', OPEN_WAITING: 'waiting', CONTRADICTED: 'in conflict', NEEDS_REVIEW: 'needs review', EXPIRED: 'expired' };
  const CODES = 'SATISFIED|OPEN_WAITING|CONTRADICTED|NEEDS_REVIEW|EXPIRED';
  const plain = (s) => String(s ?? '')
    .replace(new RegExp(`\\b(R\\d+)\\s*(?:→|->)\\s*(${CODES})\\b`, 'g'), (m, r, c) => `${r} now ${CODE_WORDS[c]}`)
    .replace(new RegExp(`\\bis (${CODES})\\b`, 'g'), (m, c) => (c === 'NEEDS_REVIEW' ? 'needs review' : `is ${CODE_WORDS[c]}`))
    .replace(new RegExp(`\\b(${CODES})\\b`, 'g'), (m) => CODE_WORDS[m]);

  // All dates are formatted in UTC by hand so the projector laptop's locale cannot change the demo.
  function parseDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function fmtShort(iso) { // 31 Oct, 09:00
    const d = parseDate(iso);
    if (!d) return '';
    return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  function dayFloat(iso, b) {
    const t = parseDate(iso), o = parseDate(b.case && b.case.opened_at);
    if (!t || !o) return null;
    return (t.getTime() - o.getTime()) / DAY_MS;
  }
  function dayOf(iso, b) {
    const f = dayFloat(iso, b);
    return f === null ? null : Math.floor(f + 1e-6);
  }
  const shortHash = (h) => (h ? `${String(h).slice(0, 4)}…` : '–');
  const parseMaybe = (v) => {
    if (typeof v !== 'string') return v;
    const t = v.trim();
    if (!/^[[{]/.test(t)) return v;
    try { return JSON.parse(t); } catch (e) { return v; }
  };
  function docLabel(b, id) {
    const d = arr(b.documents).find((x) => x.id === id);
    return (d && d.name) || id || 'Document';
  }
  const openExc = (b) => arr(b.exceptions).filter((x) => x.status === 'OPEN')
    .sort((p, q) => (SEV_RANK[String(p.severity).toLowerCase()] ?? 9) - (SEV_RANK[String(q.severity).toLowerCase()] ?? 9));
  const reqById = (b, id) => arr(b.requirements).find((r) => r.id === id);

  /* ---------------- disclosures that survive re-render ---------------- */
  function coll(key, head, body, extra = '') {
    const o = S.open.has(key);
    return `<div class="coll ${extra} ${o ? 'open' : ''}" data-key="${esc(key)}">` +
      `<button type="button" class="coll-head" data-toggle aria-expanded="${o}"><span class="chev" aria-hidden="true"></span>${head}</button>` +
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

  /* ---------------- tooltip ---------------- */
  const tip = $('tip');
  function showTip(el) {
    const text = el.getAttribute('data-tip');
    if (!text) return;
    tip.textContent = text;
    tip.hidden = false;
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    const x = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8);
    let y = r.top - th - 8;
    if (y < 8) y = r.bottom + 8;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  const hideTip = () => { tip.hidden = true; };
  document.addEventListener('mouseover', (e) => { const t = e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('mouseout', (e) => {
    const t = e.target.closest('[data-tip]');
    if (t && !t.contains(e.relatedTarget)) hideTip();
  });
  document.addEventListener('focusin', (e) => { const t = e.target.closest('[data-tip]'); if (t) showTip(t); });
  document.addEventListener('focusout', hideTip);

  /* ---------------- diff against previous render ---------------- */
  const traceKey = (t) => `${t.seq}|${t.sim_time}|${t.tool}`;
  function snapshot(b) {
    return {
      caseId: b.case && b.case.id,
      opened: b.case && b.case.opened_at,
      sim: b.case && b.case.sim_now,
      trace: new Set(arr(b.trace).map(traceKey)),
      timers: new Map(arr(b.timers).map((t) => [t.id, t.status])),
      openExc: new Set(arr(b.exceptions).filter((x) => x.status === 'OPEN').map((x) => x.id)),
    };
  }
  function diffOf(b) {
    const p = S.prev;
    const d = { first: !p, newTrace: new Set(), newlyFired: new Set(), freshOpen: [], simChanged: false, reset: false };
    if (!p) return d;
    d.reset = p.opened !== (b.case && b.case.opened_at) || arr(b.events).length < 3;
    const tr = arr(b.trace);
    tr.forEach((t) => { if (!p.trace.has(traceKey(t))) d.newTrace.add(traceKey(t)); });
    if (tr.length && d.newTrace.size === tr.length) d.newTrace.clear();
    arr(b.timers).forEach((t) => { if (t.status === 'FIRED' && p.timers.get(t.id) === 'PENDING') d.newlyFired.add(t.id); });
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
    if (d.reset) { S.sel = null; S.open.clear(); }
    if (S.sel && !reqById(b, S.sel)) S.sel = null;
    hideTip();

    safe('header', () => renderHeader(b));
    safe('rail', () => renderRail(b, d));
    safe('checklist', () => renderChecklist(b));
    safe('summary', () => renderSummary(b));
    safe('inbound', () => renderInbound(b));
    safe('center', () => renderCenter(b, d));
    safe('reasoning', () => renderReasoning(b, d));
    safe('ledger', () => renderLedger(b));
    safe('tabs', renderTabs);

    if (d.freshOpen.length) $('center').scrollTop = 0;
    S.prev = snapshot(b);
    hideBoot();
  }

  /* ---------- header ---------- */
  function splitTitle(c) {
    const t = String(c.title || '');
    const parts = t.split(/\s+[—–]\s+/);
    if (parts.length >= 2) {
      let sub = parts[0].replace(/\s*&\s*/g, ' and ').trim();
      if (/\bKYB$/.test(sub)) sub += ' check';
      return { name: parts.slice(1).join(' '), sub };
    }
    return { name: t || 'Case', sub: c.goal || '' };
  }
  // READY_FOR_DECISION is only trusted when every check is verified (a certificate can expire afterwards).
  const isComplete = (b) => (b.case || {}).status === 'READY_FOR_DECISION'
    && arr(b.requirements).every((r) => r.status === 'SATISFIED');
  function statusLine(b) {
    if (isComplete(b)) return { cls: 'done', text: 'File complete. The credit decision is yours.' };
    const n = openExc(b).length;
    if (n) return { cls: 'need', text: `${n} ${n === 1 ? 'decision needs' : 'decisions need'} you` };
    const bad = arr(b.requirements).filter((r) => ['EXPIRED', 'CONTRADICTED', 'NEEDS_REVIEW'].includes(r.status));
    if (bad.length) {
      const r = bad[0];
      return { cls: 'wait', text: `${r.title}: ${statusOf(r.status).word.toLowerCase()}${bad.length > 1 ? `, and ${bad.length - 1} more` : ''}` };
    }
    const waits = uniq(arr(b.requirements).filter((r) => r.status === 'OPEN_WAITING')
      .flatMap((r) => String(r.reason || '').replace(/^waiting for:?\s*/i, '').split(/[;,]\s*(?![^()]*\))/))
      .map((s) => s.replace(/\s*\([^)]*\)\s*/g, ' ').trim()).filter(Boolean));
    if (waits.length) {
      let list = waits.slice(0, 3).join(', ');
      if (waits.length > 3) list += ` and ${waits.length - 3} more`;
      return { cls: 'wait', text: `Waiting on the client for: ${list}` };
    }
    return { cls: 'wait', text: 'The agent is working the file.' };
  }
  function renderHeader(b) {
    const c = b.case || {};
    const cfg = b.config || {};
    const t = splitTitle(c);
    $('case-name').textContent = t.name;
    $('case-sub').textContent = t.sub;
    $('case-sub').title = c.goal ? `Goal: ${c.goal}` : '';
    document.title = `${t.name}, OpenLoop`;
    const st = statusLine(b);
    const line = $('case-line');
    line.className = `case-line ${st.cls}`;
    line.innerHTML = `<span class="dot" aria-hidden="true"></span><span>${esc(st.text)}</span>`;
    $('mode-agent').innerHTML = `Agent: <b>${esc(cfg.agent_mode || 'unknown')}</b>`;
    $('mode-judge').innerHTML = `Judge: <b>${esc(cfg.judge_mode || 'unknown')}</b>`;
    $('mock-flag').hidden = !MOCK;
    renderVerify();
  }
  function verifyText() {
    const v = S.verify;
    if (!v) return null;
    return v.ok
      ? { cls: 'ok', text: `Chain intact, ${v.length} events` }
      : { cls: 'bad', text: `Chain broken at event #${v.broken_at}` };
  }
  function renderVerify() {
    const v = verifyText();
    const el = $('top-verify');
    el.textContent = v ? v.text : '';
    el.className = `verify-text ${v ? v.cls : ''}`;
    document.querySelectorAll('[data-verify-slot]').forEach((n) => {
      n.textContent = v ? v.text : '';
      n.className = `verify-text ${v ? v.cls : ''}`;
    });
  }

  /* ---------- timeline rail ---------- */
  function shortTimerLabel(t, count) {
    const kind = String(t.kind || '');
    if (kind === 'legal_deadline') return /amlr/i.test(t.label || '') ? 'AMLR report due' : tidy(t.label);
    if (kind === 'doc_expiry') return /trade register|onrc/i.test(t.label || '') ? 'Certificate expires' : 'Document expires';
    if (kind === 'reminder') return count > 1 ? `${count} reminders` : 'Reminder';
    const l = tidy(t.label || humanize(kind));
    if (l.length <= 30) return l;
    const cut = l.slice(0, 30);
    return `${cut.slice(0, cut.lastIndexOf(' ') > 12 ? cut.lastIndexOf(' ') : 29)}…`;
  }
  const AXIS_Y = 64; // keep in sync with .rail-axis in styles.css
  const flagKind = (k) => (k === 'legal_deadline' ? 'k-legal' : k === 'doc_expiry' ? 'k-expiry' : k === 'reminder' ? 'k-reminder' : 'k-other');

  function renderRail(b, d) {
    const scale = $('rail-scale');
    const width = scale.clientWidth || 1000;
    const c = b.case || {};
    const today = Math.max(0, dayFloat(c.sim_now, b) ?? Number(c.day) ?? 0);
    const timers = arr(b.timers);
    const pending = timers.filter((t) => t.status === 'PENDING');
    const lastDue = pending.reduce((m, t) => Math.max(m, dayFloat(t.due, b) ?? 0), 0);
    const span = Math.max(1, Math.ceil(Math.max(today + 7, pending.length ? lastDue + 2 : 0)));
    const pct = (x) => (clamp(x, 0, span) / span) * 100;
    const px = (x) => (clamp(x, 0, span) / span) * width;
    const dayW = width / span;
    let h = '';

    // axis, ticks and day labels
    h += '<div class="rail-axis"></div>';
    const pillHalf = 52;
    for (let i = 0; i <= span; i++) {
      h += `<span class="rail-tick ${i % 7 === 0 ? 'week' : ''}" style="left:${pct(i)}%"></span>`;
      const nearToday = Math.abs(i - today) * dayW < pillHalf + 10;
      if (nearToday && i !== 0) continue;
      if (i === 0 && today * dayW < pillHalf + 26 && today > 0) continue;
      if (i === 0 && today === 0) continue;
      const crowded = dayW < 26 && i % 2 === 1;
      if (crowded) continue;
      if (i > 0 && i * dayW < 46) continue; // keep clear of the wider "Day 0" label
      h += `<span class="rail-day ${i === 0 ? 'first' : ''}" style="left:${pct(i)}%">${i === 0 ? 'Day 0' : i}</span>`;
    }

    // things that happened, above the axis
    const marks = [];
    arr(b.events).forEach((e) => {
      const t = String(e.type || '').toUpperCase();
      const actor = String((e.actor && e.actor.type) || '').toLowerCase();
      if (t === 'DOCUMENT_RECEIVED') marks.push({ kind: 'doc', x: dayFloat(e.sim_time, b), seq: e.seq, tip: `Day ${dayOf(e.sim_time, b)}: ${e.summary}` });
      else if (/EXCEPTION_RESOLVED/.test(t) && actor !== 'agent' && actor !== 'system') {
        const exId = (String(e.summary || '').match(/EX-\d+/) || [])[0];
        const ex = arr(b.exceptions).find((x) => x.id === exId);
        const what = ex ? `${ex.title}\n${resolutionText(ex, b, true)}` : e.summary;
        marks.push({ kind: 'decision', x: dayFloat(e.sim_time, b), seq: e.seq, tip: `Day ${dayOf(e.sim_time, b)}, analyst decision\n${what}` });
      }
    });
    arr(b.trace).forEach((s) => {
      if (String(s.gate || '').startsWith('DENY')) {
        const rule = String(s.gate).replace(/^DENY:?\s*/, '');
        marks.push({ kind: 'blocked', x: dayFloat(s.sim_time, b), seq: s.seq, tip: `Day ${dayOf(s.sim_time, b)}, blocked by ${rule}: ${s.reason || humanize(s.tool)}` });
      }
    });
    const groups = new Map();
    marks.filter((m) => m.x !== null).forEach((m) => {
      const k = Math.round(m.x * 100) / 100;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(m);
    });
    const ORDER = { decision: 0, doc: 1, blocked: 2 };
    // Stacks are at most 3 high; a fourth mark starts a second column so nothing reaches the day labels.
    // Stacks are at most 3 high and up to 3 columns wide, so nothing reaches the day labels.
    const MAX_SHOWN = 9;
    const COL_DX = { 1: [0], 2: [-6, 6], 3: [-12, 0, 12] };
    groups.forEach((all, x) => {
      all.sort((a, c2) => (ORDER[a.kind] - ORDER[c2.kind]) || (a.seq - c2.seq));
      const list = all.filter((m) => m.kind !== 'blocked');
      const shown = list.length > MAX_SHOWN ? list.slice(0, MAX_SHOWN - 1) : list;
      const PER_COL = shown.length <= 3 ? 3 : shown.length <= 6 ? Math.ceil(shown.length / 2) : 3;
      const cols = Math.max(1, Math.ceil(shown.length / PER_COL));
      shown.forEach((m, i) => {
        const col = Math.floor(i / PER_COL), row = i % PER_COL;
        const dx = COL_DX[cols][col];
        const top = (AXIS_Y - 6) - (row + 1) * 9 - row * 3;
        h += `<button type="button" class="mark m-${m.kind}" style="left:calc(${pct(x)}% + ${dx}px);top:${top}px" data-tip="${esc(m.tip)}" aria-label="${esc(m.tip)}"></button>`;
      });
      let right = COL_DX[cols][cols - 1] + 10;
      if (list.length > shown.length) {
        const rest = list.slice(shown.length);
        h += `<span class="mark-more" style="left:calc(${pct(x)}% + ${right}px);top:${AXIS_Y - 22}px" data-tip="${esc(rest.map((m) => m.tip).join('\n'))}" tabindex="0">+${rest.length}</span>`;
        right += 18;
      }
      // Blocked actions sit in their own short column to the right, so they never hide behind the today line.
      all.filter((m) => m.kind === 'blocked').slice(0, 3).forEach((m, i) => {
        h += `<button type="button" class="mark m-blocked" style="left:calc(${pct(x)}% + ${right + i * 8}px);top:${AXIS_Y - 21}px" data-tip="${esc(m.tip)}" aria-label="${esc(m.tip)}"></button>`;
      });
    });

    // things that will happen, below the axis: pending timers grouped by day
    const byDay = new Map();
    pending.forEach((t) => {
      const x = dayFloat(t.due, b);
      if (x === null) return;
      const key = `${Math.round(x * 100) / 100}|${t.kind === 'reminder' ? 'reminder' : t.id}`;
      if (!byDay.has(key)) byDay.set(key, { x, list: [] });
      byDay.get(key).list.push(t);
    });
    const flags = [...byDay.values()].map((g) => {
      const t0 = g.list[0];
      const label = shortTimerLabel(t0, g.list.length);
      const dueDay = dayOf(t0.due, b);
      const tipText = g.list.map((t) => `${tidy(t.label)}`).join('\n') + `\nDue day ${dueDay}, ${fmtShort(t0.due)}`;
      const prio = t0.kind === 'legal_deadline' ? 0 : t0.kind === 'doc_expiry' ? 1 : t0.kind === 'reminder' ? 3 : 2;
      return { x: g.x, label, sub: `day ${dueDay}`, tipText, kind: flagKind(t0.kind), prio };
    }).sort((a, c2) => a.x - c2.x || a.prio - c2.prio);
    const rows = [[], []];
    const ROW_TOP = [8, 28];
    flags.forEach((f) => {
      const w = (f.label.length + f.sub.length) * 6.6 + 30;
      const x0 = px(f.x);
      const left = x0 + w > width + 30;
      const span2 = left ? [x0 - w, x0] : [x0, x0 + w];
      let row = rows.findIndex((r) => r.every(([a, z]) => span2[1] + 6 < a || span2[0] > z + 6));
      if (row === -1) row = 1;
      rows[row].push(span2);
      const top = ROW_TOP[row];
      h += `<button type="button" class="flag ${f.kind} ${left ? 'left' : ''}" style="left:${pct(f.x)}%" data-tip="${esc(f.tipText)}" aria-label="${esc(f.tipText)}">` +
        `<span class="stem" style="height:${top + 2}px"></span>` +
        `<span class="flab" style="top:${top}px">${esc(f.label)}<small>${esc(f.sub)}</small></span></button>`;
    });

    // fired or cancelled timers: small, grey, struck through
    const goneGroups = new Map();
    timers.filter((t) => t.status === 'FIRED' || t.status === 'CANCELLED').forEach((t) => {
      const x = dayFloat(t.due, b);
      if (x === null) return;
      const k = Math.round(x * 100) / 100;
      if (!goneGroups.has(k)) goneGroups.set(k, []);
      goneGroups.get(k).push(t);
    });
    goneGroups.forEach((list, x) => {
      const pulse = list.some((t) => d.newlyFired.has(t.id));
      const tipText = list.map((t) => `${t.status === 'FIRED' ? 'Fired' : 'Cancelled'}: ${tidy(t.label)}`).join('\n') + `\nDay ${dayOf(list[0].due, b)}`;
      const nearToday = Math.abs(x - today) * dayW < 8;
      h += `<button type="button" class="gone-mark ${pulse ? 'pulse' : ''}" style="left:calc(${pct(x)}% ${nearToday ? '- 10px' : '+ 0px'})" data-tip="${esc(tipText)}" aria-label="${esc(tipText)}"></button>`;
    });

    $('rail-layer').innerHTML = h;

    // persistent elements so the today marker can slide
    const todayEl = $('rail-today');
    const past = $('rail-past');
    const instant = !S.railReady || d.reset;
    todayEl.classList.toggle('instant', instant);
    past.style.transition = instant ? 'none' : '';
    todayEl.style.left = `${pct(today)}%`;
    past.style.width = `calc(${pct(today)}% + 30px)`;
    $('today-pill').textContent = `Today, day ${Math.floor(today + 1e-6)}`;
    todayEl.classList.toggle('edge-start', px(today) < 40);
    todayEl.classList.toggle('edge-end', width - px(today) < 40);
    if (instant) {
      void todayEl.offsetWidth; // commit the position before transitions come back on
      todayEl.classList.remove('instant');
      past.style.transition = '';
    }
    S.railReady = true;
  }

  /* ---------- checklist (left) ---------- */
  function defaultSel(b) {
    const reqs = arr(b.requirements);
    if (S.sel && reqById(b, S.sel)) return S.sel;
    const pick = reqs.find((r) => r.status === 'CONTRADICTED' || r.status === 'NEEDS_REVIEW' || r.status === 'EXPIRED')
      || reqs.find((r) => r.status === 'OPEN_WAITING') || reqs[0];
    return pick ? pick.id : null;
  }
  function renderChecklist(b) {
    const reqs = arr(b.requirements);
    if (!reqs.length) { $('checklist').innerHTML = '<p class="empty">No checks yet.</p>'; return; }
    const sel = defaultSel(b);
    const withDecision = new Set(openExc(b).map((x) => x.requirement_id));
    $('checklist').innerHTML = reqs.map((r) => {
      const s = statusOf(r.status);
      const flag = withDecision.has(r.id) ? '<span class="ck-flag" aria-hidden="true"></span><span class="sr-only">, decision open</span>' : '';
      return `<button type="button" class="ck-row ${r.id === sel ? 'sel' : ''}" data-act="select" data-id="${esc(r.id)}" aria-pressed="${r.id === sel}">` +
        `<span class="ck-glyph ${s.cls}" title="${esc(s.word)}">${icon(s.icon)}</span>` +
        `<span class="ck-text"><span class="ck-title"><span class="sr-only">${esc(s.word)}: </span>${esc(r.title)}${flag}</span>` +
        `<span class="ck-reason" title="${esc(r.reason)}">${esc(r.reason || s.word)}</span></span></button>`;
    }).join('');
  }

  function renderSummary(b) {
    const m = b.metrics || {};
    const calls = Number(m.tool_calls ?? 0), auto = Number(m.auto_resolved ?? 0);
    const human = Number(m.sent_to_human ?? 0), denied = Number(m.denied_actions ?? 0);
    $('summary').textContent =
      `${plural(calls, 'tool call')}. ${plural(auto, 'check')} verified automatically, ${human} sent to you, ` +
      `${denied ? plural(denied, 'action') + ' blocked' : 'no actions blocked'}.`;
  }

  const scenarioLabel = (s) => tidy(String(s || '').replace(/^Day\s+\d+\s*·\s*/i, ''));
  function renderInbound(b) {
    const items = arr(b.scenario);
    if (!items.length) { $('inbound').innerHTML = '<p class="caption">No scripted items.</p>'; return; }
    const next = items.find((i) => !i.delivered);
    const nextId = (next || {}).id;
    const sendNext = $('send-next');  // presenter shortcut on the rail: always one click away
    if (sendNext) {
      sendNext.hidden = !next;
      if (next) {
        sendNext.dataset.id = next.id;
        sendNext.title = `Send: ${scenarioLabel(next.label)}`;
      }
    }
    $('inbound').innerHTML = items.map((it) => {
      const label = scenarioLabel(it.label);
      if (it.delivered) return `<div class="sent">${icon('check', 'sm')}<span>${esc(label)}</span></div>`;
      return `<button type="button" class="send ${it.id === nextId ? 'next' : ''}" data-act="inbound" data-id="${esc(it.id)}">Send: ${esc(label)}</button>`;
    }).join('');
  }

  /* ---------- center ---------- */
  // One block per source line, so a wrapped line gets a hanging indent and reads as one entry.
  const quoteLines = (q) => String(q ?? '').split(/\r?\n/).map((l) => `<span class="ql">${esc(l) || '&nbsp;'}</span>`).join('');
  function papersHtml(b, list) {
    if (!list.length) return '';
    return `<div class="papers ${list.length > 2 ? 'many' : ''}">` + list.map((s) =>
      `<figure class="paper"><blockquote>${quoteLines(s.quote)}</blockquote>` +
      `<figcaption>From: ${esc(s.label || docLabel(b, s.doc_id))}</figcaption></figure>`).join('') + '</div>';
  }
  const firstSentence = (q) => {
    const s = String(q || '').trim();
    const m = s.match(/^.*?[?.!](\s|$)/);
    return (m ? m[0] : s).trim();
  };
  function judgeHtml(x, b) {
    const j = x.judge;
    if (!j || typeof j !== 'object') return '';
    const thr = Number(j.threshold ?? (b.config && b.config.judge_threshold) ?? 0.9);
    const probs = Object.entries(j.probs || {}).map(([k, v]) => [k, clamp(Number(v) || 0, 0, 1)]);
    if (!probs.length) return '';
    const rows = probs.map(([k, p]) => {
      const lab = JUDGE_LABELS[k] || sentence(humanize(k));
      return `<div class="jrow"><span class="jlab">${esc(lab)}</span>` +
        `<span class="jbar" role="img" aria-label="${esc(lab)} ${Math.round(p * 100)}%">` +
        `<span class="jfill ${p >= thr ? 'pass' : ''}" style="width:${p * 100}%"></span>` +
        `<span class="jthr" style="left:${clamp(thr, 0, 1) * 100}%"></span></span>` +
        `<span class="jpct">${Math.round(p * 100)}%</span></div>`;
    }).join('');
    const q = firstSentence(j.question);
    const src = j.source || (b.config && b.config.judge_mode) || 'unknown';
    return `<section class="judge"><h4 class="sub">What the judge thinks</h4>` +
      (q ? `<p class="jq" title="${esc(j.question)}">${esc(q)}</p>` : '') +
      `<div class="jrows">${rows}</div>` +
      `<div class="jfoot"><span class="jlegend"><span class="jdash" aria-hidden="true"></span>Needed to accept automatically: ${Math.round(thr * 100)}%</span>` +
      `<span>Judge: ${esc(src)}</span></div></section>`;
  }
  const noteText = (n) => (typeof n === 'string' ? n : (n && (n.text || n.note || n.summary)) || '');
  function decisionCard(x, b) {
    const sev = String(x.severity || 'low').toLowerCase();
    const req = reqById(b, x.requirement_id);
    const rule = x.rule && (x.rule.id || x.rule.text)
      ? `<div class="rulebox"><b>${esc(x.rule.id || 'Rule')}</b>${esc(x.rule.text || '')}</div>` : '';
    const notes = arr(x.notes).map(noteText).filter(Boolean)
      .map((n) => `<p class="note">Agent note: ${esc(n)}</p>`).join('');
    const actions = arr(x.actions).map((a, i) =>
      `<button type="button" class="btn ${i === 0 ? 'primary' : 'secondary'}" data-act="resolve" data-exc="${esc(x.id)}" data-req="${esc(x.requirement_id || '')}" data-action="${esc(a.id)}">${esc(tidy(a.label || humanize(a.id)))}</button>`).join('');
    return `<article class="decision" id="exc-${esc(x.id)}" aria-label="Decision: ${esc(x.title)}">` +
      `<div class="d-topline"><span class="chip sev-${esc(sev)}">${esc(sentence(sev))}</span>` +
      `<span>${esc(req ? req.title : (x.requirement_id || ''))}</span></div>` +
      `<h2 class="d-title">${esc(x.title)}</h2>` +
      `<div class="why"><h3 class="sub">Why it stopped</h3><p>${esc(x.summary)}</p></div>` +
      rule +
      (arr(x.snippets).length ? `<div class="evidence">${papersHtml(b, arr(x.snippets))}</div>` : '') +
      judgeHtml(x, b) + notes +
      `<div class="actions">${actions}</div></article>`;
  }
  function resolutionText(x, b, short) {
    const r = x.resolution;
    if (!r) return 'Resolved';
    if (typeof r === 'string') return tidy(r);
    const id = r.action_id || r.action;
    const act = arr(x.actions).find((a) => a.id === id);
    let s = tidy(r.label || r.action_label || (act && act.label) || sentence(humanize(id)) || 'Resolved');
    const by = r.by && r.by.type ? String(r.by.type).toLowerCase() : '';
    const day = b && r.at ? dayOf(r.at, b) : null;
    if (!short && (by || day !== null)) s += `. Decided${by ? ` by the ${by}` : ''}${day !== null ? ` on day ${day}` : ''}.`;
    const note = r.note && String(r.note).trim();
    if (note) s += ` Note: ${note}`;
    return s;
  }
  function resolvedHtml(b) {
    const done = arr(b.exceptions).filter((x) => x.status !== 'OPEN');
    if (!done.length) return '';
    const body = `<ul class="res-list">` + done.map((x) =>
      `<li>${icon('check', 'sm')}<div><div>${esc(x.title)}</div><div class="res-what">${esc(resolutionText(x, b))}</div></div></li>`).join('') + '</ul>';
    return coll('resolved', `Resolved (${done.length})`, body, 'resolved');
  }
  function ruleTexts(b) {
    const m = new Map();
    arr(b.exceptions).forEach((x) => { if (x.rule && x.rule.id) m.set(x.rule.id, x.rule.text || ''); });
    return m;
  }
  function detailHtml(b, r) {
    if (!r) return '<p class="empty">Nothing to show yet.</p>';
    const s = statusOf(r.status);
    const texts = ruleTexts(b);
    const rules = arr(r.rule_ids).map((id) => {
      const t = texts.get(id);
      return `<span class="rule-chip" tabindex="0" ${t ? `data-tip="${esc(`${id}: ${t}`)}"` : `data-tip="${esc(`Rule ${id}`)}"`}>${esc(id)}</span>`;
    }).join('');
    const ev = arr(r.evidence);
    const upd = r.updated_at ? dayOf(r.updated_at, b) : null;
    return `<section class="detail">` +
      `<div class="d-topline"><span class="chip ${s.cls}">${icon(s.icon, 'sm')}${esc(s.word)}</span></div>` +
      `<h2 class="d-title">${esc(r.title)}</h2>` +
      (r.reason ? `<p class="d-reason">${esc(r.reason)}</p>` : '') +
      (rules ? `<div class="d-rules">Rules checked: ${rules}</div>` : '') +
      `<div class="d-section"><h3 class="sub">Evidence</h3>` +
      (ev.length ? `<div class="evidence">${papersHtml(b, ev)}</div>`
        : `<p class="d-empty">No evidence yet. The agent is waiting for the document and will check it as soon as it arrives.</p>`) +
      `</div>` +
      (upd !== null ? `<p class="d-updated">Last updated day ${upd}</p>` : '') +
      `</section>`;
  }
  function completionHtml(b) {
    const reqs = arr(b.requirements);
    const v = verifyText();
    return `<section class="complete">` +
      `<div class="complete-mark">${icon('check')}</div>` +
      `<h2>File complete</h2>` +
      `<p class="complete-body">All ${reqs.length} checks are verified. The agent has stopped here because the credit decision belongs to a person.</p>` +
      `<ul class="sum-list">` + reqs.map((r) => {
        const s = statusOf(r.status);
        return `<li><span class="${s.cls}">${icon(s.icon)}</span><div><div class="s-title">${esc(r.title)}</div><div class="s-reason">${esc(r.reason)}</div></div></li>`;
      }).join('') + `</ul>` +
      `<div class="ledger-line"><span>Ledger: ${plural(arr(b.events).length, 'event')}, each linked to the one before.</span>` +
      `<button type="button" class="btn secondary sm" data-act="verify">Check ledger</button>` +
      `<span data-verify-slot class="verify-text ${v ? v.cls : ''}">${v ? esc(v.text) : ''}</span></div>` +
      `</section>`;
  }
  function renderCenter(b) {
    const open = openExc(b);
    let html;
    if (open.length) {
      html = open.map((x) => decisionCard(x, b)).join('') + resolvedHtml(b);
    } else if (isComplete(b)) {
      html = completionHtml(b) + resolvedHtml(b);
    } else {
      html = detailHtml(b, reqById(b, defaultSel(b))) + resolvedHtml(b);
    }
    $('center').innerHTML = html;
  }

  /* ---------- activity (right) ---------- */
  function prettyJson(v) {
    const p = parseMaybe(v);
    return typeof p === 'string' ? p : JSON.stringify(p, null, 2);
  }
  function renderReasoning(b, d) {
    const tr = arr(b.trace).slice().sort((x, y) => (y.seq ?? 0) - (x.seq ?? 0));
    if (!tr.length) { $('pane-reasoning').innerHTML = '<p class="empty">No agent steps yet.</p>'; return; }
    let html = '';
    let lastTime = null;
    tr.forEach((t) => {
      if (t.sim_time !== lastTime) {
        const day = dayOf(t.sim_time, b);
        html += `<h3 class="day-head">${day === null ? 'Undated' : `Day ${day}`}</h3>`;
        lastTime = t.sim_time;
      }
      const k = traceKey(t);
      const g = String(t.gate ?? '-');
      let gate = '';
      let blocked = false;
      if (g === 'ALLOW') gate = '<span class="gate allow">Allowed</span>';
      else if (g.startsWith('DENY')) {
        blocked = true;
        const rule = g.replace(/^DENY:?\s*/, '') || 'rule';
        const out = parseMaybe(t.output);
        const why = (out && typeof out === 'object' && (out.blocked || out.reason || out.error)) || (typeof t.output === 'string' ? t.output : g);
        gate = `<span class="gate deny" tabindex="0" data-tip="${esc(why)}">Blocked: ${esc(rule)}</span>`;
      }
      const hasIn = t.input !== undefined && t.input !== null && !(typeof t.input === 'object' && !Object.keys(t.input).length);
      const hasOut = t.output !== undefined && t.output !== null && t.output !== '';
      const body = `<div class="json-wrap">` +
        (hasIn ? `<div class="json-label">Input</div><pre class="json">${esc(prettyJson(t.input))}</pre>` : '') +
        (hasOut ? `<div class="json-label">Output</div><pre class="json">${esc(prettyJson(t.output))}</pre>` : '') +
        (!hasIn && !hasOut ? '<div class="json-label">No input or output recorded.</div>' : '') + '</div>';
      html += `<article class="step ${blocked ? 'blocked' : ''} ${d.newTrace.has(k) ? 'fresh' : ''}">` +
        `<p class="step-reason">${esc(plain(t.reason) || 'No reason recorded')}</p>` +
        `<div class="step-meta"><span>${esc(humanize(t.tool))}</span>${gate}${coll(`step:${k}`, 'Details', body, 'disc')}</div>` +
        `</article>`;
    });
    $('pane-reasoning').innerHTML = html;
  }
  function renderLedger(b) {
    const evs = arr(b.events).slice().sort((x, y) => (y.seq ?? 0) - (x.seq ?? 0));
    const v = verifyText();
    let html = `<div class="ledger-top"><button type="button" class="btn secondary sm" data-act="verify">Check integrity</button>` +
      `<span data-verify-slot class="verify-text ${v ? v.cls : ''}">${v ? esc(v.text) : ''}</span></div>`;
    if (!evs.length) html += '<p class="empty">No events yet.</p>';
    html += evs.map((e) => {
      const day = dayOf(e.sim_time, b);
      const who = e.actor && e.actor.type ? `${sentence(e.actor.type)}${e.actor.id ? ` (${e.actor.id})` : ''}` : '';
      let sum;
      if (e.type === 'AGENT_STEP') {
        const [tool, gate = '-'] = String(e.summary || '').split(/\s*(?:→|->)\s*/);
        sum = `Agent step: ${humanize(tool)}` +
          (gate === 'ALLOW' ? ', allowed' : gate.startsWith('DENY') ? `, blocked by ${gate.replace(/^DENY:?\s*/, '')}` : '');
      } else {
        sum = tidy(plain(e.summary)).replace(/(EX-\d+): ([a-z_]+)$/, (m, id, a) => `${id}: ${humanize(a)}`);
      }
      return `<div class="led" title="${esc(who)}"><div class="led-sum">${esc(sum)}</div>` +
        `<div class="led-day">${day === null ? '' : `Day ${day}`}</div>` +
        `<div class="led-hash" title="Event #${esc(e.seq)}: hash, then the previous event's hash"><b>${esc(shortHash(e.hash))}</b> ← ${esc(shortHash(e.prev_hash))}</div></div>`;
    }).join('');
    $('pane-ledger').innerHTML = html;
  }
  function renderTabs() {
    const b = S.bundle || {};
    $('tab-reasoning').innerHTML = `Agent reasoning<span class="n">${arr(b.trace).length}</span>`;
    $('tab-ledger').innerHTML = `Ledger<span class="n">${arr(b.events).length}</span>`;
    ['reasoning', 'ledger'].forEach((name) => {
      const on = S.tab === name;
      $(`tab-${name}`).setAttribute('aria-selected', String(on));
      $(`tab-${name}`).tabIndex = on ? 0 : -1;
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
    $('boot-msg').textContent = 'Loading case';
    $('boot-actions').hidden = true;
  }

  /* ---------------- actions ---------------- */
  async function run(btn, label, fn) {
    if (S.busy) return;
    if (MOCK) { toast(`Mock mode: "${label}" does nothing here`, 'info'); return; }
    S.busy = true;
    document.body.classList.add('is-busy');
    if (btn) { btn.classList.add('loading'); btn.setAttribute('aria-busy', 'true'); }
    try {
      await fn();
    } catch (err) {
      console.error(err);
      toast(`${label} failed: ${err.message || err}`, 'error');
    } finally {
      S.busy = false;
      document.body.classList.remove('is-busy');
      // btn may have been replaced by a re-render; clear the state on whatever is still in the DOM
      document.querySelectorAll('.loading').forEach((n) => { n.classList.remove('loading'); n.removeAttribute('aria-busy'); });
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
    const tab = e.target.closest('[data-tab]');
    if (tab) { S.tab = tab.dataset.tab; renderTabs(); return; }

    const btn = e.target.closest('[data-act]');
    if (!btn || btn.disabled) return;
    const act = btn.dataset.act;
    const id = (S.bundle && S.bundle.case && S.bundle.case.id) || CASE_ID;
    if (act !== 'reset' && S.resetArmed) disarmReset();

    if (act === 'select') {
      S.sel = btn.dataset.id;
      const b = S.bundle;
      renderChecklist(b);
      const exc = openExc(b).find((x) => x.requirement_id === S.sel);
      if (exc) {
        const card = $(`exc-${exc.id}`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'start' });
          card.classList.remove('focus'); void card.offsetWidth; card.classList.add('focus');
        }
      } else if (!openExc(b).length) {
        renderCenter(b);
        $('center').scrollTop = 0;
      }
    } else if (act === 'advance') {
      const days = Number(btn.dataset.days);
      run(btn, days === 7 ? 'Skip a week' : `Skip ${plural(days, 'day')}`, () => post(`/api/cases/${id}/advance`, { days }));
    } else if (act === 'inbound') {
      run(btn, 'Send', () => post(`/api/cases/${id}/inbound`, { item_id: btn.dataset.id }));
    } else if (act === 'resolve') {
      run(btn, 'Decision', async () => {
        await post(`/api/cases/${id}/exceptions/${encodeURIComponent(btn.dataset.exc)}/resolve`, { action_id: btn.dataset.action, note: '' });
        if (btn.dataset.req && !openExc(S.bundle).length) { S.sel = btn.dataset.req; renderChecklist(S.bundle); renderCenter(S.bundle); }
      });
    } else if (act === 'verify') {
      run(btn, 'Ledger check', async () => {
        S.verify = await api('GET', `/api/cases/${id}/verify`);
        renderVerify();
      });
    } else if (act === 'reset') {
      if (MOCK) { toast('Mock mode: "Reset demo" does nothing here', 'info'); return; }
      if (!S.resetArmed) {
        S.resetArmed = true;
        btn.classList.add('armed');
        btn.textContent = 'Click again to reset';
        S.resetTimer = setTimeout(disarmReset, 5000);
        return;
      }
      disarmReset();
      run(btn, 'Reset demo', async () => {
        S.tab = 'reasoning';
        S.sel = null;
        S.open.clear();
        await post('/api/demo/reset', {});
        toast('Demo reset to day 0', 'success');
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

  let resizeT = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { if (S.bundle) safe('rail', () => renderRail(S.bundle, { newlyFired: new Set(), reset: false })); }, 120);
  });
  document.addEventListener('click', onClick);
  $('boot-retry').addEventListener('click', load);
  load();
})();
