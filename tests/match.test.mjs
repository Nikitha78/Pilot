// Unit tests for the matching, filtering and location logic. Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, DEFAULT_SKILL_GROUPS } from '../shared/defaults.js';
import { compileGroups, resumeSkills, evaluateJob, titleMatches, checkRules, requiredYears, dedupeKey } from '../shared/match.js';
import { locationOk, boardFromUrl, companyPageType, htmlToText } from '../shared/sources.js';

const groups = compileGroups(DEFAULT_SKILL_GROUPS);
const resume = { resumes: [{ text: 'Full Stack .NET Developer. C#, ASP.NET Core, ReactJS, MS SQL, Entity Framework, Azure DevOps pipelines, WCAG 2.1, REST APIs.' }], extraSkills: [] };
const mySkills = resumeSkills(resume, groups);
const evalJob = (title, description, settings = DEFAULT_SETTINGS) => evaluateJob({ title, description }, { groups, mySkills, settings });

test('synonyms count as the same skill (MS SQL = SQL Server)', () => {
  assert.ok(mySkills.has('SQL Server'));
  assert.ok(mySkills.has('React'));
});

test('score weights required skills above preferred ones', () => {
  const filler = ' x'.repeat(150);
  const ev = evalJob('.NET Developer', `Requirements: C#, ASP.NET Core, SQL Server, Docker.${filler}\nPreferred qualifications:\nKubernetes`);
  assert.ok(ev.score > 50 && ev.score < 100, `score was ${ev.score}`);
  assert.deepEqual(ev.missing.map(m => m.name).sort(), ['Docker', 'Kubernetes']);
  assert.equal(ev.missing.find(m => m.name === 'Docker').important, true);
});

test('filters remove citizen-only, clearance and 10+ year jobs', () => {
  assert.equal(evalJob('Dev', 'Must be a US citizen. C#').removedReason, 'US citizen / GC only');
  assert.equal(evalJob('Dev', 'Active secret clearance required').removedReason, 'Security clearance');
  assert.equal(evalJob('Dev', 'Requires 12+ years of software development experience').removedReason, '12+ years');
  assert.equal(evalJob('Dev', 'Founded 75 years ago. 3+ years experience with C#').removedReason, '');
});

test('title exclusions remove internships', () => {
  assert.match(evalJob('Software Engineering Intern', 'C#').removedReason, /intern/);
});

test('requiredYears ignores numbers unrelated to experience', () => {
  assert.equal(requiredYears('We have served clients for 40 years. 5+ years of experience in .NET'), 5);
});

test('phrase rules tolerate spacing and slashes', () => {
  const hits = checkRules('Candidates: USC / GC only please', DEFAULT_SETTINGS.rules);
  assert.equal(hits[0].id, 'citizen');
});

test('job titles are matched loosely against keywords', () => {
  const k = DEFAULT_SETTINGS.keywords;
  assert.ok(titleMatches('Sr. Full-Stack Engineer (React/C#)', k));
  assert.ok(titleMatches('Software Engineer - .NET', k));
  assert.ok(!titleMatches('Java Developer', k));
  assert.ok(!titleMatches('Data Analyst', k));
});

test('duplicates across sites share a key', () => {
  assert.equal(dedupeKey({ company: 'Acme, Inc.', title: '.NET Developer' }), dedupeKey({ company: 'acme', title: '.Net  Developer' }));
});

test('location: anywhere in the US, nothing abroad', () => {
  const us = { ...DEFAULT_SETTINGS, locationMode: 'us' };
  for (const l of ['Seattle, WA', 'Remote - US', 'Columbus, OH', '2 Locations', '']) assert.ok(locationOk(l, us), l);
  for (const l of ['Bangalore, India', 'Toronto, Ontario, Canada', 'QUEZON CITY, PH', 'London, UK']) assert.ok(!locationOk(l, us), l);
});

test('location: remote or near me', () => {
  const near = { ...DEFAULT_SETTINGS, locationMode: 'near', hybridLocation: 'Columbus, OH' };
  assert.ok(locationOk('Columbus, OH', near));
  assert.ok(locationOk('Remote - US', near));
  assert.ok(!locationOk('Austin, TX, United States', near));
});

test('company career boards are recognised from any job link', () => {
  assert.equal(boardFromUrl('https://www.linkedin.com/jobs/view/externalApply/1?url=https%3A%2F%2Fcat.wd5.myworkdayjobs.com%2Fen-US%2FCaterpillarCareers%2Fjob%2FX'), 'https://cat.wd5.myworkdayjobs.com/CaterpillarCareers');
  assert.equal(boardFromUrl('https://job-boards.greenhouse.io/figma/jobs/9'), 'https://boards.greenhouse.io/figma');
  assert.equal(boardFromUrl('https://example.com/jobs/1'), null);
  assert.equal(companyPageType('https://wd1.myworkdaysite.com/recruiting/wf/WellsFargoJobs').type, 'workday');
});

test('HTML job descriptions become readable text', () => {
  assert.equal(htmlToText('&lt;p&gt;Hello&lt;/p&gt;&lt;ul&gt;&lt;li&gt;C#&lt;/li&gt;&lt;/ul&gt;'), 'Hello\n• C#');
});
