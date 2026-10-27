// JobPilot form filler. Runs on every page but only acts when:
//  - this tab was opened from the dashboard's "Review & Submit" (or a tab opened from it), or
//  - you click "Fill this page" in the popup / panel.
// It fills empty fields only, never overwrites what you typed, and NEVER clicks Submit.
(() => {
  if (window.__jobpilotLoaded) return;
  window.__jobpilotLoaded = true;

  const TOP = window === window.top;
  let ctx = null;          // { job, profile }
  let active = false;      // auto-fill mode for this page
  let paused = false;      // auto-fill paused because the page keeps reloading
  let applied = false;
  const ours = new WeakSet();
  const tried = new WeakSet();
  let running = false;
  let lastStats = { filled: 0, needs: [] };
  let host = null, panel = null;

  const ss = {
    get(k) { try { return sessionStorage.getItem('jobpilot_' + k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem('jobpilot_' + k, v); } catch (e) { /* ignore */ } }
  };

  const US_STATES = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia' };
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
  const visible = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const inPanel = el => host && (el === host || host.contains(el));

  // ---------- describe a field (its label / question text) ----------
  function labelText(el) {
    const parts = [];
    if (el.labels) for (const l of el.labels) parts.push(l.innerText);
    const lb = el.getAttribute('aria-labelledby');
    if (lb) lb.split(/\s+/).forEach(id => { const n = document.getElementById(id); if (n) parts.push(n.innerText); });
    parts.push(el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.getAttribute('title'));
    const fs = el.closest('fieldset');
    if (fs) { const lg = fs.querySelector('legend'); if (lg) parts.push(lg.innerText); }
    if (!clean(parts.join(' '))) {
      let c = el.parentElement;
      for (let i = 0; i < 4 && c; i++, c = c.parentElement) {
        const lab = c.querySelector('label, [class*="label"], [class*="question"], [data-automation-id*="formLabel"]');
        if (lab && !lab.contains(el)) { parts.push(lab.innerText); break; }
      }
    }
    return clean(parts.filter(Boolean).join(' ')).slice(0, 300);
  }
  function describe(el) {
    return (labelText(el) + ' ' + [el.name, el.id, el.getAttribute('autocomplete'), el.getAttribute('data-automation-id')].filter(Boolean).join(' '))
      .replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();
  }
  function isRequired(el) {
    return el.required || el.getAttribute('aria-required') === 'true' || /\*/.test(labelText(el));
  }
  // Old ASP.NET pages reload when certain fields change. Fill those without triggering the reload.
  function causesReload(el) {
    const h = (el.getAttribute('onchange') || '') + (el.getAttribute('onclick') || '');
    return /__doPostBack|\.submit\(|setTimeout\('__doPostBack/i.test(h);
  }

  // ---------- dates for job history / education ----------
  function dateFor(ym, el, d) {
    if (!ym) return null;
    const [y, m] = String(ym).split('-');
    const type = (el.type || '').toLowerCase();
    if (/\bmonth\b/.test(d) && !/year/.test(d)) return el.tagName === 'SELECT' ? MONTHS[+m - 1] : m;
    if (/\byear\b/.test(d) && !/month/.test(d)) return y;
    if (type === 'month') return `${y}-${m}`;
    if (type === 'date') return `${y}-${m}-01`;
    const ph = (el.getAttribute('placeholder') || '').toLowerCase();
    if (/yyyy-mm/.test(ph)) return `${y}-${m}`;
    if (/dd/.test(ph)) return `${m}/01/${y}`;
    return `${m}/${y}`;
  }

  // ---------- what goes where ----------
  // sec = { kind: 'exp'|'edu'|null, exp: {...}|null, edu: {...}|null } for the section this field is in
  function valueFor(d, el, p, job, sec) {
    const yn = v => v || '';
    const fullName = clean(`${p.firstName} ${p.lastName}`);
    if (/captcha|search|password|verification code|security code/.test(d)) return null;

    // Your saved answers win over everything below.
    for (const a of p.answers || []) {
      if (!a.answer) continue;
      const keys = String(a.match || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
      if (keys.some(k => d.includes(k))) return a.answer;
    }

    // Job history and education sections
    const e = sec && sec.exp, u = sec && sec.edu;
    // A form section for a job / school you didn't add in Profile: leave it empty.
    if (sec && sec.extra && /company|employer|organi[sz]ation|title|position|role|start|from|end|to\b|school|university|college|degree|major|field of study|gpa|location|description|responsibilit/.test(d)) return null;
    if (u && sec.kind === 'edu') {
      if (/school|university|college|institution/.test(d)) return u.school;
      if (/degree|qualification|level of education/.test(d)) return u.degree;
      if (/field of study|major|discipline|area of study|specialization/.test(d)) return u.field;
      if (/\bgpa\b|grade point/.test(d)) return u.gpa;
      if (/start|from/.test(d)) return dateFor(u.start, el, d);
      if (/end|to\b|graduat|completion/.test(d)) return dateFor(u.end, el, d);
    }
    if (e && sec.kind === 'exp') {
      if (/company|employer|organi[sz]ation/.test(d)) return e.company;
      if (/job title|position|role|title/.test(d)) return e.title;
      if (/location|city/.test(d)) return e.location;
      if (/start|from/.test(d)) return dateFor(e.start, el, d);
      if (/end|to\b/.test(d) && !e.current) return dateFor(e.end, el, d);
      if (el.tagName === 'TEXTAREA' && /description|responsibilit|duties|summary|accomplish/.test(d)) return e.description;
    }
    if (/school|university|college/.test(d) && (p.education || [])[0]) return p.education[0].school;
    if (/degree/.test(d) && (p.education || [])[0] && el.tagName !== 'TEXTAREA') return p.education[0].degree;

    if (/phone.*(extension|ext\b)|country.*(phone|code)|phone.*country|dial code/.test(d)) return null;
    if (/device type|phone type/.test(d)) return 'Mobile';
    if (/first[\s_-]*name|given[\s_-]*name|\bfname\b|legal first/.test(d)) return p.firstName;
    if (/last[\s_-]*name|family[\s_-]*name|surname|\blname\b|legal last/.test(d)) return p.lastName;
    if (/middle|preferred name|nickname/.test(d)) return null;
    if (/e-?mail/.test(d)) return p.email;
    if (/phone|mobile|\btel\b|cell/.test(d)) return p.phone;
    if (/linked\s*in/.test(d)) return p.linkedin;
    if (/github/.test(d)) return p.github;
    if (/website|portfolio|personal (url|site)|\bblog\b/.test(d)) return p.website || p.github;
    if (/address (line )?2|apt|suite/.test(d)) return null;

    // Common Yes/No questions
    if (/sponsor/.test(d)) return yn(p.needSponsorship);
    if (/authori[sz]|eligible to work|legally (able|permitted)|right to work/.test(d)) return yn(p.workAuthorized);
    if (/18 years|at least 18|over 18|over the age of 18|legal age/.test(d)) return yn(p.over18);
    if (/resident of|reside in|currently (live|living) in|located in/.test(d) && /\?|\*/.test(d)) {
      return /united states|\bu\.?s\.?a?\b|america/.test(d) ? 'Yes' : 'No';
    }
    if (/(previously|ever|have you|prior)\s+(been\s+)?(worked|employed)\s+(for|at|by|with)|former employee|worked (here|for us) before|current or former employee/.test(d)) return yn(p.workedHereBefore);
    if (/relative|family member/.test(d) && /employ|work/.test(d)) return yn(p.relativesHere);
    if (/background (check|investigation|screen)/.test(d)) return yn(p.backgroundCheck);
    if (/drug (test|screen)/.test(d)) return yn(p.drugTest);
    if (/willing to travel|ability to travel|able to travel|travel (up to|requirement)/.test(d)) return yn(p.willingTravel);
    if (/non-?compete|restrictive covenant|non-?solicit/.test(d)) return yn(p.nonCompete);
    if (/security clearance|active clearance/.test(d)) return yn(p.clearance);
    if (/relocat/.test(d)) return yn(p.willingRelocate);
    if (/years? of (professional |relevant |total )?experience|how many years/.test(d)) return p.yearsExperience;
    if (/(past|previous|prior|any|relevant) (work(ing)? )?experience/.test(d)) return yn(p.relatedExperience);

    if (/address|street/.test(d) && !/e-?mail/.test(d)) return p.address;
    if (/\bcity\b|\btown\b/.test(d)) return p.city;
    if (/\bstate\b|province|region/.test(d)) return p.state;
    if (/\bzip\b|postal/.test(d)) return p.zip;
    if (/country/.test(d)) return p.country;
    if (/salary|compensation|pay expectation|desired pay|expected pay|rate expectation/.test(d)) return p.salary;
    if (/notice period/.test(d)) return p.noticePeriod;
    if (/start date|available to start|availability|earliest/.test(d)) return p.startDate || p.noticePeriod;
    if (/how (did|do) you (hear|find|learn)|where did you (hear|find)|referral source|\bsource\b/.test(d)) return p.howHeard;
    if (/gender|\bsex\b/.test(d)) return p.gender;
    if (/race|ethnic|hispanic|latino/.test(d)) return p.race;
    if (/veteran/.test(d)) return p.veteran;
    if (/disabilit/.test(d)) return p.disability;
    const cur = (p.experience || [])[0] || {};
    if (/current (company|employer)|most recent (company|employer)|employer name/.test(d)) return p.currentCompany || cur.company;
    if (/current (job )?title|job title|position title|current role/.test(d)) return p.currentTitle || cur.title;
    if (el.tagName === 'TEXTAREA' && /cover letter|cover note|message to (the )?(hiring|recruiter)|additional information/.test(d))
      return (job && job.ai && job.ai.coverNote) || p.coverLetter;
    if (/full[\s_-]*name|^\s*name\b|\byour name\b|legal name/.test(d) && !/company|employer|user|reference|school|manager|recruiter/.test(d)) return fullName;
    return null;
  }

  // ---------- setting values the way React/Angular sites expect ----------
  function setNative(el, v, quiet) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    if (!quiet) {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));
    }
  }
  function bestOption(texts, value) {
    const v = clean(value).toLowerCase();
    if (!v) return -1;
    const alt = new Set([v]);
    for (const [ab, name] of Object.entries(US_STATES)) {
      if (v === ab.toLowerCase()) alt.add(name.toLowerCase());
      if (v === name.toLowerCase()) alt.add(ab.toLowerCase());
    }
    if (/^(united states|usa|us|u\.s\.)$/.test(v)) ['united states', 'united states of america', 'usa', 'us', 'u.s.'].forEach(x => alt.add(x));
    const t = texts.map(x => clean(x).toLowerCase());
    let i = t.findIndex(x => alt.has(x));
    if (i === -1) i = t.findIndex(x => [...alt].some(a => x.startsWith(a)));
    if (i === -1 && v.length > 3) i = t.findIndex(x => x.includes(v) || (x.length > 3 && v.includes(x)));
    if (i === -1 && /^(yes|no)$/.test(v)) i = t.findIndex(x => new RegExp('^' + v + '\\b').test(x));
    if (i === -1 && /decline|not (wish|want)|prefer not|not to (disclose|answer|say)/.test(v)) i = t.findIndex(x => /decline|not (wish|want)|prefer not|don.t wish|not to (disclose|answer|say|self)/.test(x));
    return i;
  }

  // Work out which job-history / education block each field belongs to (by page order).
  function sectionMap(els, p) {
    const map = new Map();
    let ei = -1, ui = -1, kind = null, since = 99;
    const exp = p.experience || [], edu = p.education || [];
    for (const el of els) {
      const d = describe(el);
      const box = el.closest('[class*="experience" i], [data-automation-id*="workExperience"], [id*="experience" i], [class*="employment" i], [class*="education" i], [data-automation-id*="education"], [id*="education" i]');
      const boxKind = box ? (/education/i.test((box.className || '') + box.id + (box.getAttribute('data-automation-id') || '')) ? 'edu' : 'exp') : null;
      since++;
      if (/school|university|college|institution/.test(d)) { ui++; kind = 'edu'; since = 0; }
      else if (/company|employer/.test(d) && !/current|most recent|how did|hear/.test(d) && (boxKind === 'exp' || exp.length)) { ei++; kind = 'exp'; since = 0; }
      const k = boxKind || (since <= 8 ? kind : null);
      map.set(el, { kind: k, exp: k === 'exp' ? exp[Math.max(0, ei)] || null : null, edu: k === 'edu' ? edu[Math.max(0, ui)] || null : null,
        extra: (k === 'exp' && ei >= exp.length) || (k === 'edu' && ui >= edu.length) });
    }
    return map;
  }

  // Each question is answered once per page. If the site redraws a field, JobPilot will not touch it again
  // (so it never fights with the page or undoes your changes). "Fill this page" starts over.
  const doneKey = () => 'done|' + location.pathname;
  let done = new Set();
  try { done = new Set(JSON.parse(ss.get(doneKey()) || '[]')); } catch (e) { done = new Set(); }
  const saveDone = () => ss.set(doneKey(), JSON.stringify([...done].slice(-400)));
  const keyOf = (kind, txt, name) => kind + '|' + clean(txt).toLowerCase().slice(0, 100) + '|' + (name || '');
  let autoRuns = 0;

  async function fillPage(opts = {}) {
    if (!ctx || !ctx.profile || running) return lastStats;
    running = true;
    try { return await fillPageInner(opts); } finally { running = false; saveDone(); }
  }
  async function fillPageInner(opts = {}) {
    if (opts.manual) { done = new Set(); saveDone(); }
    const p = ctx.profile, job = ctx.job;
    let filled = 0;
    const needs = [];

    const els = [...document.querySelectorAll('input, textarea, select')].filter(el => !inPanel(el));
    const sections = sectionMap(els, p);
    const radioGroups = new Map();
    for (const el of els) {
      if (el.disabled || el.readOnly || !visible(el) && el.type !== 'file') continue;
      const type = (el.type || '').toLowerCase();
      if (['hidden', 'submit', 'button', 'password', 'image', 'reset', 'search'].includes(type)) continue;
      if (type === 'radio') { const k = el.name || el.id; if (!radioGroups.has(k)) radioGroups.set(k, []); radioGroups.get(k).push(el); continue; }
      if (el.getAttribute('role') === 'combobox' && el.tagName === 'INPUT') continue; // handled with custom dropdowns
      const d = describe(el);
      const sec = sections.get(el);
      const quiet = causesReload(el);
      const fk = keyOf('f', d, el.name);
      if (done.has(fk)) { filled++; continue; }

      if (type === 'checkbox') {
        // Only tick "I currently work here" for your current job.
        if (!el.checked && sec && sec.kind === 'exp' && sec.exp && sec.exp.current && /current(ly)? (work|employ|role|position)|i work here|present/.test(d)) { el.click(); ours.add(el); done.add(fk); filled++; }
        continue;
      }

      if (type === 'file') {
        if (!/resume|\bcv\b|curriculum/.test(d) || el.files?.length || ours.has(el)) continue;
        const r = (p.resumes || []).find(x => x.dataUrl);
        if (!r) { needs.push({ el, label: 'Resume upload' }); continue; }
        try {
          const blob = await (await fetch(r.dataUrl)).blob();
          const dt = new DataTransfer();
          dt.items.add(new File([blob], r.name || 'resume.pdf', { type: r.type || blob.type }));
          el.files = dt.files;
          if (!quiet) { el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
          ours.add(el); done.add(fk); filled++;
        } catch (e) { needs.push({ el, label: 'Resume upload' }); }
        continue;
      }

      const v = valueFor(d, el, p, job, sec);
      if (el.tagName === 'SELECT') {
        const cur = el.options[el.selectedIndex];
        const empty = !cur || !cur.value || /select|choose|--/i.test(cur.text);
        if (empty && v) {
          const i = bestOption([...el.options].map(o => o.text), v);
          if (i > 0 || (i === 0 && el.options[0].value)) {
            el.selectedIndex = i;
            if (!quiet) el.dispatchEvent(new Event('change', { bubbles: true }));
            ours.add(el); done.add(fk); filled++; continue;
          }
        }
        if (empty && isRequired(el)) needs.push({ el, label: labelText(el) || 'Dropdown' });
        else if (!empty && ours.has(el)) filled++;
        continue;
      }
      if (el.value) { if (ours.has(el)) filled++; continue; }
      if (v) { setNative(el, v, quiet); ours.add(el); done.add(fk); filled++; }
      else if (isRequired(el)) needs.push({ el, label: labelText(el) || 'Field' });
    }

    // Choice groups: radio buttons (native or role="radio") and "choose all that apply" checkboxes.
    const optText = o => clean((o.labels && o.labels[0] ? o.labels[0].innerText : '') || o.getAttribute('aria-label') || o.innerText || o.value || '');
    const groupRoot = list => {
      let r = list[0].parentElement;
      while (r && r !== document.body && !list.every(x => r.contains(x))) r = r.parentElement;
      return r || document.body;
    };
    const questionOf = (root, list) => {
      const lb = root.getAttribute && root.getAttribute('aria-labelledby');
      if (lb) { const t = lb.split(/\s+/).map(id => document.getElementById(id)?.innerText || '').join(' '); if (clean(t)) return clean(t); }
      const lg = root.querySelector && root.querySelector('legend'); if (lg && clean(lg.innerText)) return clean(lg.innerText);
      if (root.getAttribute && root.getAttribute('aria-label')) return clean(root.getAttribute('aria-label'));
      let t = root.innerText || '';
      for (const o of list) { const ot = optText(o); if (ot) t = t.split(ot).join(' '); }
      t = clean(t);
      if (t.length < 4) {   // question text sits just above the options
        let prev = root.previousElementSibling, hops = 0;
        while (prev && !clean(prev.innerText) && hops++ < 3) prev = prev.previousElementSibling;
        if (prev) t = clean(prev.innerText);
      }
      return t.slice(0, 220);
    };
    const groups = [];
    for (const [, radios] of radioGroups) groups.push({ kind: 'radio', opts: radios });
    const ariaRadios = [...document.querySelectorAll('[role="radio"]')].filter(o => visible(o) && !inPanel(o));
    const seenAria = new Set();
    for (const o of ariaRadios) {
      if (seenAria.has(o)) continue;
      const rg = o.closest('[role="radiogroup"]');
      const opts = rg ? ariaRadios.filter(x => rg.contains(x)) : [o, ...ariaRadios.filter(x => x !== o && x.parentElement?.parentElement === o.parentElement?.parentElement)];
      opts.forEach(x => seenAria.add(x));
      groups.push({ kind: 'aria', opts, root: rg });
    }
    const boxes = els.filter(el => (el.type || '').toLowerCase() === 'checkbox' && visible(el));
    const boxSeen = new Set();
    for (const cb of boxes) {
      if (boxSeen.has(cb)) continue;
      let r = cb.parentElement, members = [cb];
      for (let i = 0; i < 6 && r; i++, r = r.parentElement) {
        const inside = boxes.filter(x => r.contains(x));
        if (inside.length >= 2) { members = inside; break; }
      }
      members.forEach(x => boxSeen.add(x));
      if (members.length >= 2) groups.push({ kind: 'check', opts: members });
    }
    for (const g of groups) {
      const isOn = o => g.kind === 'aria' ? o.getAttribute('aria-checked') === 'true' : o.checked;
      const root = g.root || groupRoot(g.opts);
      const q = questionOf(root, g.opts);
      const gk = keyOf('g', q, g.opts[0].name);
      if (done.has(gk)) { filled++; continue; }
      if (g.opts.some(isOn)) { done.add(gk); continue; }   // already answered (by you or the site)
      const gd = (q + ' ' + (g.opts[0].name || '')).toLowerCase();
      // Checkbox groups: only fill ones we clearly understand (race / ethnicity), never consent boxes.
      if (g.kind === 'check' && !/race|ethnic/.test(gd)) continue;
      const v = valueFor(gd, g.opts[0], p, job, sections.get(g.opts[0]));
      const labels = g.opts.map(optText);
      const i = v ? bestOption(labels, v) : -1;
      if (i >= 0) {
        const o = g.opts[i];
        if (g.kind !== 'aria' && causesReload(o)) o.checked = true; else o.click();
        ours.add(o); done.add(gk); filled++;
      } else if (g.opts.some(isRequired) || /\*/.test(q)) needs.push({ el: g.opts[0], label: q.slice(0, 80) || 'Choice' });
    }

    // Special dropdowns (Workday, IBM, React-Select and others that aren't real <select> boxes)
    const customs = [...new Set(document.querySelectorAll('button[aria-haspopup="listbox"], [role="combobox"], [aria-haspopup="listbox"]'))]
      .filter(c => !inPanel(c) && c.tagName !== 'SELECT' && !c.closest('select'));
    for (const c of customs) {
      if (!visible(c) || ours.has(c) || tried.has(c)) continue;
      // Skip a wrapper when its inner control is also in the list.
      if (customs.some(o => o !== c && c.contains(o))) continue;
      const curText = clean(c.tagName === 'INPUT' ? c.value : c.innerText).toLowerCase();
      if (curText && !/^(select|choose|--|please select|select an option|select one)/.test(curText)) continue;
      tried.add(c);
      const d = describe(c);
      const ck = keyOf('c', d, c.getAttribute('name') || c.id);
      if (done.has(ck)) { filled++; continue; }
      const v = valueFor(d, c, p, job, sections.get(c) || null);
      if (!v) { if (isRequired(c)) needs.push({ el: c, label: labelText(c) || 'Dropdown' }); continue; }
      if (c.tagName === 'INPUT') { c.focus(); setNative(c, v, true); } else c.click();
      await sleep(500);
      const listId = c.getAttribute('aria-controls') || c.getAttribute('aria-owns');
      const scope = (listId && document.getElementById(listId)) || document;
      let opts = [...scope.querySelectorAll('[role="option"], [role="listbox"] li, li[class*="option" i], div[class*="option" i]')]
        .filter(o => visible(o) && !inPanel(o) && clean(o.innerText).length && clean(o.innerText).length < 120);
      const i = bestOption(opts.map(o => o.innerText), v);
      if (i >= 0) { opts[i].scrollIntoView({ block: 'nearest' }); opts[i].click(); ours.add(c); done.add(ck); filled++; }
      else {
        document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        done.add(ck);   // tried once; leave it for you
        needs.push({ el: c, label: labelText(c) || 'Dropdown' });
      }
      await sleep(250);
    }

    lastStats = { filled, needs };
    if (filled) markFilled();
    renderPanel();
    return lastStats;
  }

  // ---------- "thank you for applying" detection ----------
  const DONE_RE = /thank(s| you) for (applying|your application|submitting)|application (has been |was )?(submitted|received|sent)|we('ve| have) received your application|your application is complete|successfully (submitted|applied)/i;
  function checkApplied() {
    if (!active || applied || !TOP || !ctx?.job) return;
    const t = (document.body?.innerText || '').slice(0, 20000);
    if (DONE_RE.test(t)) {
      applied = true;
      chrome.runtime.sendMessage({ type: 'setStatus', status: 'applied' });
      renderPanel();
    }
  }

  // ---------- side tab + panel (closed by default) ----------
  function renderPanel() {
    if (!TOP || !ctx || ss.get('hidden') === '1') return;
    if (!panel) {
      host = document.createElement('div');
      host.style.cssText = 'position:fixed;right:0;top:35%;z-index:2147483647;';
      document.documentElement.appendChild(host);
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>
        :host{all:initial}
        .wrap{display:flex;align-items:flex-start;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;color:#15181E}
        .tab{position:relative;width:30px;height:64px;background:#15181E;color:#fff;border:0;border-radius:10px 0 0 10px;cursor:pointer;font-size:18px;box-shadow:-2px 2px 10px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center}
        .dot{position:absolute;top:6px;left:6px;width:8px;height:8px;border-radius:50%;background:#F59E0B;display:none}
        .dot.on{display:block}
        .w{width:300px;background:#fff;border:1px solid #D5D9E0;border-right:0;border-radius:0 0 0 12px;box-shadow:-6px 6px 24px rgba(0,0,0,.16);overflow:hidden;display:none}
        .open .w{display:block}
        .h{background:#15181E;color:#fff;padding:10px 12px;display:flex;align-items:flex-start;gap:8px}
        .h b{font-size:14px}.h small{display:block;color:#C9CED7;font-size:12px;margin-top:2px}
        .x{margin-left:auto;background:none;border:0;color:#C9CED7;font-size:16px;cursor:pointer;min-width:28px;min-height:28px}
        .b{padding:12px;display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow:auto}
        .s{background:#F4F6FC;border-radius:8px;padding:8px 10px;font-weight:600}
        .n{background:#FFF8F1;border:1px solid #F3D9BF;border-radius:8px;padding:8px 10px}
        .n b{color:#8A3B00}.n button{display:block;text-align:left;background:none;border:0;color:#8A3B00;padding:3px 0;cursor:pointer;font:13px system-ui,sans-serif;text-decoration:underline}
        .ok{background:#E3F3E9;color:#1E5E38;border-radius:8px;padding:8px 10px;font-weight:600}
        .warn{background:#FFF8F1;color:#8A3B00;border-radius:8px;padding:8px 10px;font-size:13px}
        .row{display:flex;gap:6px}
        .btn{flex:1;min-height:36px;border-radius:8px;border:1px solid #D5D9E0;background:#fff;font:600 13px system-ui,sans-serif;cursor:pointer;color:#15181E}
        .p{background:#2347C6;color:#fff;border:0}
        .f{font-size:12px;color:#5B6270;text-align:center}
      </style><div class="wrap"><button class="tab" aria-label="Open JobPilot panel"><span class="dot"></span><span class="ar">‹</span></button>
        <div class="w"><div class="h"><div><b>JobPilot</b><small class="t"></small></div><button class="x c" aria-label="Turn JobPilot off on this tab" title="Turn off on this tab">✕</button></div><div class="b"></div></div></div>`;
      panel = root;
      const wrap = root.querySelector('.wrap');
      if (ss.get('open') === '1') wrap.classList.add('open');
      root.querySelector('.tab').onclick = () => {
        wrap.classList.toggle('open');
        ss.set('open', wrap.classList.contains('open') ? '1' : '0');
        root.querySelector('.ar').textContent = wrap.classList.contains('open') ? '›' : '‹';
      };
      root.querySelector('.ar').textContent = wrap.classList.contains('open') ? '›' : '‹';
      root.querySelector('.c').onclick = () => { ss.set('hidden', '1'); host.remove(); panel = null; host = null; active = false; };
    }
    const job = ctx.job;
    panel.querySelector('.dot').classList.toggle('on', lastStats.needs.length > 0 || paused);
    panel.querySelector('.t').textContent = job ? `${job.title} · ${job.company}${job.score != null ? ' · ' + job.score + '% match' : ''}` : 'Filling with your profile';
    const b = panel.querySelector('.b');
    const needs = lastStats.needs.slice(0, 8);
    b.innerHTML = `
      ${applied ? '<div class="ok">✓ Application detected as submitted. Marked Applied.</div>' : ''}
      ${paused ? '<div class="warn">Auto-fill paused: this page keeps reloading. Click "Fill this page" to fill it once.</div>' : ''}
      <div class="s">${lastStats.filled} field${lastStats.filled === 1 ? '' : 's'} filled on this page</div>
      ${needs.length ? `<div class="n"><b>Needs you (${lastStats.needs.length})</b></div>` : ''}
      <div class="row"><button class="btn p fill">Fill this page</button></div>
      ${job ? '<div class="row"><button class="btn later">Save for later</button><button class="btn done">Mark applied</button></div>' : ''}
      <div class="f">Check every field, then click the site's Submit button yourself.</div>`;
    const nbox = b.querySelector('.n');
    needs.forEach(nd => {
      const bt = document.createElement('button');
      bt.textContent = nd.label.slice(0, 70);
      bt.onclick = () => { nd.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); nd.el.focus?.(); };
      nbox.appendChild(bt);
    });
    b.querySelector('.fill').onclick = () => { active = true; paused = false; ss.set('loopCount', '0'); fillPage({ manual: true }); };
    const later = b.querySelector('.later');
    if (later) later.onclick = () => { chrome.runtime.sendMessage({ type: 'setStatus', status: 'started' }); later.textContent = 'Saved'; };
    const done = b.querySelector('.done');
    if (done) done.onclick = () => { chrome.runtime.sendMessage({ type: 'setStatus', status: 'applied' }); applied = true; renderPanel(); };
  }

  // ---------- startup ----------
  let timer = null;
  let lastHref = location.href;
  function schedule(muts) {
    if (muts && muts.every(m => inPanel(m.target))) return;
    if (location.href !== lastHref) {   // next step of a one-page application
      lastHref = location.href; autoRuns = 0;
      try { done = new Set(JSON.parse(ss.get(doneKey()) || '[]')); } catch (e) { done = new Set(); }
    }
    clearTimeout(timer);
    timer = setTimeout(() => { if (active && !paused && !applied && autoRuns++ < 8) fillPage(); checkApplied(); }, 1200);
  }

  // Pause only for a real loop: the same page reloading within a few seconds of JobPilot filling it, twice in a row.
  function reloadGuard() {
    const here = location.href.split('#')[0];
    const lastFill = +(ss.get('fillAt') || 0), lastUrl = ss.get('fillUrl') || '';
    let n = +(ss.get('loopCount') || 0);
    if (lastUrl === here && Date.now() - lastFill < 8000) n++; else n = 0;
    ss.set('loopCount', String(n));
    return n >= 2;
  }
  function markFilled() { ss.set('fillAt', String(Date.now())); ss.set('fillUrl', location.href.split('#')[0]); }

  async function start(force) {
    try { ctx = await chrome.runtime.sendMessage({ type: 'getApplyContext' }); } catch (e) { return; }
    if (!ctx) return;
    if (!force && ss.get('hidden') === '1') return;
    if (ctx.job || force) {
      active = true;
      if (!force && TOP && ctx.job) paused = reloadGuard();
      if (!paused) setTimeout(() => fillPage(), 1500); else renderPanel();
      new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
      setTimeout(checkApplied, 800);
      setInterval(checkApplied, 2500);
    }
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'fillNow') {
      ss.set('hidden', '0');
      if (!ctx) start(true); else { active = true; fillPage(); }
    }
  });

  start(false);
})();
