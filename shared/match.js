// Matching, scoring and filtering. Pure functions (no Chrome APIs) so they can be tested.
import { parseSkillGroups } from './defaults.js';

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function normText(t) {
  return String(t || '').toLowerCase().replace(/[   ]/g, ' ').replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'");
}

function aliasRegex(alias) {
  const body = escapeRe(alias).replace(/\\ |\s+/g, '[\\s-]*');
  return new RegExp('(?<![a-z0-9])' + body + '(?![a-z0-9+#])', 'i');
}

// Compile once per groups text.
const cache = new Map();
export function compileGroups(groupsText) {
  if (cache.has(groupsText)) return cache.get(groupsText);
  const groups = parseSkillGroups(groupsText).map(g => ({ name: g.name, aliases: g.aliases, res: g.aliases.map(aliasRegex) }));
  cache.set(groupsText, groups);
  return groups;
}

export function findSkills(text, groups) {
  const t = normText(text);
  const out = new Set();
  for (const g of groups) if (g.res.some(r => r.test(t))) out.add(g.name);
  return out;
}

export function resumeSkills(profile, groups) {
  const text = (profile.resumes || []).map(r => r.text || '').join('\n');
  const set = findSkills(text, groups);
  for (const s of profile.extraSkills || []) set.add(s);
  return set;
}

const PREFERRED_RE = /(preferred|nice[\s-]to[\s-]have|bonus|desired|pluses|good to have)[^\n.:]{0,40}[:\n]/i;

export function requiredYears(text) {
  const t = normText(text);
  const re = /(\d{1,2})\s*\+?\s*(?:-|to)?\s*(?:\d{1,2})?\s*\+?\s*(?:years?|yrs?)/g;
  let max = 0, m;
  while ((m = re.exec(t))) {
    const n = parseInt(m[1], 10);
    if (n > 25) continue;
    const around = t.slice(Math.max(0, m.index - 40), m.index + m[0].length + 80);
    if (/experience|exp\b|hands[\s-]on|working with|developing|development/.test(around)) max = Math.max(max, n);
  }
  return max;
}

function phraseRegex(p) {
  const body = escapeRe(p.trim()).replace(/\s+/g, '\\s+').replace(/\//g, '\\s*/\\s*');
  return new RegExp('(?<![a-z0-9])' + body + '(?![a-z0-9])', 'i');
}

export function checkRules(text, rules) {
  const t = normText(text);
  const hits = [];
  for (const r of rules || []) {
    if (!r.enabled) continue;
    const phrases = String(r.phrases || '').split(',').map(s => s.trim()).filter(Boolean);
    const found = phrases.find(p => phraseRegex(p).test(t));
    if (found) hits.push({ id: r.id, label: r.label, mode: r.mode, phrase: found });
  }
  return hits;
}

// Score a job against the resume. Returns {score, matched, missing, flags, removedReason, years}
export function evaluateJob(job, { groups, mySkills, settings }) {
  const desc = job.description || '';
  const title = job.title || '';
  const full = title + '\n' + desc;

  // Filters
  const hits = checkRules(full, settings.rules);
  const years = requiredYears(desc);
  const removeHit = hits.find(h => h.mode === 'remove');
  let removedReason = removeHit ? removeHit.label : '';
  if (!removedReason && settings.maxYears && years >= settings.maxYears) removedReason = years + '+ years';
  if (!removedReason && settings.excludeTitleWords) {
    const tw = String(settings.excludeTitleWords).split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
    const hit = tw.find(w => new RegExp('(?<![a-z0-9])' + escapeRe(w) + '(?![a-z0-9])', 'i').test(title));
    if (hit) removedReason = 'Title has "' + hit + '"';
  }
  const flags = hits.filter(h => h.mode === 'warn').map(h => h.label);

  // Skills
  const nd = normText(desc);
  const pm = nd.search(PREFERRED_RE);
  const requiredPart = pm > 200 ? nd.slice(0, pm) : nd;
  const preferredPart = pm > 200 ? nd.slice(pm) : '';
  const inTitle = findSkills(title, groups);
  const inReq = findSkills(requiredPart, groups);
  const inPref = findSkills(preferredPart, groups);
  const all = new Set([...inTitle, ...inReq, ...inPref]);

  let total = 0, got = 0;
  const matched = [], missing = [];
  for (const s of all) {
    const w = inTitle.has(s) ? 3 : inReq.has(s) ? 2 : 1;
    total += w;
    if (mySkills.has(s)) { got += w; matched.push(s); }
    else missing.push({ name: s, important: w >= 2 });
  }
  missing.sort((a, b) => (b.important - a.important));
  const score = total ? Math.round((got / total) * 100) : null;
  return { score, matched, missing, flags, removedReason, years };
}

// Does a job title fit one of the search keywords?
const STOP = new Set(['and', 'or', 'the', 'a', 'an', 'of', 'with', 'in', 'sr', 'senior', 'jr', 'junior', 'lead', 'ii', 'iii', 'i', 'iv', 'remote', 'hybrid', 'mid', 'level', 'staff', 'principal']);
function titleTokens(s) {
  return normText(s)
    .replace(/full[\s-]*stack/g, ' fullstack ')
    .replace(/\.net|dotnet/g, ' dotnet ')
    .replace(/c#/g, ' csharp ')
    .replace(/\b(developer|engineer|programmer|dev|swe)s?\b/g, ' dev ')
    .split(/[^a-z0-9+#]+/).filter(w => w && !STOP.has(w));
}
export function titleMatches(title, keywords) {
  const tt = new Set(titleTokens(title));
  return (keywords || []).some(k => {
    const kt = titleTokens(k);
    if (!kt.length) return false;
    const hit = kt.filter(w => tt.has(w)).length;
    return hit / kt.length >= 0.6;
  });
}

export function dedupeKey(job) {
  const n = s => normText(s).replace(/\b(inc|llc|corp|corporation|co|ltd)\b\.?/g, '').replace(/[^a-z0-9]+/g, '');
  return n(job.company) + '|' + n(job.title);
}
