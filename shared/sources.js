// Search URLs for job boards and API readers for company career sites.

export const SITE_LABELS = { linkedin: 'LinkedIn', dice: 'Dice', indeed: 'Indeed', ziprecruiter: 'ZipRecruiter', company: 'Company site' };

export function searchUrls(site, s) {
  const days = Math.max(1, Number(s.postedWithinDays) || 1);
  const e = encodeURIComponent;
  const ft = s.fullTimeOnly;
  const modes = [];
  if (s.locationMode !== 'near') modes.push('us');
  else { if (s.remote) modes.push('remote'); if (s.hybrid && s.hybridLocation) modes.push('local'); }
  const urls = [];
  for (const k of s.keywords) for (const m of modes) {
    if (site === 'linkedin') {
      const loc = m === 'local' ? s.hybridLocation : 'United States';
      for (const start of m === 'us' ? [0, 10, 20, 30] : [0, 10]) {
        urls.push(`https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${e(k)}&location=${e(loc)}&f_TPR=r${days * 86400}${m === 'remote' ? '&f_WT=2' : ''}${ft ? '&f_JT=F' : ''}&start=${start}`);
      }
    } else if (site === 'indeed') {
      const loc = m === 'remote' ? 'Remote' : m === 'local' ? s.hybridLocation : 'United States';
      urls.push(`https://www.indeed.com/jobs?q=${e(k)}&l=${e(loc)}&fromage=${days}${m === 'local' ? '&radius=25' : ''}${ft ? '&jt=fulltime' : ''}`);
    } else if (site === 'dice') {
      const pd = days <= 1 ? 'ONE' : days <= 3 ? 'THREE' : 'SEVEN';
      const extra = `&filters.postedDate=${pd}${ft ? '&filters.employmentType=FULLTIME' : ''}`;
      urls.push(m === 'remote' ? `https://www.dice.com/jobs?q=${e(k)}${extra}&filters.workplaceTypes=Remote`
        : m === 'local' ? `https://www.dice.com/jobs?q=${e(k)}&location=${e(s.hybridLocation)}&radius=30&radiusUnit=mi${extra}`
        : `https://www.dice.com/jobs?q=${e(k)}&countryCode=US${extra}&pageSize=100`);
    } else if (site === 'ziprecruiter') {
      const loc = m === 'remote' ? 'Remote (USA)' : m === 'local' ? s.hybridLocation : 'USA';
      urls.push(`https://www.ziprecruiter.com/jobs-search?search=${e(k)}&location=${e(loc)}&days=${days}${m === 'remote' ? '&refine_by_location_type=only_remote' : ''}${ft ? '&employment_type=full_time' : ''}`);
    }
  }
  return urls;
}

export function htmlToText(html) {
  let s = String(html || '');
  const decode = x => x.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
  if (/&lt;[a-z]/i.test(s)) s = decode(s);
  s = s.replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ').replace(/<[^>]+>/g, ' ');
  return decode(s).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function companyPageType(url) {
  let m;
  if ((m = url.match(/https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/i)))
    return { type: 'workday', host: `https://${m[1]}.${m[2]}.myworkdayjobs.com`, tenant: m[1], site: m[3], base: `https://${m[1]}.${m[2]}.myworkdayjobs.com/${m[3]}` };
  if ((m = url.match(/https?:\/\/(wd\d+)\.myworkdaysite\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?recruiting\/([^/?#]+)\/([^/?#]+)/i)))
    return { type: 'workday', host: `https://${m[1]}.myworkdaysite.com`, tenant: m[2], site: m[3], base: `https://${m[1]}.myworkdaysite.com/recruiting/${m[2]}/${m[3]}` };
  if ((m = url.match(/greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i))) return { type: 'greenhouse', board: m[1] };
  if ((m = url.match(/jobs\.lever\.co\/([^/?#]+)/i))) return { type: 'lever', company: m[1] };
  if ((m = url.match(/jobs\.ashbyhq\.com\/([^/?#]+)/i))) return { type: 'ashby', org: m[1] };
  if ((m = url.match(/(?:jobs|careers)\.smartrecruiters\.com\/([^/?#]+)/i))) return { type: 'smartrecruiters', company: m[1] };
  if (/amazon\.jobs/i.test(url)) return { type: 'amazon' };
  return { type: 'generic' };
}

const DAY = 86400000;
const nice = s => s.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
async function getJson(url, opts) {
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(`site answered ${r.status}`);
  return r.json();
}

// Reads a company's job feed. Returns [{id,title,company,location,url,posted,description}]
export async function fetchCompanyApi(info, settings, companyName) {
  const days = Math.max(1, Number(settings.postedWithinDays) || 1);
  const cutoff = Date.now() - days * DAY - 6 * 3600000;
  const queries = (settings.companyQueries && settings.companyQueries.length) ? settings.companyQueries : settings.keywords;
  const out = [];
  if (info.type === 'greenhouse') {
    const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${info.board}/jobs`);
    for (const j of d.jobs || []) {
      const t = Date.parse(j.first_published || j.updated_at || '') || Date.now();
      if (t < cutoff) continue;
      out.push({ id: 'gh-' + j.id, title: j.title, company: companyName || j.company_name || nice(info.board), location: j.location?.name || '',
        url: j.absolute_url, posted: new Date(t).toLocaleDateString(), _apiDetail: `https://boards-api.greenhouse.io/v1/boards/${info.board}/jobs/${j.id}` });
    }
  } else if (info.type === 'lever') {
    for (const j of await getJson(`https://api.lever.co/v0/postings/${info.company}?mode=json`)) {
      if ((j.createdAt || 0) < cutoff) continue;
      const lists = (j.lists || []).map(l => l.text + '\n' + htmlToText(l.content)).join('\n');
      out.push({ id: 'lv-' + j.id, title: j.text, company: companyName || nice(info.company), location: j.categories?.location || '',
        url: j.hostedUrl, posted: new Date(j.createdAt).toLocaleDateString(), description: (j.descriptionPlain || '') + '\n' + lists + '\n' + (j.additionalPlain || '') });
    }
  } else if (info.type === 'ashby') {
    const d = await getJson(`https://api.ashbyhq.com/posting-api/job-board/${info.org}`);
    for (const j of d.jobs || []) {
      const t = Date.parse(j.publishedAt || '') || Date.now();
      if (t < cutoff) continue;
      out.push({ id: 'ab-' + j.id, title: j.title, company: companyName || nice(info.org), location: (j.isRemote ? 'Remote · ' : '') + (j.location || ''),
        url: j.jobUrl || `https://jobs.ashbyhq.com/${info.org}/${j.id}`, posted: new Date(t).toLocaleDateString(), description: j.descriptionPlain || htmlToText(j.descriptionHtml) });
    }
  } else if (info.type === 'smartrecruiters') {
    const seen = new Set();
    for (const q of queries) {
      const d = await getJson(`https://api.smartrecruiters.com/v1/companies/${info.company}/postings?q=${encodeURIComponent(q)}&limit=100`);
      for (const p of d.content || []) {
        if (seen.has(p.id)) continue; seen.add(p.id);
        const t = Date.parse(p.releasedDate || '') || Date.now();
        if (t < cutoff) continue;
        let description = '';
        try {
          const dd = await getJson(`https://api.smartrecruiters.com/v1/companies/${info.company}/postings/${p.id}`);
          description = Object.values(dd.jobAd?.sections || {}).map(x => htmlToText(x.text)).join('\n\n');
        } catch (e) { /* keep going */ }
        const loc = p.location || {};
        out.push({ id: 'sr-' + p.id, title: p.name, company: companyName || nice(info.company),
          location: (loc.remote ? 'Remote · ' : '') + [loc.city, loc.region, loc.country].filter(Boolean).join(', '),
          url: `https://jobs.smartrecruiters.com/${info.company}/${p.id}`, posted: new Date(t).toLocaleDateString(), description });
      }
    }
  } else if (info.type === 'amazon') {
    const seen = new Set();
    for (const q of queries) {
      const d = await getJson(`https://www.amazon.jobs/en/search.json?base_query=${encodeURIComponent(q)}&country=USA&result_limit=100&sort=recent`);
      for (const j of d.jobs || []) {
        const id = j.id_icims || j.id || j.job_path;
        if (seen.has(id)) continue; seen.add(id);
        const t = Date.parse(j.posted_date || '') || Date.now();
        if (t < cutoff) continue;
        out.push({ id: 'amz-' + id, title: j.title, company: 'Amazon', location: j.normalized_location || j.location || '',
          url: 'https://www.amazon.jobs' + (j.job_path || ''), posted: j.posted_date || '',
          description: [j.description, 'Basic qualifications:\n' + (j.basic_qualifications || ''), 'Preferred qualifications:\n' + (j.preferred_qualifications || '')].map(htmlToText).join('\n\n') });
      }
    }
  } else if (info.type === 'workday') {
    const api = `${info.host}/wday/cxs/${info.tenant}/${info.site}`;
    const seen = new Set();
    for (const q of queries) {
      const d = await getJson(api + '/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }) });
      for (const p of d.jobPostings || []) {
        if (!p.externalPath || seen.has(p.externalPath)) continue;
        seen.add(p.externalPath);
        const po = (p.postedOn || '').toLowerCase();
        const ago = /today/.test(po) ? 0 : /yesterday/.test(po) ? 1 : parseInt((po.match(/(\d+)\+?\s*day/) || [])[1] || '99', 10);
        if (ago > days) continue;
        out.push({ id: 'wd-' + info.tenant + p.externalPath.slice(-60), title: p.title, company: companyName || nice(info.tenant), location: p.locationsText || '',
          url: info.base + p.externalPath, posted: p.postedOn || '', _apiDetail: api + p.externalPath });
      }
    }
  }
  return out;
}

// Workday / Greenhouse descriptions are fetched only for jobs that pass the title/location checks.
export async function fetchApiDetail(j) {
  try {
    const dd = await getJson(j._apiDetail, { headers: { Accept: 'application/json' } });
    if (dd.jobPostingInfo) {
      j.description = htmlToText(dd.jobPostingInfo.jobDescription);
      if (!j.location && dd.jobPostingInfo.location) j.location = dd.jobPostingInfo.location;
      if (dd.jobPostingInfo.timeType) j.description = 'Time type: ' + dd.jobPostingInfo.timeType + '\n' + j.description;
    } else j.description = htmlToText(dd.content);
  } catch (e) { j.description = j.description || ''; }
  delete j._apiDetail;
  return j;
}

// Turn any job link into its company's career-board link (for auto-adding companies).
export function boardFromUrl(raw) {
  let u = String(raw || '');
  try { const x = new URL(u); const inner = x.searchParams.get('url') || x.searchParams.get('u'); if (inner && /^https?:/.test(inner)) u = inner; } catch (e) { return null; }
  const i = companyPageType(u);
  if (i.type === 'workday') return i.base;
  if (i.type === 'greenhouse' && !/^(embed|v1)$/.test(i.board)) return `https://boards.greenhouse.io/${i.board}`;
  if (i.type === 'lever') return `https://jobs.lever.co/${i.company}`;
  if (i.type === 'ashby') return `https://jobs.ashbyhq.com/${i.org}`;
  if (i.type === 'smartrecruiters') return `https://jobs.smartrecruiters.com/${i.company}`;
  return null;
}

// Location check. 'us' mode: anywhere in the United States or remote (drops only clearly non-US jobs).
// 'near' mode: remote or near my city. Unknown location counts as OK.
const NON_US = /\b(india|canada|united kingdom|\buk\b|england|london|germany|ireland|mexico|brazil|singapore|china|japan|poland|israel|australia|philippines|netherlands|france|spain|romania|costa rica|argentina|colombia|vietnam|pakistan|ukraine|portugal|czech|hungary|sweden|denmark|switzerland|bangalore|bengaluru|hyderabad|pune|chennai|toronto|vancouver|ontario|montreal|ottawa|calgary|quebec|emea|apac|latam|buenos aires|sao paulo|são paulo|mexico city|guadalajara|monterrey|bogota|bogotá|medellin|lima|santiago|krakow|kraków|warsaw|wroclaw|dublin|bucharest|cluj|sofia|bulgaria|belgrade|serbia|manila|cebu|taipei|taiwan|seoul|korea|tokyo|shanghai|beijing|shenzhen|hong kong|munich|berlin|paris|madrid|barcelona|amsterdam|prague|budapest|tel aviv|noida|gurgaon|gurugram|mumbai|delhi|kolkata|ahmedabad|sydney|melbourne|cairo|egypt|lagos|nigeria|nairobi|kenya|south africa|cape town|johannesburg|heredia|malaysia|kuala lumpur|thailand|bangkok|indonesia|jakarta|uruguay|montevideo|chile|peru|turkey|istanbul|uae|dubai|saudi|qatar|italy|milan|rome|belgium|brussels|austria|vienna|finland|norway|oslo|stockholm|copenhagen|zurich|geneva|scotland|edinburgh|wales|lisbon|porto|athens|greece|new zealand|auckland|philippines|quezon|makati|taguig|pasig|manila|davao)\b|,\s*(ph|mx|br|cn|jp|gb|uk|fr|es|it|pl|ro|ie|sg|au|nz|za|ng|ke|eg|ae|tr|ua|cz|hu|se|dk|fi|ch|nl|pt|gr|cr|cl|pe|uy|vn|th|kr|tw|hk|pk|bd|lk|np)\b/;
export function locationOk(text, settings) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return true;
  const usHint = /united states|\busa\b|\bu\.s\.|\bus\b|remote/.test(t);
  if (settings.locationMode !== 'near') return !(NON_US.test(t) && !/united states|\busa\b/.test(t));
  if (NON_US.test(t) && !usHint) return false;
  if (settings.remote && /remote|anywhere|virtual|work from home|wfh/.test(t)) return true;
  if (settings.hybrid && settings.hybridLocation) {
    const city = settings.hybridLocation.toLowerCase().split(',')[0].trim();
    if (city && t.includes(city)) return true;
    if (/columbus/.test(city) && /\bohio\b|,\s*oh\b|\boh\b,/.test(t)) return true;
  }
  if (/^(united states|usa|us|u\.s\.)( of america)?$/.test(t.trim())) return true;
  if (/,\s*[a-z]{2}\b|united states|\busa\b/.test(t)) return false;
  return true;
}
