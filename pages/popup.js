import { getAll, save } from '../shared/store.js';
import { SITE_LABELS } from '../shared/sources.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function render() {
  const d = await getAll();
  const s = d.settings, m = d.meta;
  $('#enabled').checked = s.enabled;
  if (m.scanning) { $('#nextL').textContent = 'Scanning now'; $('#next').textContent = '…'; $('#nextSub').textContent = m.scanProgress || ''; }
  else if (!s.enabled) { $('#nextL').textContent = 'Auto-scan is off'; $('#next').textContent = '—'; $('#nextSub').textContent = ''; }
  else {
    const al = await chrome.alarms.get('scan');
    const left = Math.max(0, (al?.scheduledTime || m.nextScanAt || Date.now()) - Date.now());
    const h = Math.floor(left / 3600000), mi = Math.round((left % 3600000) / 60000);
    $('#nextL').textContent = 'Next scan in';
    $('#next').textContent = h ? `${h}h ${mi}m` : `${mi}m`;
    $('#nextSub').textContent = `Every ${s.intervalHours} hours · last scan ${m.lastScan ? new Date(m.lastScan).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'never'}`;
  }
  const jobs = Object.values(d.jobs);
  const today = new Date().toDateString();
  $('#cNew').textContent = jobs.filter(j => j.status === 'new' && (j.score ?? 100) >= s.minMatch).length;
  $('#cStarted').textContent = jobs.filter(j => j.status === 'started').length;
  $('#cApplied').textContent = jobs.filter(j => j.status === 'applied' && new Date(j.statusAt).toDateString() === today).length;
  $('#sites').innerHTML = ['linkedin', 'dice', 'indeed', 'ziprecruiter'].map(k => {
    const st = m.siteStatus?.[k];
    const badge = !s.sites[k] ? '<span class="off">Off</span>' : !st ? '<span class="off">Not scanned yet</span>' : st.ok ? '<span class="ok">OK</span>' : `<span class="bad" title="${esc(st.message)}">${esc(st.message)}</span>`;
    return `<div class="site"><span>${SITE_LABELS[k]}</span>${badge}</div>`;
  }).join('') + (() => {
    const on = (s.companies || []).filter(c => c.enabled);
    const bad = on.filter(c => m.companyStatus?.[c.url] && !m.companyStatus[c.url].ok).length;
    const badge = !s.sites.company ? '<span class="off">Off</span>' : bad ? `<span class="bad">${on.length} on · ${bad} not working</span>` : `<span class="ok">${on.length} on</span>`;
    return `<div class="site"><span>Company career sites</span>${badge}</div>`;
  })();
  $('#scan').disabled = !!m.scanning;
}

$('#enabled').addEventListener('change', async e => {
  const { settings } = await getAll();
  settings.enabled = e.target.checked;
  await save({ settings });
  await chrome.runtime.sendMessage({ type: 'settingsChanged' });
});
$('#open').addEventListener('click', () => { chrome.tabs.create({ url: chrome.runtime.getURL('pages/dashboard.html#jobs') }); window.close(); });
$('#scan').addEventListener('click', async () => { await chrome.runtime.sendMessage({ type: 'scanNow' }); $('#msg').textContent = 'Scan started.'; });
$('#fill').addEventListener('click', async () => {
  const r = await chrome.runtime.sendMessage({ type: 'fillActiveTab' });
  $('#msg').textContent = r.ok ? 'Filling… check the panel on the page.' : (r.error || 'Could not fill this page.');
});
chrome.storage.onChanged.addListener(render);
render();
