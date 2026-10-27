// Optional AI help (only used when you add your own Anthropic API key in Settings).

export async function aiTailor(job, profile, ai) {
  if (!ai.apiKey) throw new Error('Add your API key in Settings → AI first.');
  const resume = (profile.resumes || []).map(r => r.text).join('\n\n').slice(0, 15000);
  if (!resume.trim()) throw new Error('Upload your resume in the Profile tab first.');
  const prompt = `You are helping a job seeker apply. Compare the RESUME to the JOB and reply with ONLY a JSON object:
{"score": 0-100 realistic fit score,
 "missingMustHaves": [required skills from the job that the resume does not show],
 "bullets": [4-6 resume bullet points rewritten from the resume's REAL experience to use this job's wording; never invent skills, employers, numbers or tools the resume does not mention],
 "coverNote": "a short, plain cover note (120-160 words) using only facts from the resume",
 "summary": "one sentence on how well this fits and the biggest gap"}

JOB TITLE: ${job.title}
COMPANY: ${job.company}
JOB DESCRIPTION:
${(job.description || '').slice(0, 12000)}

RESUME:
${resume}`;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ai.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    },
    body: JSON.stringify({ model: ai.model || 'claude-haiku-4-5-20251001', max_tokens: 1500, messages: [{ role: 'user', content: prompt }] })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error?.message || ('AI request failed: ' + r.status));
  const text = (d.content || []).map(c => c.text || '').join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('AI reply could not be read. Try again.');
  return JSON.parse(m[0]);
}
