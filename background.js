// JobPilot background worker: scheduled scans, apply-tab tracking, messages.
import { getAll, save, updateJob, updateMeta, getSeen, isSeen, commitJobs } from './shared/store.js';
import { compileGroups, resumeSkills, evaluateJob, titleMatches, dedupeKey } from './shared/match.js';
import { searchUrls, companyPageType, fetchCompanyApi, fetchApiDetail, boardFromUrl, locationOk, SITE_LABELS } from './shared/sources.js';
import { extractList, extractDetail } from './shared/extractors.js';
import { aiTailor } from './shared/ai.js';

const sleep = ms => new Promise(r => setTimeout(r, ms));
const jitter = (a, b) => sleep(a + Math.random() * (b - a));

// ---------- schedule ----------
async function setupAlarm() {
  const { settings } = await getAll();
  await chrome.alarms.clear('scan');
  const period = Math.max(1, Number(settings.intervalHours) || 3) * 60;
  chrome.alarms.create('scan', { periodInMinutes: period, delayInMinutes: 1 });
  await updateMeta({ nextScanAt: Date.now() + 60000 });
}

chrome.runtime.onInstalled.addListener(async (details) => {
  await setupAlarm();
  if (details.reason === 'update') rescoreAll();
  if (details.reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#profile') });
});
chrome.runtime.onStartup.addListener(async () => {
  const a = await chrome.alarms.get('scan');
  if (!a) await setupAlarm();
  await updateMeta({ scanning: false });
  refreshBadge();
});

chrome.alarms.onAlarm.addListener(async a => {
  if (a.name !== 'scan') return;
  const { settings } = await getAll();
  await updateMeta({ nextScanAt: Date.now() + Math.max(1, Number(settings.intervalHours) || 3) * 3600000 });
  if (!settings.enabled) return;
  const h = new Date().getHours();
  const s = Number(settings.activeStart), e = Number(settings.activeEnd);
  const inHours = s === e ? true : s < e ? (h >= s && h < e) : (h >= s || h < e);
  if (!inHours) return;
  runScan();
});

// ---------- page loading helper ----------
function waitForLoad(tabId, timeout = 30000) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => { if (!done) { done = true; chrome.tabs.onUpdated.removeListener(l); resolve(); } };
    const l = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    chrome.tabs.onUpdated.addListener(l);
    setTimeout(finish, timeout);
  });
}

// The scan uses its own minimized window. If Chrome closes or discards it, a new one is opened.
const scanCtx = { winId: null, tabId: null };
async function ensureScanTab() {
  if (scanCtx.tabId != null) {
    try { const t = await chrome.tabs.get(scanCtx.tabId); if (t && !t.discarded) return t.id; } catch (e) { /* gone */ }
    if (scanCtx.winId != null) chrome.windows.remove(scanCtx.winId).catch(() => {});
  }
  const w = await chrome.windows.create({ url: 'about:blank', state: 'minimized', focused: false });
  scanCtx.winId = w.id; scanCtx.tabId = w.tabs[0].id;
  try { await chrome.tabs.update(scanCtx.tabId, { autoDiscardable: false, muted: true }); } catch (e) { /* older Chrome */ }
  return scanCtx.tabId;
}
async function closeScanWindow() {
  if (scanCtx.winId != null) await chrome.windows.remove(scanCtx.winId).catch(() => {});
  scanCtx.winId = scanCtx.tabId = null;
}

async function loadAndRun(_unused, url, func, args = [], settle = 3000) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const tabId = await ensureScanTab();
      const p = waitForLoad(tabId);
      await chrome.tabs.update(tabId, { url });
      await p;
      await sleep(settle);
      const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
      return res?.result || null;
    } catch (e) {
      const msg = String(e.message || e);
      if (attempt === 0 && /no tab|tab was closed|window|discard|frame/i.test(msg)) { scanCtx.tabId = null; continue; }
      return { blocked: 'Could not load page (' + msg + ')', jobs: [], text: '' };
    }
  }
}

// ---------- the scan ----------
// A freshly started background worker can't have a scan running, so clear any stale "scanning" flag.
let scanRunning = false;
updateMeta({ scanning: false, scanProgress: '' });

async function runScan() {
  if (scanRunning) return;          // only one scan at a time
  scanRunning = true;
  try { await runScanInner(); } finally { scanRunning = false; }
}

async function runScanInner() {
  let data = await getAll();
  const m = data.meta;
  await updateMeta({ scanning: true, scanStartedAt: Date.now(), scanProgress: 'Starting…' });
  const seen = await getSeen();

  const { settings, profile, skillGroups } = data;
  const groups = compileGroups(skillGroups);
  const mySkills = resumeSkills(profile, groups);
  const knownIds = new Set([...Object.keys(data.jobs), ...data.removed.map(r => r.id)]);
  const knownKeys = new Set(Object.values(data.jobs).map(dedupeKey));
  const siteStatus = { ...(m.siteStatus || {}) };
  const candidates = [];
  const candKeys = new Set();
  const addCandidate = j => {
    const key = dedupeKey(j);
    if (knownIds.has(j.id) || knownKeys.has(key) || candKeys.has(key) || isSeen(seen, j)) {
      // Same job on another site: remember the extra source on the existing job.
      return;
    }
    candKeys.add(key);
    candidates.push(j);
  };

  let win = null, tabId = null;
  const companyStatus = { ...(m.companyStatus || {}) };
  const learned = [];        // company boards found through portal jobs
  const disabledNow = [];    // companies turned off after failing 3 scans in a row
  try {
    tabId = await ensureScanTab();

    // ---- Priority 1: company career sites ----
    if (settings.sites.company) {
      const list = (settings.companies || []).filter(c => c.enabled && c.url);
      const queries = (settings.companyQueries && settings.companyQueries.length) ? settings.companyQueries : settings.keywords;
      const markOk = (c, msg) => { companyStatus[c.url] = { ok: true, message: msg, at: Date.now(), fails: 0 }; };
      const markFail = (c, e) => {
        const msg = String(e.message || e);
        const fails = ((companyStatus[c.url] || {}).fails || 0) + 1;
        companyStatus[c.url] = { ok: false, message: (/failed to fetch|404|answered 4/i.test(msg) ? 'Link not found' : msg).slice(0, 120), at: Date.now(), fails };
        if (fails >= 3) disabledNow.push(c.url);
      };
      const taker = c => {
        const st = { found: 0, matched: 0 };
        st.take = j => {
          st.found++;
          if (!titleMatches(j.title, settings.keywords)) return;
          if (!locationOk(j.location, settings) || !locationOk(j.title, { locationMode: 'us' })) return;
          j.source = 'company'; j.company = c.name; st.matched++;
          addCandidate(j);
        };
        return st;
      };
      // Companies with job feeds: 6 at a time (fast, no page loading).
      const apiList = list.filter(c => companyPageType(c.url).type !== 'generic');
      const pageList = list.filter(c => companyPageType(c.url).type === 'generic');
      let done = 0;
      const worker = async () => {
        while (apiList.length) {
          const c = apiList.shift();
          const st = taker(c);
          try { (await fetchCompanyApi(companyPageType(c.url), settings, c.name)).forEach(st.take); markOk(c, `OK · ${st.matched} matching of ${st.found} new`); }
          catch (e) { markFail(c, e); }
          done++;
          if (done % 5 === 0) await updateMeta({ scanProgress: `Company sites: ${done} of ${list.length} checked…` });
        }
      };
      await Promise.all(Array.from({ length: 6 }, worker));
      // Other career pages: opened one by one.
      for (const c of pageList) {
        done++;
        await updateMeta({ scanProgress: `Company sites: checking ${c.name} (${done} of ${list.length})…` });
        const st = taker(c);
        try {
          const urls = c.url.includes('{q}') ? queries.map(q => c.url.replace('{q}', encodeURIComponent(q))) : [c.url];
          for (const u of urls) {
            const res = await loadAndRun(tabId, u, extractList, ['generic'], 4500);
            if (res?.blocked) throw new Error(res.blocked);
            (res?.jobs || []).forEach(st.take);
            await jitter(800, 1800);
          }
          markOk(c, !st.found ? 'Read OK, no job links seen' : `OK · ${st.matched} matching of ${st.found}`);
        } catch (e) { markFail(c, e); }
      }
    }
    await updateMeta({ companyStatus });

    // ---- Priority 2: job portals ----
    for (const site of ['linkedin', 'dice', 'indeed', 'ziprecruiter']) {
      if (!settings.sites[site]) continue;
      let blocked = null, found = 0;
      for (const url of searchUrls(site, settings)) {
        await updateMeta({ scanProgress: `Searching ${SITE_LABELS[site]}…` });
        const res = await loadAndRun(tabId, url, extractList, [site], site === 'linkedin' ? 1200 : 3500);
        if (res?.blocked) { blocked = res.blocked; break; }
        for (const j of res?.jobs || []) {
          if (settings.titleMustMatch && !titleMatches(j.title, settings.keywords)) continue;
          if (!locationOk(j.location, settings) || !locationOk(j.title, { locationMode: 'us' })) continue;
          j.source = site; found++;
          addCandidate(j);
        }
        await jitter(1500, 3500);
      }
      siteStatus[site] = { ok: !blocked, message: blocked || `OK · ${found} results`, at: Date.now() };
    }

    // ---- Read each new job (company sites first), score and filter ----
    const limit = Math.max(5, Number(settings.maxNewPerScan) || 60);   // page loads per scan
    candidates.sort((a, b) => (a.source === 'company' ? 0 : 1) - (b.source === 'company' ? 0 : 1));
    const blockedSites = new Set();
    data = await getAll();
    const pendingJobs = [], pendingRemoved = [];
    const flush = async () => {
      if (!pendingJobs.length && !pendingRemoved.length) return;
      const got = await commitJobs(pendingJobs.splice(0), pendingRemoved.splice(0));
      newOnes.push(...got); added += got.length;
    };
    const knownBoards = new Set((data.settings.companies || []).map(c => c.url));
    let added = 0, removedCount = 0, loads = 0, skipped = 0;
    const newOnes = [];
    for (let i = 0; i < candidates.length; i++) {
      const j = candidates[i];
      if (i && i % 8 === 0) await flush();   // show jobs on the dashboard as they come in
      if (blockedSites.has(j.source)) continue;
      if (j._apiDetail) { if (i % 5 === 0) await updateMeta({ scanProgress: `Reading job ${i + 1} of ${candidates.length}…` }); await fetchApiDetail(j); }
      if (!j.description) {
        if (loads >= limit) { skipped++; continue; }
        loads++;
        await updateMeta({ scanProgress: `Reading job ${i + 1} of ${candidates.length}…` });
        const durl = j.source === 'linkedin' ? `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${j.extId}` : j.url;
        const res = await loadAndRun(tabId, durl, extractDetail, [], j.source === 'linkedin' ? 800 : 2500);
        if (res?.blocked) { blockedSites.add(j.source); siteStatus[j.source] = { ok: false, message: res.blocked, at: Date.now() }; continue; }
        j.description = res?.text || '';
        if (res?.applyUrl) j.applyUrl = res.applyUrl;
        await jitter(1200, 3000);
      }
      // Learn the company's own career board from portal jobs.
      if (settings.autoAddCompanies && j.source !== 'company') {
        const board = boardFromUrl(j.applyUrl) || boardFromUrl(j.url);
        if (board && !knownBoards.has(board) && j.company) { knownBoards.add(board); learned.push({ name: j.company, url: board, enabled: true, auto: true }); }
      }
      const ev = evaluateJob(j, { groups, mySkills, settings });
      const base = { id: j.id, source: j.source, title: j.title, company: j.company || '', location: j.location || '',
        url: j.url, applyUrl: j.applyUrl || '', posted: j.posted || '', description: (j.description || '').slice(0, 15000), foundAt: Date.now() };
      if (ev.removedReason) {
        pendingRemoved.push({ ...base, description: base.description.slice(0, 8000), reason: ev.removedReason });
        removedCount++;
      } else {
        pendingJobs.push({ ...base, ...ev, status: 'new', statusAt: Date.now() });
      }
    }
    await flush();
    // Save auto-added / auto-disabled companies into settings.
    if (learned.length || disabledNow.length || !(await chrome.storage.local.get('settings')).settings?.companiesV) {
      const fresh = await getAll();
      const comps = fresh.settings.companies || [];
      for (const c of comps) if (disabledNow.includes(c.url)) { c.enabled = false; c.autoDisabled = true; }
      for (const l of learned) if (!comps.some(c => c.url === l.url)) comps.push(l);
      const { settings: raw } = await chrome.storage.local.get('settings');
      await save({ settings: { ...(raw || {}), companies: comps.slice(0, 5000), companiesV: fresh.settings.companiesV } });
    }
    const summary = `${added} new matches, ${removedCount} removed by filters` + (learned.length ? `, ${learned.length} companies added` : '') + (skipped ? `, ${skipped} more next scan` : '');
    await updateMeta({ siteStatus, companyStatus, lastScan: Date.now(), lastScanSummary: summary });
    try { await notifyPhone(newOnes, settings); }
    catch (e) { await updateMeta({ lastEmail: { at: Date.now(), ok: false, error: String(e.message || e).slice(0, 160) } }); }
  } catch (e) {
    await updateMeta({ lastScanSummary: 'Scan error: ' + (e.message || e) });
  } finally {
    await closeScanWindow();
    await updateMeta({ scanning: false, scanProgress: '' });
    refreshBadge();
  }
}

async function notifyPhone(newOnes, settings) {
  const n = settings.ntfy, em = settings.email;
  const pushOn = n.enabled && n.topic;
  const mailOn = em.enabled && em.webAppUrl && em.secret;
  if (!pushOn && !mailOn) return;
  const order = (a, b) => ((a.source === 'company' ? 0 : 1) - (b.source === 'company' ? 0 : 1)) || (b.score ?? 0) - (a.score ?? 0);
  const fits = j => (j.score ?? 0) >= settings.minMatch;
  if (pushOn) {
    const good = newOnes.filter(fits).sort(order);
    if (good.length) {
      const server = (n.server || 'https://ntfy.sh').replace(/\/$/, '');
      const lines = good.slice(0, 8).map(j => `${j.score ?? '?'}% · ${j.title} — ${j.company} (${SITE_LABELS[j.source] || j.source})`);
      if (good.length > 8) lines.push(`+${good.length - 8} more in your email / dashboard`);
      try { await fetch(`${server}/${encodeURIComponent(n.topic)}`, { method: 'POST', body: lines.join('\n'), headers: { Title: `JobPilot: ${good.length} new job matches`, Tags: 'briefcase', Click: good[0].url } }); } catch (e) { /* best-effort */ }
    }
  }
  if (mailOn) {
    // Every new match that has not been emailed yet (also ones found before email was set up).
    const { jobs } = await chrome.storage.local.get('jobs');
    const all = Object.values(jobs || {}).filter(j => j.status === 'new' && !j.emailedAt && fits(j)).sort(order);
    if (!all.length) return;
    const line = j => `${j.score ?? '?'}% match - ${j.title}\n${j.company}${j.location ? ' - ' + j.location : ''}${(j.flags || []).length ? '\nNote: ' + j.flags.join(', ') : ''}\nApply: ${j.applyUrl || j.url}`;
    const co = all.filter(j => j.source === 'company'), po = all.filter(j => j.source !== 'company');
    const parts = [];
    if (co.length) parts.push(`===== COMPANY CAREER SITES (${co.length}) =====\n\n` + co.map(line).join('\n\n'));
    for (const site of ['linkedin', 'dice', 'indeed', 'ziprecruiter']) {
      const list = po.filter(j => j.source === site);
      if (list.length) parts.push(`===== ${SITE_LABELS[site].toUpperCase()} (${list.length}) =====\n\n` + list.map(line).join('\n\n'));
    }
    await sendEmail(settings, `JobPilot: ${all.length} new job match${all.length === 1 ? '' : 'es'}`, parts.join('\n\n\n'));
    await updateMeta({ lastEmail: { at: Date.now(), ok: true, count: all.length } });
    const fresh = (await chrome.storage.local.get('jobs')).jobs || {};
    const now = Date.now();
    for (const j of all) if (fresh[j.id]) fresh[j.id].emailedAt = now;
    await chrome.storage.local.set({ jobs: fresh });
  }
}

export async function sendEmail(settings, title, body) {
  const em = settings.email;
  if (!em.webAppUrl) throw new Error('Paste your Gmail sender link first (step 5 of the email setup).');
  const r = await fetch(em.webAppUrl, { method: 'POST', credentials: 'omit', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ secret: em.secret, subject: title, body }) });
  const t = (await r.text()).trim();
  if (!r.ok) throw new Error('Gmail sender answered ' + r.status);
  if (t !== 'ok') throw new Error(/bad secret/.test(t) ? 'The script code does not match. Copy the script again (step 2) and redeploy.' : /<html/i.test(t) ? 'Google returned a web page instead of "ok". In Apps Script, click Deploy → Manage deployments → ✎ edit → Version: New version → Deploy, then try again.' : t.slice(0, 120));
}

async function refreshBadge() {
  const { jobs, settings } = await getAll();
  const n = Object.values(jobs).filter(j => j.status === 'new' && (j.score ?? 100) >= settings.minMatch).length;
  chrome.action.setBadgeText({ text: n ? String(n > 99 ? '99+' : n) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2347C6' });
}

// ---------- apply tabs ----------
async function getApplyTabs() { return (await chrome.storage.session.get('applyTabs')).applyTabs || {}; }
async function setApplyTab(tabId, jobId) {
  const t = await getApplyTabs();
  if (jobId) t[tabId] = jobId; else delete t[tabId];
  await chrome.storage.session.set({ applyTabs: t });
}
chrome.tabs.onCreated.addListener(async tab => {
  if (!tab.openerTabId) return;
  const t = await getApplyTabs();
  if (t[tab.openerTabId]) await setApplyTab(tab.id, t[tab.openerTabId]);
});
chrome.tabs.onRemoved.addListener(id => setApplyTab(id, null));

// ---------- rescoring ----------
async function rescoreAll() {
  const { jobs: snap, settings, profile, skillGroups } = await getAll();
  const groups = compileGroups(skillGroups);
  const mySkills = resumeSkills(profile, groups);
  const upd = {}, move = {};
  for (const id in snap) {
    const j = snap[id];
    const ev = evaluateJob(j, { groups, mySkills, settings });
    const outside = !locationOk(j.location, settings) || !locationOk(j.title, { locationMode: 'us' });
    if (ev.removedReason || outside) move[id] = ev.removedReason || 'Outside your location';
    upd[id] = { score: ev.score, matched: ev.matched, missing: ev.missing, flags: ev.flags, years: ev.years };
  }
  // Apply to the latest list so nothing you changed meanwhile is lost.
  const d = await chrome.storage.local.get(['jobs', 'removed']);
  const jobs = d.jobs || {}, removed = d.removed || [];
  for (const id in jobs) {
    const j = jobs[id];
    if (move[id] && j.status === 'new' && !j.restored) {
      removed.unshift({ ...j, description: (j.description || '').slice(0, 8000), reason: move[id] });
      delete jobs[id];
    } else if (upd[id]) jobs[id] = { ...j, ...upd[id] };
  }
  await save({ jobs, removed: removed.slice(0, 1000) });
  refreshBadge();
}

// ---------- messages ----------
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  (async () => {
    switch (msg.type) {
      case 'scanNow': runScan(); return { ok: true };
      case 'settingsChanged': await setupAlarm(); refreshBadge(); return { ok: true };
      case 'rescoreAll': await rescoreAll(); return { ok: true };
      case 'refreshBadge': await refreshBadge(); return { ok: true };
      case 'testEmail': {
        const { settings } = await getAll();
        try { await sendEmail(settings, 'JobPilot test email', 'Email alerts work! New job matches will arrive like this after each scan.'); return { ok: true }; }
        catch (e) { return { ok: false, error: e.message }; }
      }
      case 'startApply': {
        const { jobs } = await getAll();
        const job = jobs[msg.jobId];
        if (!job) return { ok: false };
        if (job.status === 'new') await updateJob(job.id, { status: 'started' });
        const tab = await chrome.tabs.create({ url: job.url, active: true });
        await setApplyTab(tab.id, job.id);
        refreshBadge();
        return { ok: true };
      }
      case 'getApplyContext': {
        const tabId = sender.tab?.id;
        const map = await getApplyTabs();
        const { jobs, profile } = await getAll();
        const job = tabId != null && map[tabId] ? jobs[map[tabId]] : null;
        return { job, profile };
      }
      case 'setStatus': {
        let id = msg.jobId;
        if (!id && sender.tab) id = (await getApplyTabs())[sender.tab.id];
        if (!id) return { ok: false };
        await updateJob(id, { status: msg.status });
        refreshBadge();
        return { ok: true };
      }
      case 'fillActiveTab': {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return { ok: false };
        try { await chrome.tabs.sendMessage(tab.id, { type: 'fillNow', showPanel: true }); return { ok: true }; }
        catch (e) { return { ok: false, error: 'This page cannot be filled (try reloading it).' }; }
      }
      case 'aiTailor': {
        const { jobs, profile, settings } = await getAll();
        const job = jobs[msg.jobId];
        try {
          const ai = await aiTailor(job, profile, settings.ai);
          await updateJob(job.id, { ai });
          return { ok: true, ai };
        } catch (e) { return { ok: false, error: e.message }; }
      }
      case 'restoreRemoved': {
        const { removed, jobs, settings, profile, skillGroups } = await getAll();
        const i = removed.findIndex(r => r.id === msg.id);
        if (i === -1) return { ok: false };
        const r = removed.splice(i, 1)[0];
        const groups = compileGroups(skillGroups);
        const ev = evaluateJob(r, { groups, mySkills: resumeSkills(profile, groups), settings });
        jobs[r.id] = { ...r, ...ev, removedReason: '', restored: true, status: 'new', statusAt: Date.now() };
        await save({ jobs, removed });
        refreshBadge();
        return { ok: true };
      }
    }
    return { ok: false, error: 'unknown message' };
  })().then(reply);
  return true;
});
