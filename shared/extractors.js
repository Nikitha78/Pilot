// These functions run INSIDE the job-site pages (via chrome.scripting.executeScript),
// so each one must be fully self-contained (no outside variables or imports).

export function extractList(site) {
  const txt = el => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const blocked = (() => {
    const t = document.title || '';
    const u = location.href;
    if (/just a moment|attention required|security check|are you a robot|captcha|access denied/i.test(t)) return 'Security check — open the site and complete it';
    if (/\/(login|signin|sign-in|authwall|checkpoint|uas\/login)/i.test(u)) return 'Login needed';
    if (document.querySelector('#challenge-form, iframe[src*="captcha"], iframe[src*="challenges.cloudflare"]')) return 'Security check — open the site and complete it';
    return null;
  })();
  const out = [];
  const seen = new Set();
  const push = j => { if (j.id && j.title && !seen.has(j.id)) { seen.add(j.id); out.push(j); } };

  if (site === 'linkedin') {
    document.querySelectorAll('.base-card, .job-search-card, li').forEach(card => {
      const a = card.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]');
      if (!a) return;
      const urn = card.getAttribute('data-entity-urn') || (card.querySelector('[data-entity-urn]') || {}).getAttribute?.('data-entity-urn') || '';
      const id = (urn.match(/(\d{6,})/) || a.href.match(/-(\d{6,})(?:\?|$)/) || a.href.match(/view\/(\d{6,})/) || [])[1];
      if (!id) return;
      push({ id: 'li-' + id, extId: id,
        title: txt(card.querySelector('.base-search-card__title, h3')) || txt(a),
        company: txt(card.querySelector('.base-search-card__subtitle, h4')),
        location: txt(card.querySelector('.job-search-card__location')),
        posted: txt(card.querySelector('time')),
        url: 'https://www.linkedin.com/jobs/view/' + id + '/' });
    });
  } else if (site === 'indeed') {
    document.querySelectorAll('[data-jk]').forEach(el => {
      const jk = el.getAttribute('data-jk');
      const card = el.closest('td.resultContent, li, .job_seen_beacon') || el.parentElement;
      push({ id: 'in-' + jk, extId: jk,
        title: txt(card.querySelector('h2 span[title], h2 a span, h2')) || txt(el),
        company: txt(card.querySelector('[data-testid="company-name"], .companyName')),
        location: txt(card.querySelector('[data-testid="text-location"], .companyLocation')),
        posted: txt((card.closest('li') || card).querySelector('[data-testid="myJobsStateDate"], .date')),
        url: 'https://www.indeed.com/viewjob?jk=' + jk });
    });
  } else if (site === 'dice') {
    document.querySelectorAll('a[href*="/job-detail/"]').forEach(a => {
      const id = (a.href.match(/job-detail\/([a-z0-9-]{8,})/i) || [])[1];
      if (!id) return;
      let card = a.closest('[data-testid*="card"], dhi-search-card, article, li') || a.parentElement;
      for (let i = 0; i < 4 && card && txt(card).length < 40; i++) card = card.parentElement;
      const links = [...card.querySelectorAll('a[href*="/job-detail/"]')].map(txt).filter(Boolean);
      const title = links.sort((x, y) => y.length - x.length)[0] || txt(a);
      const comp = card.querySelector('a[href*="company-profile"], [data-cy="search-result-company-name"], [data-testid*="company"]');
      const loc = card.querySelector('[data-cy="search-result-location"], [data-testid*="location"]');
      const posted = card.querySelector('[data-cy="card-posted-date"], [data-testid*="posted"]');
      push({ id: 'di-' + id, extId: id, title, company: txt(comp), location: txt(loc), posted: txt(posted),
        url: 'https://www.dice.com/job-detail/' + id });
    });
  } else if (site === 'ziprecruiter') {
    const cards = document.querySelectorAll('article, [data-testid*="job-card"], .job_result, li.job-listing');
    cards.forEach(card => {
      const a = card.querySelector('a[href*="/c/"], a[href*="/k/"], a[href*="/jobs/"], a[href*="jid="], a[href*="/job/"]') || card.querySelector('a[href]');
      if (!a) return;
      const title = txt(card.querySelector('h2, h3, [data-testid*="title"]')) || txt(a);
      const idm = a.href.match(/jid=([a-z0-9]+)/i) || a.href.match(/\/([a-z0-9]{8,})(?:\?|$)/i);
      const id = idm ? idm[1] : a.href.replace(/[?#].*/, '');
      push({ id: 'zr-' + id.slice(-40), extId: id, title,
        company: txt(card.querySelector('[data-testid*="company"], a[href*="/co/"], .company_name, .hiring_company')),
        location: txt(card.querySelector('[data-testid*="location"], .location')),
        posted: '', url: a.href });
    });
  } else {
    // Company careers page: every link that looks like a job posting.
    const host = location.hostname.replace(/^www\./, '');
    const GENERIC = /^(learn more|apply( now)?|view( job| details)?|details|see more|read more|more info|job details)$/i;
    const JOBLINK = /job|position|requisition|opening|vacanc|career|posting|jid=|\/\d{5,}/i;
    document.querySelectorAll('a[href]').forEach(a => {
      if (!/^https?:/.test(a.href) || !JOBLINK.test(a.href)) return;
      let t = txt(a);
      const card = a.closest('li, article, tr, [role="listitem"], [class*="job" i], [class*="card" i], [class*="result" i]') || a.parentElement;
      const head = txt(card && card.querySelector('h1, h2, h3, h4, [class*="title" i]'));
      if (head && head.length >= 5 && head.length <= 140 && (!t || GENERIC.test(t) || t.length < 5 || t.includes(head))) t = head;
      t = (t || '').replace(/\b(bookmark_border|bookmark|share|learn more|apply now)\b.*$/i, '').trim();
      if (!t || t.length < 5 || t.length > 140) return;
      t = t.split(/\s{2,}|\n/)[0];
      const cardText = card ? txt(card).slice(0, 300) : '';
      push({ id: 'co-' + a.href.replace(/#.*$/, '').replace(/[?&](q|query|keyword|keywords|search|base_query|jk)=[^&]*/gi, '').slice(-140), title: t, company: '', location: cardText.replace(t, '').replace(/learn more|apply now|view job|view details|see more|read more/gi, '').replace(/\s+/g, ' ').trim().slice(0, 160),
        posted: '', url: a.href });
    });
  }
  return { blocked, jobs: out.slice(0, 200) };
}

export function extractDetail() {
  const ATS = /myworkdayjobs\.com|myworkdaysite\.com|greenhouse\.io|lever\.co|ashbyhq\.com|smartrecruiters\.com/i;
  const findApply = () => {
    const code = document.getElementById('applyUrl');
    if (code) { const m = code.innerHTML.match(/"(https?:[^"]+)"/); if (m) return m[1].replace(/&amp;/g, '&'); }
    const a = [...document.querySelectorAll('a[href]')].find(x => ATS.test(x.href) || ATS.test(decodeURIComponent(x.href)));
    return a ? a.href : '';
  };
  const done = r => ({ ...r, applyUrl: r.blocked ? '' : findApply() });
  const r0 = extractDetailInner();
  return done(r0);
  function extractDetailInner() {
  const txt = el => (el ? (el.innerText || el.textContent || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim() : '');
  const t = document.title || '';
  if (/just a moment|attention required|security check|captcha|access denied/i.test(t)) return { blocked: 'Security check', text: '' };
  const sels = ['.show-more-less-html__markup', '.description__text', '.jobs-description__content', '#jobDescriptionText',
    '[data-testid="jobDescriptionHtml"]', '#jobDescription', '.job-description', '.job_description', '[class*="jobDescription"]',
    '[class*="job_description"]', '[class*="job-description"]', '[data-automation-id="jobPostingDescription"]', '#content .body', '.posting-page'];
  for (const s of sels) {
    const el = document.querySelector(s);
    const v = txt(el);
    if (v.length > 300) return { blocked: null, text: v.slice(0, 20000) };
  }
  // Fallback: the biggest block of non-link text on the page.
  let best = null, bestScore = 0;
  document.querySelectorAll('main, article, section, div').forEach(el => {
    const v = txt(el);
    if (v.length < 300 || v.length > 30000) return;
    const linkLen = [...el.querySelectorAll('a')].reduce((n, a) => n + txt(a).length, 0);
    const score = v.length - linkLen * 3 - (el.querySelectorAll('div').length * 2);
    if (score > bestScore) { bestScore = score; best = v; }
  });
  return { blocked: null, text: (best || txt(document.body)).slice(0, 20000) };
}
}
