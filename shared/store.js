// Storage helpers (chrome.storage.local). Everything stays on this computer.
import { DEFAULT_SETTINGS, DEFAULT_PROFILE, DEFAULT_SKILL_GROUPS, DEFAULT_COMPANIES, COMPANIES_VERSION } from './defaults.js';
import { dedupeKey } from './match.js';

export async function getAll() {
  const d = await chrome.storage.local.get(['settings', 'profile', 'skillGroups', 'jobs', 'removed', 'meta']);
  const st = d.settings || {};
  let companies = st.companies || DEFAULT_COMPANIES.map(c => ({ ...c }));
  if (st.companies && (st.companiesV || 1) < COMPANIES_VERSION) {
    // New default companies from an update are added to your existing list.
    for (const c of DEFAULT_COMPANIES) if (!companies.some(x => x.url === c.url)) companies.push({ ...c });
  }
  for (const u of st.companyPages || []) if (!companies.some(c => c.url === u)) companies.push({ name: u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0], url: u, enabled: true });
  const rules = [...(st.rules || DEFAULT_SETTINGS.rules)];
  for (const r of DEFAULT_SETTINGS.rules) if (!rules.some(x => x.id === r.id)) rules.splice(DEFAULT_SETTINGS.rules.indexOf(r), 0, { ...r });
  return {
    settings: { ...DEFAULT_SETTINGS, ...st, companies, companiesV: COMPANIES_VERSION, companyPages: [], rules,
      email: { ...DEFAULT_SETTINGS.email, ...(st.email || {}) },
      sites: { ...DEFAULT_SETTINGS.sites, ...((d.settings || {}).sites || {}) },
      ai: { ...DEFAULT_SETTINGS.ai, ...((d.settings || {}).ai || {}) },
      ntfy: { ...DEFAULT_SETTINGS.ntfy, ...((d.settings || {}).ntfy || {}) } },
    profile: { ...DEFAULT_PROFILE, ...(d.profile || {}) },
    skillGroups: d.skillGroups || DEFAULT_SKILL_GROUPS,
    jobs: d.jobs || {},
    removed: d.removed || [],
    meta: d.meta || { siteStatus: {}, lastScan: null, scanning: false, lastScanSummary: '' }
  };
}

export const save = obj => chrome.storage.local.set(obj);

export async function updateJob(id, patch) {
  const { jobs } = await chrome.storage.local.get('jobs');
  if (!jobs || !jobs[id]) return null;
  jobs[id] = { ...jobs[id], ...patch };
  if (patch.status) jobs[id].statusAt = Date.now();
  await chrome.storage.local.set({ jobs });
  return jobs[id];
}

export async function updateMeta(patch) {
  const { meta } = await chrome.storage.local.get('meta');
  const m = { siteStatus: {}, ...(meta || {}), ...patch };
  await chrome.storage.local.set({ meta: m });
  return m;
}

// ---------- "already seen" memory ----------
// Every job ever shown (by link id and by company+title) is remembered, so it never comes back,
// even after "Clear all jobs". Entries older than 60 days are forgotten.
function seedSeen(jobs, removed) {
  const seen = {}, now = Date.now();
  for (const j of [...Object.values(jobs || {}), ...(removed || [])]) { seen['i:' + j.id] = now; seen['k:' + dedupeKey(j)] = now; }
  return seen;
}
export async function getSeen() {
  const d = await chrome.storage.local.get(['seen', 'jobs', 'removed']);
  return d.seen || seedSeen(d.jobs, d.removed);
}
export const isSeen = (seen, j) => !!(seen['i:' + j.id] || seen['k:' + dedupeKey(j)]);

// Add new jobs to the list without ever overwriting what is already there. Returns the jobs actually added.
export async function commitJobs(newJobs = [], newRemoved = []) {
  const d = await chrome.storage.local.get(['jobs', 'removed', 'seen']);
  const jobs = d.jobs || {}, removed = d.removed || [];
  const seen = d.seen || seedSeen(jobs, removed);
  const now = Date.now(), added = [];
  const mark = j => { seen['i:' + j.id] = now; seen['k:' + dedupeKey(j)] = now; };
  for (const j of newJobs) {
    if (jobs[j.id] || isSeen(seen, j)) continue;
    jobs[j.id] = j; mark(j); added.push(j);
  }
  for (const r of newRemoved) {
    if (isSeen(seen, r)) continue;
    removed.unshift(r); mark(r);
  }
  const cutoff = now - 60 * 86400000;
  let keys = Object.keys(seen);
  for (const k of keys) if (seen[k] < cutoff) delete seen[k];
  keys = Object.keys(seen);
  if (keys.length > 40000) keys.sort((a, b) => seen[a] - seen[b]).slice(0, keys.length - 40000).forEach(k => delete seen[k]);
  await chrome.storage.local.set({ jobs, removed: removed.slice(0, 1000), seen });
  return added;
}
