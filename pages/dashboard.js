import { getAll, save, updateJob } from '../shared/store.js';
import { DEFAULT_SKILL_GROUPS, DEFAULT_SETTINGS, DEFAULT_COMPANIES } from '../shared/defaults.js';
import { compileGroups, findSkills } from '../shared/match.js';
import { SITE_LABELS } from '../shared/sources.js';
import * as pdfjs from '../lib/pdf.min.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdf.worker.min.mjs');

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const send = msg => chrome.runtime.sendMessage(msg);
let data = null;
let view = 'jobs';
let openJob = null;
const f = { q: '', platform: 'all', status: 'open', showLow: false, showRemoved: false };

function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2600); }
function ago(ts) {
  if (!ts) return '—';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return 'just now'; if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60); if (h < 48) return h + 'h ago';
  return Math.round(h / 24) + 'd ago';
}
const clock = ts => ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
const STATUS_LABEL = { new: 'New', started: 'Started', applied: 'Applied', skipped: 'Skipped', expired: 'Expired', interview: 'Interview', rejected: 'Rejected' };

async function load() {
  data = await getAll();
  const al = await chrome.alarms.get('scan');
  if (al) data.meta.nextScanAt = al.scheduledTime;
}

// ---------------- header ----------------
function renderStatus() {
  const m = data.meta, s = data.settings;
  let dot = s.enabled ? '' : 'off', text;
  if (m.scanning) { dot = 'busy'; text = m.scanProgress || 'Scanning…'; }
  else text = (s.enabled ? 'Auto-scan on' : 'Auto-scan off') + ` · Last scan ${m.lastScan ? clock(m.lastScan) : 'never'}` + (s.enabled && m.nextScanAt ? ` · Next ${clock(m.nextScanAt)}` : '');
  $('#status').innerHTML = `<span class="dot ${dot}"></span>${esc(text)}`;
  $('#scanNow').disabled = !!m.scanning;
  document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === view));
}

// ---------------- jobs ----------------
function renderJobs() {
  const s = data.settings;
  const all = Object.values(data.jobs);
  const count = st => all.filter(j => j.status === st).length;
  const reasons = {};
  data.removed.forEach(r => { reasons[r.reason] = (reasons[r.reason] || 0) + 1; });
  const reasonText = Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([k, v]) => `${k} ${v}`).join(' · ');

  const warnings = [];
  if (!(data.profile.resumes || []).length) warnings.push(`No resume yet — <a href="#profile">upload it in Profile</a> so jobs can be scored and filled.`);
  const coBad = (data.settings.companies || []).filter(c => c.enabled && data.meta.companyStatus?.[c.url] && !data.meta.companyStatus[c.url].ok).length;
  if (data.settings.sites.company && coBad) warnings.push(`<b>${coBad} company site${coBad > 1 ? 's' : ''}</b> couldn't be read. See <a href="#settings">Settings → Company career sites</a> (marked ✗).`);
  for (const [k, v] of Object.entries(data.meta.siteStatus || {})) {
    if (k.startsWith('co:') || (!data.settings.sites[k])) continue;
    if (v && !v.ok) {
      const name = k.startsWith('co:') ? k.slice(3) : (SITE_LABELS[k] || k);
      warnings.push(`<b>${esc(name)}:</b> ${esc(v.message)}. Open the site in Chrome, sign in or finish the check, then click Scan now.`);
    }
  }
  const le = data.meta.lastEmail;
  if (data.settings.email.enabled) warnings.push(le ? (le.ok ? `<span style="color:#5B6270">Last email: ${new Date(le.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} · ${le.count} jobs</span>` : `<b>Email failed:</b> ${esc(le.error)}`) : '<span style="color:#5B6270">Last email: none yet (sent after a scan finds new matches)</span>');
  if (data.meta.lastScanSummary) warnings.push(`<span style="color:#5B6270">Last scan: ${esc(data.meta.lastScanSummary)}</span>`);

  let list = all.filter(j => {
    if (f.platform !== 'all' && j.source !== f.platform) return false;
    if (f.status === 'open' && !['new', 'started'].includes(j.status)) return false;
    if (f.status !== 'open' && f.status !== 'all' && j.status !== f.status) return false;
    if (f.q && !(j.title + ' ' + j.company).toLowerCase().includes(f.q.toLowerCase())) return false;
    return true;
  });
  const low = list.filter(j => j.score != null && j.score < s.minMatch);
  if (!f.showLow) list = list.filter(j => !(j.score != null && j.score < s.minMatch));
  list.sort((a, b) => ((a.source === 'company' ? 0 : 1) - (b.source === 'company' ? 0 : 1)) || (b.score ?? -1) - (a.score ?? -1) || b.foundAt - a.foundAt);

  const row = j => {
    const st = j.status;
    const dim = ['skipped', 'expired', 'rejected'].includes(st);
    let act = '';
    if (st === 'new') act = `<button class="btn primary small" data-act="apply" data-id="${esc(j.id)}">Review &amp; Submit</button><button class="btn small" data-act="skip" data-id="${esc(j.id)}">Skip</button>`;
    else if (st === 'started') act = `<button class="btn primary small" data-act="apply" data-id="${esc(j.id)}">Continue</button><button class="btn small" data-act="applied" data-id="${esc(j.id)}">Mark applied</button>`;
    else if (st === 'skipped') act = `<button class="btn small" data-act="undo" data-id="${esc(j.id)}">Undo</button>`;
    else act = `<button class="btn small" data-act="open" data-id="${esc(j.id)}">View</button>`;
    const notes = [...(j.flags || []).map(x => `<span class="flag">${esc(x)}</span>`)];
    if (j.missing?.length) notes.push(`<span class="co">Missing: ${esc(j.missing.filter(m => m.important).slice(0, 2).map(m => m.name).join(', ') || j.missing[0].name)}</span>`);
    return `<tr class="${dim ? 'dim' : ''}">
      <td><button class="jt" data-act="open" data-id="${esc(j.id)}">${esc(j.title)}</button><div class="co">${esc(j.company)}${j.location ? ' · ' + esc(j.location) : ''}</div></td>
      <td><span class="plat" ${j.source === 'company' ? 'style="background:#E3F3E9;color:#1E5E38"' : ''}>${esc(SITE_LABELS[j.source] || j.source)}</span></td>
      <td>${j.score == null ? '<span class="co" title="No known skills found in this description">—</span>' : `<div class="mono">${j.score}%</div><div class="meter"><i style="width:${j.score}%"></i></div>`}</td>
      <td class="co">${esc(j.posted || ago(j.foundAt))}</td>
      <td>${notes.join(' ') || '<span class="co">—</span>'}</td>
      <td><span class="pill s-${st}">${STATUS_LABEL[st] || st}${st === 'applied' && j.statusAt ? ' · ' + new Date(j.statusAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : ''}</span></td>
      <td><div class="actions">${act}</div></td></tr>`;
  };

  const removedTable = () => `<div class="tablebox"><table><thead><tr><th>Job</th><th>Platform</th><th>Removed because</th><th style="text-align:right">Action</th></tr></thead><tbody>
    ${data.removed.slice(0, 300).map(r => `<tr><td><a href="${esc(r.url)}" target="_blank" rel="noopener" style="font-weight:600;color:#15181E">${esc(r.title)}</a><div class="co">${esc(r.company)}</div></td>
      <td><span class="plat">${esc(SITE_LABELS[r.source] || r.source)}</span></td><td><span class="flag">${esc(r.reason)}</span></td>
      <td><div class="actions"><button class="btn small" data-act="restore" data-id="${esc(r.id)}">Put back on my list</button></div></td></tr>`).join('') || '<tr><td colspan="4" class="empty">Nothing removed yet.</td></tr>'}
    </tbody></table></div>`;

  $('#view').innerHTML = `
    <div><h1>Job queue</h1><p class="sub">Company career-site jobs first, then job portals. Best match first in each. Jobs below ${s.minMatch}% are hidden.</p></div>
    ${warnings.length ? `<div class="${warnings.some(w => w.includes('<b>') || w.includes('No resume')) ? 'warnbox' : 'note'}">${warnings.join('<br>')}</div>` : ''}
    <div class="stats">
      <div class="stat"><div class="l">On your list</div><div class="v">${all.length}</div></div>
      <div class="stat"><div class="l">New</div><div class="v" style="color:#2347C6">${count('new')}</div></div>
      <div class="stat"><div class="l">Started</div><div class="v" style="color:#8A5A00">${count('started')}</div></div>
      <div class="stat"><div class="l">Applied</div><div class="v" style="color:#1E7A46">${count('applied')}</div></div>
      <div class="stat"><div class="l">Skipped / expired</div><div class="v" style="color:#5B6270">${count('skipped') + count('expired')}</div></div>
      <button class="stat warn" data-act="toggleRemoved" style="text-align:left;cursor:pointer;font:inherit"><div class="l">Removed by filters</div><div class="v">${data.removed.length}</div><small>${esc(reasonText || 'Click to view')}</small></button>
    </div>
    ${f.showRemoved ? `<div style="display:flex;align-items:center;gap:10px"><h2 style="margin:0">Removed by your filters</h2><button class="btn small" data-act="toggleRemoved">Back to job queue</button></div>${removedTable()}` : `
    <div class="bar">
      <input type="search" class="grow" id="fq" placeholder="Search title or company" aria-label="Search title or company" value="${esc(f.q)}">
      <label>Platform <select id="fp"><option value="all">All</option>${Object.entries(SITE_LABELS).map(([k, v]) => `<option value="${k}" ${f.platform === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Status <select id="fs">${[['open', 'New + Started'], ['all', 'All'], ['new', 'New'], ['started', 'Started'], ['applied', 'Applied'], ['interview', 'Interview'], ['rejected', 'Rejected'], ['skipped', 'Skipped']].map(([k, v]) => `<option value="${k}" ${f.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label><input type="checkbox" id="fl" ${f.showLow ? 'checked' : ''}> Show low matches (${low.length})</label>
    </div>
    <div class="tablebox"><table><thead><tr><th>Job</th><th>Platform</th><th>Match</th><th>Posted</th><th>Notes</th><th>Status</th><th style="text-align:right">Action</th></tr></thead>
    <tbody>${list.map(row).join('') || `<tr><td colspan="7" class="empty">${all.length ? 'No jobs match these filters.' : 'No jobs yet. Click <b>Scan now</b> or wait for the next scheduled scan.'}</td></tr>`}</tbody></table></div>
    <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center"><span class="co">Showing ${list.length} of ${all.length} · Duplicates across sites are merged · "Applied" is set automatically when a thank-you page is detected</span>
      <button class="btn small" data-act="clearJobs">Clear all jobs</button></div>`}`;

  $('#fq')?.addEventListener('input', e => { f.q = e.target.value; const pos = e.target.selectionStart; renderJobs(); const n = $('#fq'); n.focus(); n.setSelectionRange(pos, pos); });
  $('#fp')?.addEventListener('change', e => { f.platform = e.target.value; renderJobs(); });
  $('#fs')?.addEventListener('change', e => { f.status = e.target.value; renderJobs(); });
  $('#fl')?.addEventListener('change', e => { f.showLow = e.target.checked; renderJobs(); });
}

function renderDrawer() {
  const j = data.jobs[openJob];
  if (!j) { closeDrawer(); return; }
  const s = j.score;
  const circ = 2 * Math.PI * 40;
  const aiOn = data.settings.ai.enabled && data.settings.ai.apiKey;
  $('#drawer').innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">
      <div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px"><span class="plat">${esc(SITE_LABELS[j.source] || j.source)}</span><span class="pill s-${j.status}">${STATUS_LABEL[j.status]}</span></div>
        <h1 style="font-size:22px">${esc(j.title)}</h1>
        <p class="sub">${esc(j.company)}${j.location ? ' · ' + esc(j.location) : ''} · ${esc(j.posted || 'found ' + ago(j.foundAt))} · <a href="${esc(j.url)}" target="_blank" rel="noopener">Open original posting</a>${j.applyUrl ? ` · <a href="${esc(j.applyUrl)}" target="_blank" rel="noopener">Apply on company site</a>` : ''}</p>
      </div>
      <button class="btn" data-act="close" aria-label="Close">✕</button>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:14px 0">
      ${['new', 'started'].includes(j.status) ? `<button class="btn primary" data-act="apply" data-id="${esc(j.id)}">${j.status === 'new' ? 'Review &amp; Submit' : 'Continue application'}</button>` : ''}
      <label class="fl" style="flex-direction:row;align-items:center;gap:8px">Status
        <select id="dstatus">${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${j.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </div>
    <div class="dgrid">
      <div class="card" style="display:flex;align-items:center;gap:16px">
        <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="40" fill="none" stroke="#E8EBF0" stroke-width="9"/>${s != null ? `<circle cx="48" cy="48" r="40" fill="none" stroke="#2347C6" stroke-width="9" stroke-linecap="round" stroke-dasharray="${(circ * s / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 48 48)"/>` : ''}<text x="48" y="55" text-anchor="middle" font-family="Consolas,monospace" font-size="20" font-weight="600" fill="#15181E">${s == null ? '—' : s + '%'}</text></svg>
        <div><b style="font-size:16px">${s == null ? 'Could not score' : s >= 75 ? 'Strong match' : s >= 55 ? 'Good match' : 'Weak match'}</b>
        <div class="co">${(j.matched || []).length} of ${(j.matched || []).length + (j.missing || []).length} skills found in your resume${j.years ? ` · asks ${j.years}+ yrs` : ''}</div>
        ${(j.flags || []).map(x => `<span class="flag" style="margin-top:6px">${esc(x)}</span>`).join('')}</div>
      </div>
      <div class="card">
        <h2>Skills you have</h2>
        ${(j.matched || []).map(x => `<span class="chip have">${esc(x)}</span>`).join('') || '<span class="co">None found</span>'}
        <h2 style="margin-top:10px">Missing from your resume</h2>
        ${(j.missing || []).map(x => `<span class="chip miss">${esc(x.name)}${x.important ? ' *' : ''} <button data-act="haveSkill" data-skill="${esc(x.name)}" title="Count this as a skill you have">+ I have it</button></span>`).join('') || '<span class="co">Nothing missing</span>'}
        <p class="hint" style="margin:6px 0 0">* = in the title or required section. Click "+ I have it" only if it's true; it updates every score.</p>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap"><h2 style="margin:0">AI check &amp; tailored resume bullets</h2>
        ${aiOn ? `<button class="btn" data-act="ai" data-id="${esc(j.id)}">${j.ai ? 'Run again' : 'Run AI check'}</button>` : `<span class="co">Optional. Add an API key in <a href="#settings">Settings</a> to use it.</span>`}</div>
      ${j.ai ? `<p style="margin:10px 0 6px"><b>AI score ${esc(j.ai.score)}%</b> — ${esc(j.ai.summary || '')}</p>
        ${(j.ai.missingMustHaves || []).length ? `<div class="co">Must-haves missing: ${esc(j.ai.missingMustHaves.join(', '))}</div>` : ''}
        <div class="lab" style="margin-top:12px">Tailored bullets (copy into your resume)</div>
        <ul style="margin:6px 0">${(j.ai.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>
        <button class="btn small" data-act="copy" data-text="${esc((j.ai.bullets || []).map(b => '• ' + b).join('\n'))}">Copy bullets</button>
        <div class="lab" style="margin-top:12px">Cover note (used for cover-letter boxes on this job)</div>
        <div class="desc" style="max-height:200px">${esc(j.ai.coverNote || '')}</div>` : ''}
    </div>
    <h2 style="margin-top:18px">Job description</h2>
    <div class="desc">${esc(j.description || 'No description captured.')}</div>`;
  $('#dstatus').addEventListener('change', async e => { await updateJob(j.id, { status: e.target.value }); send({ type: 'refreshBadge' }); });
}
function openDrawer(id) { openJob = id; $('#overlay').classList.add('on'); renderDrawer(); }
function closeDrawer() { openJob = null; $('#overlay').classList.remove('on'); }

// ---------------- settings ----------------
let _secret = null;
function pendingSecret() { return _secret || (_secret = crypto.randomUUID().replace(/-/g, '')); }
function gasScript(secret) {
  return `// JobPilot email sender. Sends job-match emails to your own Gmail.
const SECRET = '${secret}';
function doPost(e) {
  const d = JSON.parse(e.postData.contents);
  if (d.secret !== SECRET) return ContentService.createTextOutput('bad secret');
  MailApp.sendEmail(Session.getEffectiveUser().getEmail(), String(d.subject).slice(0, 200), String(d.body));
  return ContentService.createTextOutput('ok');
}`;
}
function renderSettings() {
  const s = data.settings;
  if (!s.email.secret) { s.email.secret = pendingSecret(); save({ settings: s }); }
  const hours = Array.from({ length: 24 }, (_, h) => h);
  const hl = h => new Date(2000, 0, 1, h).toLocaleTimeString([], { hour: 'numeric' });
  $('#view').innerHTML = `
    <div><h1>Settings</h1><p class="sub">What to search, how often, and what to filter out.</p></div>
    <div class="card"><h2>Search keywords</h2>
      <div id="kws">${s.keywords.map((k, i) => `<span class="chip kw">${esc(k)} <button class="x" data-act="delKw" data-i="${i}" aria-label="Remove ${esc(k)}">×</button></span>`).join('')}</div>
      <div style="display:flex;gap:8px;margin-top:6px"><input type="text" id="newKw" placeholder="e.g. Senior .NET Developer" aria-label="New keyword" class="grow"><button class="btn" data-act="addKw">Add keyword</button></div>
    </div>
    <div class="card"><h2>Where and when</h2>
      <div class="form">
        <label>Posted within <select id="days">${[[1, 'Last 24 hours'], [3, 'Last 3 days'], [7, 'Last 7 days']].map(([v, t]) => `<option value="${v}" ${+s.postedWithinDays === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Local / hybrid location <input type="text" id="hyLoc" value="${esc(s.hybridLocation)}"></label>
        <label>Scan every <select id="interval">${[1, 2, 3, 4, 6, 8, 12].map(h => `<option value="${h}" ${+s.intervalHours === h ? 'selected' : ''}>${h} hour${h > 1 ? 's' : ''}</option>`).join('')}</select></label>
        <label>Scan only between <small>Same time in both = all day</small><span style="display:flex;gap:6px;align-items:center"><select id="aStart">${hours.map(h => `<option value="${h}" ${+s.activeStart === h ? 'selected' : ''}>${hl(h)}</option>`).join('')}</select> and <select id="aEnd">${hours.map(h => `<option value="${h}" ${+s.activeEnd === h ? 'selected' : ''}>${hl(h)}</option>`).join('')}</select></span></label>
      </div>
      <div class="form" style="margin-top:12px">
        <label>Where can the job be?
          <select id="locMode"><option value="us" ${s.locationMode !== 'near' ? 'selected' : ''}>Anywhere in the United States (incl. remote)</option><option value="near" ${s.locationMode === 'near' ? 'selected' : ''}>Only remote or near my location</option></select></label>
      </div>
      <div class="checks" style="margin-top:12px">
        <label><input type="checkbox" id="enabled" ${s.enabled ? 'checked' : ''}> Auto-scan on</label>
        <label><input type="checkbox" id="fullTime" ${s.fullTimeOnly ? 'checked' : ''}> Full-time jobs only</label>
        <label><input type="checkbox" id="remote" ${s.remote ? 'checked' : ''}> Remote jobs</label>
        <label><input type="checkbox" id="hybrid" ${s.hybrid ? 'checked' : ''}> Jobs near my location</label>
      </div>
    </div>
    <div class="card"><h2>Sites to search</h2>
      <div class="checks">${Object.entries(SITE_LABELS).map(([k, v]) => `<label><input type="checkbox" data-site="${k}" ${s.sites[k] ? 'checked' : ''}> ${v === 'Company site' ? 'Company career sites (list below)' : v}</label>`).join('')}</div>
    </div>
    <div class="card"><h2>Company career sites (${(s.companies || []).filter(c => c.enabled).length} on)</h2>
      <div class="form" style="margin-bottom:10px">
        <label>Search terms typed into company sites <input type="text" id="coQueries" value="${esc((s.companyQueries || []).join(', '))}"><small>Comma separated. Short terms find more; results are then matched to your keywords.</small></label>
      </div>
      <div class="checks" style="margin-bottom:10px"><label><input type="checkbox" id="autoAdd" ${s.autoAddCompanies ? 'checked' : ''}> Add companies automatically when a portal job links to their career site</label></div>
      <div class="tablebox" style="max-height:420px;overflow:auto"><table style="min-width:720px"><thead><tr><th>On</th><th>Company</th><th>Career site link</th><th>Last check</th><th></th></tr></thead><tbody id="coRows">
      ${(s.companies || []).map((c, i) => { const st = (data.meta.companyStatus || {})[c.url];
        return `<tr data-ci="${i}"><td><input type="checkbox" data-c="enabled" ${c.enabled ? 'checked' : ''} aria-label="Search ${esc(c.name)}"></td>
        <td><input type="text" data-c="name" value="${esc(c.name)}" aria-label="Company name" style="width:170px">${c.auto ? '<div class="co">added automatically</div>' : ''}${c.autoDisabled ? '<div class="co" style="color:#9B1C12">turned off: failed 3 scans</div>' : ''}</td>
        <td><input type="url" data-c="url" value="${esc(c.url)}" aria-label="Career site link for ${esc(c.name)}" style="width:100%;min-width:300px"></td>
        <td>${!st ? '<span class="co">Not checked yet</span>' : st.ok ? `<span class="pill s-applied">✓ ${esc(st.message)}</span>` : `<span class="pill s-rejected" title="${esc(st.message)}">✗ ${esc(st.message.slice(0, 40))}</span>`}</td>
        <td><button class="btn small" data-act="delCo" data-i="${i}" aria-label="Remove ${esc(c.name)}">Remove</button></td></tr>`; }).join('')}
      </tbody></table></div>
      <p class="hint">✗ means that link didn't work. Open the company's careers page, search for a job, and paste that page's link here (put <code>{q}</code> where the search word goes, if you can).</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input type="text" id="newCoName" placeholder="Company name" aria-label="New company name"><input type="url" id="newCoUrl" class="grow" placeholder="Careers page link" aria-label="New company careers link"><button class="btn" data-act="addCo">Add company</button><button class="btn" data-act="resetCo">Reset to default list</button></div>
    </div>
    <div class="card"><h2>Filters</h2>
      <div class="form" style="margin-bottom:8px">
        <label>Remove jobs asking for this many years or more <input type="number" id="maxYears" min="0" max="30" value="${esc(s.maxYears)}"><small>Set 0 to turn off.</small></label>
        <label>Hide jobs below this match % <input type="number" id="minMatch" min="0" max="100" value="${esc(s.minMatch)}"></label>
        <label>Remove jobs whose title has <input type="text" id="exTitle" value="${esc(s.excludeTitleWords || '')}"><small>Comma separated.</small></label>
        <label>Max new jobs to read per scan <input type="number" id="maxNew" min="5" max="150" value="${esc(s.maxNewPerScan)}"><small>Higher = longer scans.</small></label>
      </div>
      <div class="checks"><label><input type="checkbox" id="titleMust" ${s.titleMustMatch ? 'checked' : ''}> Skip results whose title doesn't fit my keywords</label></div>
      <p class="hint">Each rule: if the job text contains any of its phrases (comma separated), the job is <b>removed</b> or just <b>flagged</b>.</p>
      <div id="rules">${s.rules.map((r, i) => `<div class="rule" data-i="${i}">
        <input type="checkbox" data-r="enabled" ${r.enabled ? 'checked' : ''} aria-label="Rule on">
        <input type="text" data-r="label" value="${esc(r.label)}" aria-label="Rule name">
        <select data-r="mode" aria-label="Action"><option value="remove" ${r.mode === 'remove' ? 'selected' : ''}>Remove</option><option value="warn" ${r.mode === 'warn' ? 'selected' : ''}>Flag only</option></select>
        <textarea data-r="phrases" rows="2" aria-label="Phrases">${esc(r.phrases)}</textarea></div>`).join('')}</div>
      <button class="btn" data-act="addRule" style="margin-top:10px">Add rule</button>
    </div>
    <div class="card"><h2>Skill keyword groups</h2>
      <p class="hint">Used for the match score. One group per line: <code>Skill name: other way to say it, another way</code>. If a job says any word in a group and your resume says any word in the same group, it counts as a match. Add a line when a skill is missing.</p>
      <textarea id="groups" rows="16" style="font-family:Consolas,monospace;font-size:12px">${esc(data.skillGroups)}</textarea>
      <button class="btn small" data-act="resetGroups" style="margin-top:8px">Reset to default list</button>
    </div>
    <div class="card"><h2>Email alerts (free, through your Gmail)</h2>
      <p class="hint">After each scan, new matches are emailed to your Gmail with links to apply. One-time setup, about 3 minutes:</p>
      <ol style="margin:0 0 10px 18px;padding:0;font-size:13px;line-height:1.7">
        <li>Open <a href="https://script.google.com/home/projects/create" target="_blank" rel="noopener">script.google.com → New project</a> (signed in to your Gmail).</li>
        <li>Delete everything in the code box, then paste this code: <button class="btn small" data-act="copyScript">Copy code</button></li>
        <li>Click <b>Deploy → New deployment</b>, click the gear ⚙ next to "Select type" and choose <b>Web app</b>.</li>
        <li>Set <b>Execute as: Me</b> and <b>Who has access: Anyone</b>, click <b>Deploy</b>, then <b>Authorize access</b> and allow it (if Google warns, click Advanced → Go to project).</li>
        <li>Copy the <b>Web app URL</b> it shows and paste it below, then click Save &amp; send test email.</li>
      </ol>
      <textarea id="gasCode" rows="7" readonly style="font-family:Consolas,monospace;font-size:12px">${esc(gasScript(s.email.secret || pendingSecret()))}</textarea>
      <div class="form" style="margin-top:10px"><label>Gmail sender link (Web app URL) <input type="url" id="emUrl" value="${esc(s.email.webAppUrl)}" placeholder="https://script.google.com/macros/s/…/exec"></label></div>
      <div class="checks" style="margin-top:10px"><label><input type="checkbox" id="emOn" ${s.email.enabled ? 'checked' : ''}> Email me new matches</label><button class="btn small" data-act="testEmail">Save &amp; send test email</button></div>
      <p class="hint">The emails go only to the Gmail account that owns the script. Google allows about 100 a day for free.</p>
    </div>
    <div class="card"><h2>Phone alerts (free ntfy app)</h2>
      <p class="hint">Install "ntfy" on your iPhone, subscribe to a long random topic name (like nikki-jobs-8k3p2x), and type the same name here.</p>
      <div class="form"><label>Topic name <input type="text" id="ntTopic" value="${esc(s.ntfy.topic)}"></label><label>Server <input type="url" id="ntServer" value="${esc(s.ntfy.server)}"></label></div>
      <div class="checks" style="margin-top:10px"><label><input type="checkbox" id="ntOn" ${s.ntfy.enabled ? 'checked' : ''}> Send new matches to my phone</label><button class="btn small" data-act="testNtfy">Send test</button></div>
    </div>
    <div class="card"><h2>AI (optional)</h2>
      <p class="hint">Adds an "AI check" button on each job: smarter score, tailored resume bullets and a cover note. Uses your own Anthropic API key (about 1–3¢ per job). The key stays in this browser.</p>
      <div class="form"><label>API key <input type="password" id="aiKey" value="${esc(s.ai.apiKey)}" autocomplete="off"></label><label>Model <input type="text" id="aiModel" value="${esc(s.ai.model)}"></label></div>
      <div class="checks" style="margin-top:10px"><label><input type="checkbox" id="aiOn" ${s.ai.enabled ? 'checked' : ''}> Turn on AI check</label></div>
    </div>
    <div class="savebar"><button class="btn primary" data-act="saveSettings">Save settings</button><span class="co">Saving also re-scores your current jobs.</span></div>`;
}

function collectSettings() {
  const s = structuredClone(data.settings);
  s.postedWithinDays = +$('#days').value; s.hybridLocation = $('#hyLoc').value.trim();
  s.intervalHours = +$('#interval').value; s.activeStart = +$('#aStart').value; s.activeEnd = +$('#aEnd').value;
  s.enabled = $('#enabled').checked; s.remote = $('#remote').checked; s.hybrid = $('#hybrid').checked;
  document.querySelectorAll('[data-site]').forEach(c => { s.sites[c.dataset.site] = c.checked; });
  s.companies = [...document.querySelectorAll('#coRows tr')].map(tr => {
    const old = data.settings.companies[+tr.dataset.ci] || {};
    const c = { ...old, enabled: tr.querySelector('[data-c=enabled]').checked, name: tr.querySelector('[data-c=name]').value.trim(), url: tr.querySelector('[data-c=url]').value.trim() };
    if (c.enabled) delete c.autoDisabled;
    return c; }).filter(c => c.url);
  s.companyQueries = $('#coQueries').value.split(',').map(x => x.trim()).filter(Boolean);
  s.autoAddCompanies = $('#autoAdd').checked;
  s.locationMode = $('#locMode').value; s.fullTimeOnly = $('#fullTime').checked;
  s.email = { ...s.email, enabled: $('#emOn').checked, webAppUrl: $('#emUrl').value.trim(), secret: s.email.secret || pendingSecret() };
  s.maxYears = +$('#maxYears').value || 0; s.minMatch = +$('#minMatch').value || 0; s.maxNewPerScan = +$('#maxNew').value || 40;
  s.titleMustMatch = $('#titleMust').checked;
  s.excludeTitleWords = $('#exTitle').value;
  s.rules = [...document.querySelectorAll('#rules .rule')].map((el, i) => ({
    id: (data.settings.rules[i] || {}).id || 'r' + Date.now() + i,
    enabled: el.querySelector('[data-r=enabled]').checked, label: el.querySelector('[data-r=label]').value.trim() || 'Rule',
    mode: el.querySelector('[data-r=mode]').value, phrases: el.querySelector('[data-r=phrases]').value })).filter(r => r.phrases.trim() || r.label !== 'Rule');
  s.ntfy = { enabled: $('#ntOn').checked, topic: $('#ntTopic').value.trim(), server: $('#ntServer').value.trim() || 'https://ntfy.sh' };
  s.ai = { enabled: $('#aiOn').checked, apiKey: $('#aiKey').value.trim(), model: $('#aiModel').value.trim() || DEFAULT_SETTINGS.ai.model };
  return s;
}

// ---------------- profile ----------------
const PF = [
  ['Personal', [['firstName', 'First name'], ['lastName', 'Last name'], ['email', 'Email', 'email'], ['phone', 'Phone', 'tel'], ['address', 'Street address'], ['city', 'City'], ['state', 'State'], ['zip', 'ZIP code'], ['country', 'Country']]],
  ['Links', [['linkedin', 'LinkedIn URL', 'url'], ['github', 'GitHub URL', 'url'], ['website', 'Portfolio / website', 'url']]],
  ['Work', [['currentCompany', 'Current company'], ['currentTitle', 'Current job title'], ['yearsExperience', 'Years of experience'], ['salary', 'Expected salary (as you\'d type it)'], ['noticePeriod', 'Notice period (e.g. 2 weeks)'], ['startDate', 'Earliest start date'], ['howHeard', '"How did you hear about us" answer']]],
];
const YN = [['workAuthorized', 'Legally authorized to work in the US?'], ['needSponsorship', 'Will you need visa sponsorship now or in future?'], ['willingRelocate', 'Willing to relocate?'],
  ['over18', 'Are you 18 or older?'], ['relatedExperience', 'Do you have past / relevant work experience?'], ['workedHereBefore', 'Have you worked for this company before?'],
  ['relativesHere', 'Do relatives work at this company?'], ['backgroundCheck', 'Willing to do a background check?'], ['drugTest', 'Willing to do a drug test?'],
  ['willingTravel', 'Willing to travel?'], ['nonCompete', 'Under a non-compete agreement?'], ['clearance', 'Do you hold a security clearance?']];
const EXP_F = [['company', 'Company'], ['title', 'Job title'], ['location', 'Location'], ['start', 'Start (month)', 'month'], ['end', 'End (month)', 'month']];
const EDU_F = [['school', 'School / university'], ['degree', 'Degree (e.g. Master\'s)'], ['field', 'Field of study'], ['start', 'Start (month)', 'month'], ['end', 'End / graduation (month)', 'month'], ['gpa', 'GPA (optional)']];
const EEO = [['gender', 'Gender'], ['race', 'Race / ethnicity'], ['veteran', 'Veteran status'], ['disability', 'Disability status']];

function renderProfile() {
  const p = data.profile;
  const groups = compileGroups(data.skillGroups);
  const resumeText = (p.resumes || []).map(r => r.text).join('\n');
  const found = [...findSkills(resumeText, groups)];
  const input = ([k, l, t]) => `<label>${esc(l)}<input type="${t || 'text'}" data-p="${k}" value="${esc(p[k])}"></label>`;
  $('#view').innerHTML = `
    <div><h1>Profile &amp; resume</h1><p class="sub">Used to score jobs and fill application forms. Saved only in this browser.</p></div>
    <div class="card"><h2>Resume</h2>
      <p class="hint">Upload PDF, Word (.docx) or .txt. The first resume is attached to applications. Check the extracted text below; the score is based on it.</p>
      <input type="file" id="resumeFile" accept=".pdf,.docx,.txt" aria-label="Upload resume">
      <div id="resumes" style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
      ${(p.resumes || []).map((r, i) => `<div style="border:1px solid #EDEFF2;border-radius:8px;padding:12px">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><b>${esc(r.name)}</b>${i === 0 ? '<span class="pill s-applied">Used for uploads</span>' : `<button class="btn small" data-act="primaryResume" data-i="${i}">Use for uploads</button>`}<button class="btn small" data-act="delResume" data-i="${i}">Remove</button></div>
        <textarea data-rt="${i}" rows="6" style="margin-top:8px;font-size:12px">${esc(r.text)}</textarea></div>`).join('') || '<div class="warnbox">No resume uploaded yet.</div>'}
      </div>
      <div style="margin-top:12px"><div class="lab">Skills found in your resume (${found.length})</div><div style="margin-top:6px">${found.map(x => `<span class="chip have">${esc(x)}</span>`).join('') || '<span class="co">None yet</span>'}</div></div>
      <div style="margin-top:8px"><div class="lab">Skills you added yourself</div><div style="margin-top:6px">${(p.extraSkills || []).map((x, i) => `<span class="chip kw">${esc(x)} <button class="x" data-act="delSkill" data-i="${i}" aria-label="Remove ${esc(x)}">×</button></span>`).join('') || '<span class="co">None. Use "+ I have it" on a job\'s missing skills.</span>'}</div></div>
    </div>
    ${PF.map(([t, fields]) => `<div class="card"><h2>${t}</h2><div class="form">${fields.map(input).join('')}</div></div>`).join('')}
    <div class="card"><h2>Common questions</h2><div class="form">
      ${YN.map(([k, l]) => `<label>${esc(l)}<select data-p="${k}"><option value="">Leave for me</option><option ${p[k] === 'Yes' ? 'selected' : ''}>Yes</option><option ${p[k] === 'No' ? 'selected' : ''}>No</option></select></label>`).join('')}
      ${EEO.map(([k, l]) => `<label>${esc(l)} <small>(voluntary)</small><input type="text" data-p="${k}" value="${esc(p[k])}"></label>`).join('')}
    </div></div>
    <div class="card"><h2>Work history</h2>
      <p class="hint">Filled into "Work experience" sections, newest first. Tick "Current job" for the job you have now.</p>
      <div id="expList">${(p.experience || []).map((x, i) => `<div data-ex="${i}" style="border:1px solid #EDEFF2;border-radius:8px;padding:12px;margin-bottom:10px">
        <div class="form">${EXP_F.map(([k, l, t]) => `<label>${esc(l)}<input type="${t || 'text'}" data-xf="${k}" value="${esc(x[k])}"></label>`).join('')}</div>
        <div class="checks" style="margin-top:8px"><label><input type="checkbox" data-xf="current" ${x.current ? 'checked' : ''}> Current job</label></div>
        <label class="fl" style="margin-top:8px">Description (optional)<textarea data-xf="description" rows="3">${esc(x.description)}</textarea></label>
        <button class="btn small" data-act="delExp" data-i="${i}" style="margin-top:8px">Remove job</button></div>`).join('') || '<p class="co">No jobs added yet.</p>'}</div>
      <button class="btn" data-act="addExp">Add job</button>
    </div>
    <div class="card"><h2>Education</h2>
      <div id="eduList">${(p.education || []).map((x, i) => `<div data-ed="${i}" style="border:1px solid #EDEFF2;border-radius:8px;padding:12px;margin-bottom:10px">
        <div class="form">${EDU_F.map(([k, l, t]) => `<label>${esc(l)}<input type="${t || 'text'}" data-uf="${k}" value="${esc(x[k])}"></label>`).join('')}</div>
        <button class="btn small" data-act="delEdu" data-i="${i}" style="margin-top:8px">Remove</button></div>`).join('') || '<p class="co">No education added yet.</p>'}</div>
      <button class="btn" data-act="addEdu">Add education</button>
    </div>
    <div class="card"><h2>Cover letter (default)</h2><textarea data-p="coverLetter" rows="6" placeholder="Used when a form has a cover letter box and no AI cover note exists for that job.">${esc(p.coverLetter)}</textarea></div>
    <div class="card"><h2>Saved answers for other questions</h2>
      <p class="hint">If a question contains any of the trigger words, this answer is filled in.</p>
      <div id="answers">${(p.answers || []).map((a, i) => `<div class="form" data-a="${i}" style="margin-bottom:10px;grid-template-columns:minmax(200px,1fr) 2fr auto;align-items:end">
        <label>Trigger words<input type="text" data-af="match" value="${esc(a.match)}"></label><label>Answer<textarea data-af="answer" rows="2">${esc(a.answer)}</textarea></label><button class="btn small" data-act="delAnswer" data-i="${i}">Remove</button></div>`).join('')}</div>
      <button class="btn" data-act="addAnswer">Add answer</button>
    </div>
    <div class="savebar"><button class="btn primary" data-act="saveProfile">Save profile</button><span class="co">Saving re-scores your jobs.</span></div>`;
  $('#resumeFile').addEventListener('change', onResumeFile);
}

function collectProfile() {
  const p = structuredClone(data.profile);
  document.querySelectorAll('[data-p]').forEach(el => { p[el.dataset.p] = el.value.trim(); });
  document.querySelectorAll('[data-rt]').forEach(el => { if (p.resumes[+el.dataset.rt]) p.resumes[+el.dataset.rt].text = el.value; });
  p.answers = [...document.querySelectorAll('[data-a]')].map(el => ({ match: el.querySelector('[data-af=match]').value.trim(), answer: el.querySelector('[data-af=answer]').value.trim() }));
  p.experience = [...document.querySelectorAll('[data-ex]')].map(el => {
    const o = {}; el.querySelectorAll('[data-xf]').forEach(f => { o[f.dataset.xf] = f.type === 'checkbox' ? f.checked : f.value.trim(); }); return o; });
  p.education = [...document.querySelectorAll('[data-ed]')].map(el => {
    const o = {}; el.querySelectorAll('[data-uf]').forEach(f => { o[f.dataset.uf] = f.value.trim(); }); return o; });
  return p;
}

async function onResumeFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  toast('Reading resume…');
  try {
    const buf = await file.arrayBuffer();
    let text = '';
    if (/\.pdf$/i.test(file.name)) {
      const pdf = await pdfjs.getDocument({ data: buf.slice(0), isEvalSupported: false }).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const c = await (await pdf.getPage(i)).getTextContent();
        let line = '', lastY = null;
        for (const it of c.items) { if (lastY !== null && Math.abs(it.transform[5] - lastY) > 2) { text += line.trim() + '\n'; line = ''; } line += it.str + (it.hasEOL ? ' ' : ''); lastY = it.transform[5]; }
        text += line.trim() + '\n\n';
      }
    } else if (/\.docx$/i.test(file.name)) {
      text = (await window.mammoth.extractRawText({ arrayBuffer: buf })).value;
    } else text = new TextDecoder().decode(buf);
    const dataUrl = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
    const p = collectProfile();
    p.resumes = [...(p.resumes || []), { name: file.name, type: file.type, text: text.trim(), dataUrl }];
    await save({ profile: p });
    await load(); renderProfile();
    await send({ type: 'rescoreAll' });
    toast('Resume added. Check the text, then Save profile.');
  } catch (err) {
    toast('Could not read that file: ' + err.message);
  }
}

// ---------------- routing & events ----------------
function render() {
  view = (location.hash || '#jobs').slice(1);
  if (!['jobs', 'settings', 'profile'].includes(view)) view = 'jobs';
  renderStatus();
  if (view === 'jobs') renderJobs(); else if (view === 'settings') renderSettings(); else renderProfile();
}

document.addEventListener('click', async e => {
  const b = e.target.closest('[data-act]');
  if (!b) { if (e.target.id === 'overlay') closeDrawer(); return; }
  const id = b.dataset.id, act = b.dataset.act;
  if (act === 'apply') { await send({ type: 'startApply', jobId: id }); }
  else if (act === 'skip') await updateJob(id, { status: 'skipped' });
  else if (act === 'undo') await updateJob(id, { status: 'new' });
  else if (act === 'applied') await updateJob(id, { status: 'applied' });
  else if (act === 'open') openDrawer(id);
  else if (act === 'close') closeDrawer();
  else if (act === 'clearJobs') {
    if (!confirm('Clear all jobs from the list? Your profile, settings and email setup stay. The next scan finds fresh jobs.')) return;
    await save({ jobs: {}, removed: [] }); await send({ type: 'refreshBadge' }); toast('Job list cleared');
  }
  else if (act === 'toggleRemoved') { f.showRemoved = !f.showRemoved; renderJobs(); }
  else if (act === 'restore') { await send({ type: 'restoreRemoved', id }); toast('Put back on your list'); }
  else if (act === 'haveSkill') {
    const p = data.profile; p.extraSkills = [...new Set([...(p.extraSkills || []), b.dataset.skill])];
    await save({ profile: p }); await send({ type: 'rescoreAll' }); toast(`Added "${b.dataset.skill}" to your skills. Scores updated.`);
  }
  else if (act === 'ai') {
    b.disabled = true; b.textContent = 'Asking AI…';
    const r = await send({ type: 'aiTailor', jobId: id });
    if (!r.ok) { toast(r.error); b.disabled = false; b.textContent = 'Run AI check'; }
  }
  else if (act === 'copy') { await navigator.clipboard.writeText(b.dataset.text); toast('Copied'); }
  // settings
  else if (act === 'addKw' || act === 'delKw') {
    const s = collectSettings();
    if (act === 'addKw') { const v = $('#newKw').value.trim(); if (v) s.keywords.push(v); }
    else s.keywords.splice(+b.dataset.i, 1);
    data.settings = s; renderSettings();
  }
  else if (act === 'addRule') { const s = collectSettings(); s.rules.push({ id: 'r' + Date.now(), label: 'New rule', mode: 'remove', enabled: true, phrases: '' }); data.settings = s; renderSettings(); }
  else if (act === 'resetGroups') { $('#groups').value = DEFAULT_SKILL_GROUPS; toast('Default list restored. Click Save settings.'); }
  else if (act === 'addCo' || act === 'delCo' || act === 'resetCo') {
    const s = collectSettings();
    if (act === 'addCo') { const u = $('#newCoUrl').value.trim(); if (!/^https?:\/\//.test(u)) return toast('Paste a link starting with https://'); s.companies.push({ name: $('#newCoName').value.trim() || u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: u, enabled: true }); }
    else if (act === 'delCo') s.companies.splice(+b.dataset.i, 1);
    else s.companies = DEFAULT_COMPANIES.map(c => ({ ...c }));
    data.settings = s; renderSettings(); toast('Click Save settings to keep this change');
  }
  else if (act === 'copyScript') { await navigator.clipboard.writeText($('#gasCode').value); toast('Code copied. Paste it in the Apps Script editor.'); }
  else if (act === 'testEmail') {
    const s = collectSettings();
    if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(s.email.webAppUrl)) return toast('Paste the Web app URL from step 5 first');
    s.email.enabled = true;
    await save({ settings: s, skillGroups: $('#groups').value.trim() || DEFAULT_SKILL_GROUPS }); await load(); renderSettings();
    const r = await send({ type: 'testEmail' });
    toast(r.ok ? 'Test email sent — check your inbox (and spam folder)' : 'Could not send: ' + r.error);
  }
  else if (act === 'testNtfy') {
    const s = collectSettings();
    if (!s.ntfy.topic) return toast('Type a topic name first');
    try { await fetch(`${s.ntfy.server.replace(/\/$/, '')}/${encodeURIComponent(s.ntfy.topic)}`, { method: 'POST', body: 'JobPilot test: phone alerts work!', headers: { Title: 'JobPilot' } }); toast('Test sent — check your phone'); }
    catch (err) { toast('Could not send: ' + err.message); }
  }
  else if (act === 'saveSettings') {
    const s = collectSettings();
    await save({ settings: s, skillGroups: $('#groups').value.trim() || DEFAULT_SKILL_GROUPS });
    await send({ type: 'settingsChanged' }); await send({ type: 'rescoreAll' });
    toast('Settings saved');
  }
  // profile
  else if (act === 'delResume' || act === 'primaryResume') {
    const p = collectProfile(); const i = +b.dataset.i;
    if (act === 'delResume') p.resumes.splice(i, 1); else p.resumes.unshift(p.resumes.splice(i, 1)[0]);
    await save({ profile: p }); await send({ type: 'rescoreAll' }); await load(); renderProfile();
  }
  else if (act === 'delSkill') { const p = collectProfile(); p.extraSkills.splice(+b.dataset.i, 1); await save({ profile: p }); await send({ type: 'rescoreAll' }); await load(); renderProfile(); }
  else if (['addExp', 'delExp', 'addEdu', 'delEdu'].includes(act)) {
    const p = collectProfile();
    if (act === 'addExp') p.experience.push({ company: '', title: '', location: '', start: '', end: '', current: false, description: '' });
    else if (act === 'delExp') p.experience.splice(+b.dataset.i, 1);
    else if (act === 'addEdu') p.education.push({ school: '', degree: '', field: '', start: '', end: '', gpa: '' });
    else p.education.splice(+b.dataset.i, 1);
    data.profile = p; renderProfile();
  }
  else if (act === 'addAnswer' || act === 'delAnswer') {
    const p = collectProfile();
    if (act === 'addAnswer') p.answers.push({ match: '', answer: '' }); else p.answers.splice(+b.dataset.i, 1);
    data.profile = p; renderProfile();
  }
  else if (act === 'saveProfile') { await save({ profile: collectProfile() }); await send({ type: 'rescoreAll' }); await load(); renderProfile(); toast('Profile saved'); }
});

$('#scanNow').addEventListener('click', async () => { await send({ type: 'scanNow' }); toast('Scan started. Chrome opens a minimized window while it searches.'); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && openJob) closeDrawer(); });
window.addEventListener('hashchange', () => { closeDrawer(); render(); });

chrome.storage.onChanged.addListener(async (changes) => {
  await load();
  renderStatus();
  if (view === 'jobs' && (changes.jobs || changes.removed || changes.meta || changes.settings)) {
    const active = document.activeElement?.id;
    if (active !== 'fq') renderJobs();
    if (openJob) renderDrawer();
  }
});

await load();
render();
