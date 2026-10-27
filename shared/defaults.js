// Default settings, profile, filter rules and skill keyword groups.
// Everything here can be edited from the dashboard (Settings / Profile tabs).

export const DEFAULT_SETTINGS = {
  enabled: true,
  keywords: ['.NET Full Stack Developer', 'Full Stack Developer', '.NET Developer'],
  remote: true,
  hybrid: true,
  hybridLocation: 'Columbus, OH',
  postedWithinDays: 1,          // 1 = last 24 hours
  sites: { linkedin: true, dice: true, indeed: true, ziprecruiter: true, company: true },
  companyPages: [],             // (old setting, moved into companies)
  companies: null,              // null = use DEFAULT_COMPANIES
  companyQueries: ['.NET', 'Full Stack'],   // what to type into company career-site search boxes
  locationMode: 'us',           // 'us' = anywhere in the United States (incl. remote), 'near' = remote or near my location
  onlyMyLocation: true,
  fullTimeOnly: true,
  autoAddCompanies: true,       // add a company's career site when a portal job links to it
  intervalHours: 3,
  activeStart: 7,               // scans only run between these hours (24h clock)
  activeEnd: 23,
  maxNewPerScan: 60,            // how many new job descriptions to open per scan
  minMatch: 50,                 // jobs below this score are hidden (not deleted)
  titleMustMatch: true,         // drop results whose title has nothing to do with your keywords
  excludeTitleWords: 'intern, internship, co-op, apprentice, student, graduate program',
  maxYears: 10,                 // remove jobs asking for this many years or more
  rules: [
    { id: 'citizen', label: 'US citizen / GC only', mode: 'remove', enabled: true,
      phrases: 'us citizens only, u.s. citizens only, us citizen only, u.s. citizen only, must be a us citizen, must be a u.s. citizen, citizenship required, us citizenship is required, gc only, green card only, green card holders only, usc/gc, usc or gc, usc and gc, gc/usc, gc or usc, usc only, only usc, citizens or green card' },
    { id: 'clearance', label: 'Security clearance', mode: 'remove', enabled: true,
      phrases: 'security clearance, secret clearance, top secret, ts/sci, active clearance, clearance required, public trust clearance, dod clearance, must be able to obtain a clearance' },
    { id: 'noc2c', label: 'No C2C', mode: 'remove', enabled: true,
      phrases: 'no c2c, no corp to corp, no corp-to-corp, w2 only, no third party, no 3rd party, no third-party' },
    { id: 'notfulltime', label: 'Contract / part-time', mode: 'remove', enabled: true,
      phrases: 'contract position, contract role, contract only, contract to hire, contract-to-hire, c2h, 6 month contract, 6-month contract, 12 month contract, 12-month contract, part-time position, part time position, temporary position, temp position, employment type: contract, job type: contract, duration: 6 months, duration: 12 months, time type: part time, 1099' },
    { id: 'sponsor', label: 'No sponsorship', mode: 'warn', enabled: true,
      phrases: 'no sponsorship, not able to sponsor, unable to sponsor, will not sponsor, cannot sponsor, sponsorship is not available, sponsorship not available, without sponsorship' },
    { id: 'onsite', label: 'Onsite only', mode: 'warn', enabled: true,
      phrases: '100% onsite, fully onsite, onsite only, on-site only, 5 days onsite, 5 days a week in office' }
  ],
  ai: { enabled: false, apiKey: '', model: 'claude-haiku-4-5-20251001' },
  ntfy: { enabled: false, server: 'https://ntfy.sh', topic: '' },
  email: { enabled: false, address: '', topic: '', webAppUrl: '', secret: '' }
};

// Company career sites. {q} is replaced with each search term.
// Workday, Greenhouse, Lever, Ashby, SmartRecruiters and Amazon links are read through their job feeds.
// Any other link is opened and scanned for job titles.
const wd = (tenant, n, site) => `https://${tenant}.wd${n}.myworkdayjobs.com/${site}`;
export const DEFAULT_COMPANIES = [
  // Big tech
  ['Google', 'https://www.google.com/about/careers/applications/jobs/results/?q={q}&location=United%20States'],
  ['Amazon', 'https://www.amazon.jobs/en/search?base_query={q}&country=USA'],
  ['Microsoft', 'https://apply.careers.microsoft.com/careers?query={q}&location=United%20States'],
  ['Apple', 'https://jobs.apple.com/en-us/search?search={q}&location=united-states-USA'],
  ['Meta', 'https://www.metacareers.com/jobs?q={q}'],
  ['Tesla', 'https://www.tesla.com/careers/search/?query={q}&site=US'],
  ['Netflix', 'https://explore.jobs.netflix.net/careers?query={q}'],
  ['NVIDIA', wd('nvidia', 5, 'NVIDIAExternalCareerSite')],
  ['Salesforce', wd('salesforce', 12, 'External_Career_Site')],
  ['Adobe', wd('adobe', 5, 'external_experienced')],
  ['Intel', wd('intel', 1, 'External')],
  ['IBM', 'https://www.ibm.com/careers/search?q={q}'],
  ['Oracle', 'https://careers.oracle.com/jobs/#en/sites/jobsearch/requisitions?keyword={q}&location=United%20States'],
  ['Cisco', 'https://jobs.cisco.com/jobs/SearchJobs/{q}'],
  ['Dell', wd('dell', 1, 'External')],
  ['HP', wd('hp', 5, 'ExternalCareerSite')],
  ['Workday', wd('workday', 5, 'Workday')],
  ['Red Hat', wd('redhat', 5, 'jobs')],
  ['Uber', 'https://www.uber.com/us/en/careers/list/?query={q}'],
  ['Lyft', 'https://boards.greenhouse.io/lyft'],
  ['Airbnb', 'https://boards.greenhouse.io/airbnb'],
  ['Stripe', 'https://boards.greenhouse.io/stripe'],
  ['Databricks', 'https://boards.greenhouse.io/databricks'],
  ['Coinbase', 'https://boards.greenhouse.io/coinbase'],
  ['Robinhood', 'https://boards.greenhouse.io/robinhood'],
  ['Reddit', 'https://boards.greenhouse.io/reddit'],
  ['Pinterest', 'https://boards.greenhouse.io/pinterest'],
  ['Dropbox', 'https://boards.greenhouse.io/dropbox'],
  ['Twilio', 'https://boards.greenhouse.io/twilio'],
  ['Instacart', 'https://boards.greenhouse.io/instacart'],
  ['Figma', 'https://boards.greenhouse.io/figma'],
  ['Cloudflare', 'https://boards.greenhouse.io/cloudflare'],
  ['Datadog', 'https://boards.greenhouse.io/datadog'],
  ['MongoDB', 'https://boards.greenhouse.io/mongodb'],
  ['GitLab', 'https://boards.greenhouse.io/gitlab'],
  ['Okta', 'https://boards.greenhouse.io/okta'],
  ['Roku', 'https://boards.greenhouse.io/roku'],
  ['Duolingo', 'https://boards.greenhouse.io/duolingo'],
  ['Affirm', 'https://boards.greenhouse.io/affirm'],
  ['Chime', 'https://boards.greenhouse.io/chime'],
  ['Samsara', 'https://boards.greenhouse.io/samsara'],
  ['Palantir', 'https://jobs.lever.co/palantir'],
  ['Plaid', 'https://jobs.lever.co/plaid'],
  ['OpenAI', 'https://jobs.ashbyhq.com/openai'],
  ['Ramp', 'https://jobs.ashbyhq.com/ramp'],
  ['Notion', 'https://jobs.ashbyhq.com/notion'],
  ['Intuit', 'https://jobs.intuit.com/search-jobs/{q}'],
  ['Qualcomm', 'https://careers.qualcomm.com/careers?query={q}'],
  ['AMD', 'https://careers.amd.com/careers-home/jobs?keywords={q}'],
  ['ServiceNow', 'https://jobs.smartrecruiters.com/ServiceNow'],
  ['Visa', 'https://jobs.smartrecruiters.com/Visa'],
  ['Zillow', wd('zillow', 5, 'Zillow_Group_External')],
  ['Motorola Solutions', wd('motorolasolutions', 5, 'Careers')],
  // Banks, finance, insurance
  ['JPMorgan Chase', 'https://jpmc.fa.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1001/requisitions?keyword={q}'],
  ['Bank of America', wd('ghr', 1, 'lateral-us')],
  ['Wells Fargo', 'https://wd1.myworkdaysite.com/recruiting/wf/WellsFargoJobs'],
  ['Citi', wd('citi', 5, '2')],
  ['Capital One', wd('capitalone', 12, 'Capital_One')],
  ['Goldman Sachs', 'https://higher.gs.com/results?search={q}'],
  ['Morgan Stanley', 'https://morganstanley.eightfold.ai/careers?query={q}'],
  ['American Express', 'https://aexp.eightfold.ai/careers?query={q}'],
  ['Mastercard', wd('mastercard', 1, 'CorporateCareers')],
  ['PayPal', wd('paypal', 1, 'jobs')],
  ['Fidelity', wd('fmr', 1, 'FidelityCareers')],
  ['US Bank', wd('usbank', 1, 'US_Bank_Careers')],
  ['Truist', wd('truist', 1, 'Careers')],
  ['State Street', wd('statestreet', 1, 'Global')],
  ['Northern Trust', wd('ntrs', 1, 'northerntrust')],
  ['Equifax', wd('equifax', 5, 'External')],
  ['Travelers', wd('travelers', 5, 'External')],
  ['Allstate', wd('allstate', 5, 'allstate_careers')],
  ['Liberty Mutual', wd('libertymutual', 5, 'LMI')],
  // Healthcare
  ['UnitedHealth / Optum', 'https://careers.unitedhealthgroup.com/job-search-results/?keyword={q}'],
  ['CVS Health', wd('cvshealth', 1, 'CVS_Health_Careers')],
  ['Humana', wd('humana', 5, 'Humana_External_Career_Site')],
  ['Elevance Health', wd('elevancehealth', 1, 'ANT')],
  ['Cigna', wd('cigna', 5, 'cignacareers')],
  ['Pfizer', wd('pfizer', 1, 'PfizerCareers')],
  ['Abbott', wd('abbott', 5, 'abbottcareers')],
  ['Medtronic', wd('medtronic', 1, 'MedtronicCareers')],
  // Retail, telecom, industry, consulting
  ['Walmart', wd('walmart', 5, 'WalmartExternal')],
  ['Target', wd('target', 5, 'targetcareers')],
  ['Nike', wd('nike', 1, 'nke')],
  ['Disney', wd('disney', 5, 'disneycareer')],
  ['Comcast', wd('comcast', 5, 'Comcast_Careers')],
  ['Verizon', wd('verizon', 12, 'verizon-careers')],
  ['T-Mobile', wd('tmobile', 1, 'External')],
  ['Boeing', wd('boeing', 1, 'EXTERNAL_CAREERS')],
  ['General Motors', wd('generalmotors', 5, 'Careers_GM')],
  ['3M', wd('3m', 1, 'Search')],
  ['Procter & Gamble', 'https://www.pgcareers.com/global/en/search-results?keywords={q}'],
  ['Accenture', 'https://www.accenture.com/us-en/careers/jobsearch?jk={q}'],
  ['Deloitte', 'https://apply.deloitte.com/careers/SearchJobs/{q}'],
  ['PwC', wd('pwc', 3, 'Global_Experienced_Careers')],
  // Columbus / Ohio
  ['Nationwide', wd('nationwide', 1, 'Nationwide_Career')],
  ['Cardinal Health', wd('cardinalhealth', 1, 'EXT')],
  ['Huntington Bank', wd('huntington', 12, 'HNBcareers')],
  ['Ohio State University', wd('osu', 1, 'OSUCareers')],
  ['Progressive', 'https://careers.progressive.com/search/jobs?q={q}'],
  ['Honda', 'https://careers.honda.com/us/en/search-results?keywords={q}'],
  ['American Electric Power', wd('aep', 1, 'AEPCareerSite')],
  ['Fifth Third Bank', wd('fifththird', 5, '53careers')],
  ['Sherwin-Williams', wd('sherwin', 1, 'External')],
  ['KeyBank', wd('keybank', 5, 'External_Career_Site')]
].map(([name, url]) => ({ name, url, enabled: true }));

// Added in v1.5 (~400 more). Names are fixed up to look nice.
const pretty = s => /^[a-z0-9]+$/.test(s) ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const EXTRA = [
  ['anthropic', 'https://boards.greenhouse.io/anthropic'],
  ['discord', 'https://boards.greenhouse.io/discord'],
  ['gusto', 'https://boards.greenhouse.io/gusto'],
  ['brex', 'https://boards.greenhouse.io/brex'],
  ['asana', 'https://boards.greenhouse.io/asana'],
  ['squarespace', 'https://boards.greenhouse.io/squarespace'],
  ['elastic', 'https://boards.greenhouse.io/elastic'],
  ['confluent', 'https://boards.greenhouse.io/confluent'],
  ['cockroachlabs', 'https://boards.greenhouse.io/cockroachlabs'],
  ['airtable', 'https://boards.greenhouse.io/airtable'],
  ['webflow', 'https://boards.greenhouse.io/webflow'],
  ['grammarly', 'https://boards.greenhouse.io/grammarly'],
  ['carta', 'https://boards.greenhouse.io/carta'],
  ['nerdwallet', 'https://boards.greenhouse.io/nerdwallet'],
  ['sofi', 'https://boards.greenhouse.io/sofi'],
  ['marqeta', 'https://boards.greenhouse.io/marqeta'],
  ['toast', 'https://boards.greenhouse.io/toast'],
  ['flexport', 'https://boards.greenhouse.io/flexport'],
  ['faire', 'https://boards.greenhouse.io/faire'],
  ['peloton', 'https://boards.greenhouse.io/peloton'],
  ['warbyparker', 'https://boards.greenhouse.io/warbyparker'],
  ['betterment', 'https://boards.greenhouse.io/betterment'],
  ['wealthfront', 'https://boards.greenhouse.io/wealthfront'],
  ['vercel', 'https://boards.greenhouse.io/vercel'],
  ['netlify', 'https://boards.greenhouse.io/netlify'],
  ['postman', 'https://boards.greenhouse.io/postman'],
  ['launchdarkly', 'https://boards.greenhouse.io/launchdarkly'],
  ['pagerduty', 'https://boards.greenhouse.io/pagerduty'],
  ['newrelic', 'https://boards.greenhouse.io/newrelic'],
  ['sumologic', 'https://boards.greenhouse.io/sumologic'],
  ['amplitude', 'https://boards.greenhouse.io/amplitude'],
  ['mixpanel', 'https://boards.greenhouse.io/mixpanel'],
  ['braze', 'https://boards.greenhouse.io/braze'],
  ['attentive', 'https://boards.greenhouse.io/attentive'],
  ['klaviyo', 'https://boards.greenhouse.io/klaviyo'],
  ['intercom', 'https://boards.greenhouse.io/intercom'],
  ['gong', 'https://boards.greenhouse.io/gong'],
  ['highspot', 'https://boards.greenhouse.io/highspot'],
  ['applovin', 'https://boards.greenhouse.io/applovin'],
  ['roblox', 'https://boards.greenhouse.io/roblox'],
  ['riotgames', 'https://boards.greenhouse.io/riotgames'],
  ['epicgames', 'https://boards.greenhouse.io/epicgames'],
  ['lucidsoftware', 'https://boards.greenhouse.io/lucidsoftware'],
  ['opendoor', 'https://boards.greenhouse.io/opendoor'],
  ['thumbtack', 'https://boards.greenhouse.io/thumbtack'],
  ['nextdoor', 'https://boards.greenhouse.io/nextdoor'],
  ['wayfair', 'https://boards.greenhouse.io/wayfair'],
  ['upstart', 'https://boards.greenhouse.io/upstart'],
  ['sproutsocial', 'https://boards.greenhouse.io/sproutsocial'],
  ['oscar', 'https://boards.greenhouse.io/oscar'],
  ['lemonade', 'https://boards.greenhouse.io/lemonade'],
  ['nuro', 'https://boards.greenhouse.io/nuro'],
  ['aurorainnovation', 'https://boards.greenhouse.io/aurorainnovation'],
  ['scaleai', 'https://boards.greenhouse.io/scaleai'],
  ['mercury', 'https://boards.greenhouse.io/mercury'],
  ['doordashusa', 'https://boards.greenhouse.io/doordashusa'],
  ['gopuff', 'https://boards.greenhouse.io/gopuff'],
  ['zocdoc', 'https://boards.greenhouse.io/zocdoc'],
  ['calendly', 'https://boards.greenhouse.io/calendly'],
  ['servicetitan', 'https://boards.greenhouse.io/servicetitan'],
  ['procoretechnologies', 'https://boards.greenhouse.io/procoretechnologies'],
  ['hubspotjobs', 'https://boards.greenhouse.io/hubspotjobs'],
  ['urbancompass', 'https://boards.greenhouse.io/urbancompass'],
  ['circle', 'https://boards.greenhouse.io/circle'],
  ['gemini', 'https://boards.greenhouse.io/gemini'],
  ['ripple', 'https://boards.greenhouse.io/ripple'],
  ['kraken', 'https://boards.greenhouse.io/kraken'],
  ['chainalysis', 'https://boards.greenhouse.io/chainalysis'],
  ['fivetran', 'https://boards.greenhouse.io/fivetran'],
  ['dbtlabsinc', 'https://boards.greenhouse.io/dbtlabsinc'],
  ['starburst', 'https://boards.greenhouse.io/starburst'],
  ['clickhouse', 'https://boards.greenhouse.io/clickhouse'],
  ['yugabyte', 'https://boards.greenhouse.io/yugabyte'],
  ['redis', 'https://boards.greenhouse.io/redis'],
  ['cockroachdb', 'https://boards.greenhouse.io/cockroachdb'],
  ['singlestore', 'https://boards.greenhouse.io/singlestore'],
  ['pinecone', 'https://boards.greenhouse.io/pinecone'],
  ['weightsandbiases', 'https://boards.greenhouse.io/weightsandbiases'],
  ['hashicorp', 'https://boards.greenhouse.io/hashicorp'],
  ['snyk', 'https://boards.greenhouse.io/snyk'],
  ['tanium', 'https://boards.greenhouse.io/tanium'],
  ['lacework', 'https://boards.greenhouse.io/lacework'],
  ['abnormalsecurity', 'https://boards.greenhouse.io/abnormalsecurity'],
  ['arcticwolf', 'https://boards.greenhouse.io/arcticwolf'],
  ['1password', 'https://boards.greenhouse.io/1password'],
  ['bitwarden', 'https://boards.greenhouse.io/bitwarden'],
  ['coalfire', 'https://boards.greenhouse.io/coalfire'],
  ['drata', 'https://boards.greenhouse.io/drata'],
  ['expel', 'https://boards.greenhouse.io/expel'],
  ['huntress', 'https://boards.greenhouse.io/huntress'],
  ['keepersecurity', 'https://boards.greenhouse.io/keepersecurity'],
  ['securityscorecard', 'https://boards.greenhouse.io/securityscorecard'],
  ['sonatype', 'https://boards.greenhouse.io/sonatype'],
  ['tines', 'https://boards.greenhouse.io/tines'],
  ['netskope', 'https://boards.greenhouse.io/netskope'],
  ['illumio', 'https://boards.greenhouse.io/illumio'],
  ['wiz', 'https://boards.greenhouse.io/wiz'],
  ['orca', 'https://boards.greenhouse.io/orca'],
  ['crowdstrike', 'https://boards.greenhouse.io/crowdstrike'],
  ['druva', 'https://boards.greenhouse.io/druva'],
  ['rubrik', 'https://boards.greenhouse.io/rubrik'],
  ['cohesity', 'https://boards.greenhouse.io/cohesity'],
  ['nutanix', 'https://boards.greenhouse.io/nutanix'],
  ['purestorage', 'https://boards.greenhouse.io/purestorage'],
  ['netapp', 'https://boards.greenhouse.io/netapp'],
  ['commvault', 'https://boards.greenhouse.io/commvault'],
  ['veeam', 'https://boards.greenhouse.io/veeam'],
  ['backblaze', 'https://boards.greenhouse.io/backblaze'],
  ['digitalocean', 'https://boards.greenhouse.io/digitalocean'],
  ['linode', 'https://boards.greenhouse.io/linode'],
  ['fastly', 'https://boards.greenhouse.io/fastly'],
  ['akamai', 'https://boards.greenhouse.io/akamai'],
  ['cloudinary', 'https://boards.greenhouse.io/cloudinary'],
  ['contentful', 'https://boards.greenhouse.io/contentful'],
  ['sanity', 'https://boards.greenhouse.io/sanity'],
  ['storyblok', 'https://boards.greenhouse.io/storyblok'],
  ['algolia', 'https://boards.greenhouse.io/algolia'],
  ['twitch', 'https://boards.greenhouse.io/twitch'],
  ['zillow', 'https://boards.greenhouse.io/zillow'],
  ['redfin', 'https://boards.greenhouse.io/redfin'],
  ['compass', 'https://boards.greenhouse.io/compass'],
  ['opentable', 'https://boards.greenhouse.io/opentable'],
  ['doordash', 'https://boards.greenhouse.io/doordash'],
  ['grubhub', 'https://boards.greenhouse.io/grubhub'],
  ['ezcater', 'https://boards.greenhouse.io/ezcater'],
  ['seatgeek', 'https://boards.greenhouse.io/seatgeek'],
  ['stubhub', 'https://boards.greenhouse.io/stubhub'],
  ['eventbrite', 'https://boards.greenhouse.io/eventbrite'],
  ['vimeo', 'https://boards.greenhouse.io/vimeo'],
  ['canva', 'https://boards.greenhouse.io/canva'],
  ['miro', 'https://boards.greenhouse.io/miro'],
  ['loom', 'https://boards.greenhouse.io/loom'],
  ['pitch', 'https://boards.greenhouse.io/pitch'],
  ['notion', 'https://boards.greenhouse.io/notion'],
  ['coda', 'https://boards.greenhouse.io/coda'],
  ['clickup', 'https://boards.greenhouse.io/clickup'],
  ['monday', 'https://boards.greenhouse.io/monday'],
  ['smartsheet', 'https://boards.greenhouse.io/smartsheet'],
  ['wrike', 'https://boards.greenhouse.io/wrike'],
  ['zapier', 'https://boards.greenhouse.io/zapier'],
  ['make', 'https://boards.greenhouse.io/make'],
  ['n8n', 'https://boards.greenhouse.io/n8n'],
  ['workato', 'https://boards.greenhouse.io/workato'],
  ['tray', 'https://boards.greenhouse.io/tray'],
  ['boomi', 'https://boards.greenhouse.io/boomi'],
  ['mulesoft', 'https://boards.greenhouse.io/mulesoft'],
  ['celonis', 'https://boards.greenhouse.io/celonis'],
  ['uipath', 'https://boards.greenhouse.io/uipath'],
  ['automationanywhere', 'https://boards.greenhouse.io/automationanywhere'],
  ['blueprism', 'https://boards.greenhouse.io/blueprism'],
  ['appian', 'https://boards.greenhouse.io/appian'],
  ['pega', 'https://boards.greenhouse.io/pega'],
  ['outsystems', 'https://boards.greenhouse.io/outsystems'],
  ['mendix', 'https://boards.greenhouse.io/mendix'],
  ['retool', 'https://boards.greenhouse.io/retool'],
  ['bubble', 'https://boards.greenhouse.io/bubble'],
  ['glide', 'https://boards.greenhouse.io/glide'],
  ['greenhouse', 'https://boards.greenhouse.io/greenhouse'],
  ['lever', 'https://boards.greenhouse.io/lever'],
  ['icims', 'https://boards.greenhouse.io/icims'],
  ['smartrecruiters', 'https://boards.greenhouse.io/smartrecruiters'],
  ['jobvite', 'https://boards.greenhouse.io/jobvite'],
  ['workable', 'https://boards.greenhouse.io/workable'],
  ['bamboohr', 'https://boards.greenhouse.io/bamboohr'],
  ['namely', 'https://boards.greenhouse.io/namely'],
  ['justworks', 'https://boards.greenhouse.io/justworks'],
  ['rippling', 'https://boards.greenhouse.io/rippling'],
  ['deel', 'https://boards.greenhouse.io/deel'],
  ['remote', 'https://boards.greenhouse.io/remote'],
  ['oysterhr', 'https://boards.greenhouse.io/oysterhr'],
  ['papayaglobal', 'https://boards.greenhouse.io/papayaglobal'],
  ['velocityglobal', 'https://boards.greenhouse.io/velocityglobal'],
  ['globalization', 'https://boards.greenhouse.io/globalization'],
  ['multiplier', 'https://boards.greenhouse.io/multiplier'],
  ['lattice', 'https://boards.greenhouse.io/lattice'],
  ['cultureamp', 'https://boards.greenhouse.io/cultureamp'],
  ['15five', 'https://boards.greenhouse.io/15five'],
  ['leapsome', 'https://boards.greenhouse.io/leapsome'],
  ['betterworks', 'https://boards.greenhouse.io/betterworks'],
  ['reflektive', 'https://boards.greenhouse.io/reflektive'],
  ['peakon', 'https://boards.greenhouse.io/peakon'],
  ['glint', 'https://boards.greenhouse.io/glint'],
  ['qualtrics', 'https://boards.greenhouse.io/qualtrics'],
  ['medallia', 'https://boards.greenhouse.io/medallia'],
  ['momentive', 'https://boards.greenhouse.io/momentive'],
  ['surveymonkey', 'https://boards.greenhouse.io/surveymonkey'],
  ['typeform', 'https://boards.greenhouse.io/typeform'],
  ['jotform', 'https://boards.greenhouse.io/jotform'],
  ['formstack', 'https://boards.greenhouse.io/formstack'],
  ['wufoo', 'https://boards.greenhouse.io/wufoo'],
  ['hotjar', 'https://boards.greenhouse.io/hotjar'],
  ['fullstory', 'https://boards.greenhouse.io/fullstory'],
  ['heap', 'https://boards.greenhouse.io/heap'],
  ['pendo', 'https://boards.greenhouse.io/pendo'],
  ['walkme', 'https://boards.greenhouse.io/walkme'],
  ['whatfix', 'https://boards.greenhouse.io/whatfix'],
  ['appcues', 'https://boards.greenhouse.io/appcues'],
  ['userpilot', 'https://boards.greenhouse.io/userpilot'],
  ['chameleon', 'https://boards.greenhouse.io/chameleon'],
  ['drift', 'https://boards.greenhouse.io/drift'],
  ['qualified', 'https://boards.greenhouse.io/qualified'],
  ['chilipiper', 'https://boards.greenhouse.io/chilipiper'],
  ['chorus', 'https://boards.greenhouse.io/chorus'],
  ['clari', 'https://boards.greenhouse.io/clari'],
  ['people.ai', 'https://boards.greenhouse.io/people.ai'],
  ['outreach', 'https://boards.greenhouse.io/outreach'],
  ['salesloft', 'https://boards.greenhouse.io/salesloft'],
  ['apollo', 'https://boards.greenhouse.io/apollo'],
  ['zoominfo', 'https://boards.greenhouse.io/zoominfo'],
  ['seamless', 'https://boards.greenhouse.io/seamless'],
  ['lusha', 'https://boards.greenhouse.io/lusha'],
  ['clearbit', 'https://boards.greenhouse.io/clearbit'],
  ['6sense', 'https://boards.greenhouse.io/6sense'],
  ['demandbase', 'https://boards.greenhouse.io/demandbase'],
  ['terminus', 'https://boards.greenhouse.io/terminus'],
  ['rollworks', 'https://boards.greenhouse.io/rollworks'],
  ['bombora', 'https://boards.greenhouse.io/bombora'],
  ['g2', 'https://boards.greenhouse.io/g2'],
  ['trustradius', 'https://boards.greenhouse.io/trustradius'],
  ['capterra', 'https://boards.greenhouse.io/capterra'],
  ['gartner', 'https://boards.greenhouse.io/gartner'],
  ['forrester', 'https://boards.greenhouse.io/forrester'],
  ['idc', 'https://boards.greenhouse.io/idc'],
  ['spotify', 'https://jobs.lever.co/spotify'],
  ['palantir', 'https://jobs.lever.co/palantir'],
  ['plaid', 'https://jobs.lever.co/plaid'],
  ['wealthsimple', 'https://jobs.lever.co/wealthsimple'],
  ['shieldai', 'https://jobs.lever.co/shieldai'],
  ['anyscale', 'https://jobs.lever.co/anyscale'],
  ['openai', 'https://jobs.ashbyhq.com/openai'],
  ['ramp', 'https://jobs.ashbyhq.com/ramp'],
  ['notion', 'https://jobs.ashbyhq.com/notion'],
  ['linear', 'https://jobs.ashbyhq.com/linear'],
  ['cohere', 'https://jobs.ashbyhq.com/cohere'],
  ['replit', 'https://jobs.ashbyhq.com/replit'],
  ['vanta', 'https://jobs.ashbyhq.com/vanta'],
  ['supabase', 'https://jobs.ashbyhq.com/supabase'],
  ['deel', 'https://jobs.ashbyhq.com/deel'],
  ['perplexity', 'https://jobs.ashbyhq.com/perplexity'],
  ['posthog', 'https://jobs.ashbyhq.com/posthog'],
  ['modal', 'https://jobs.ashbyhq.com/modal'],
  ['mistral', 'https://jobs.ashbyhq.com/mistral'],
  ['elevenlabs', 'https://jobs.ashbyhq.com/elevenlabs'],
  ['runway', 'https://jobs.ashbyhq.com/runway'],
  ['harvey', 'https://jobs.ashbyhq.com/harvey'],
  ['glean', 'https://jobs.ashbyhq.com/glean'],
  ['writer', 'https://jobs.ashbyhq.com/writer'],
  ['jasper', 'https://jobs.ashbyhq.com/jasper'],
  ['hebbia', 'https://jobs.ashbyhq.com/hebbia'],
  ['sierra', 'https://jobs.ashbyhq.com/sierra'],
  ['decagon', 'https://jobs.ashbyhq.com/decagon'],
  ['Broadcom', 'https://broadcom.wd1.myworkdayjobs.com/External_Career'],
  ['Autodesk', 'https://autodesk.wd1.myworkdayjobs.com/Ext'],
  ['Zoom', 'https://zoom.wd5.myworkdayjobs.com/Zoom'],
  ['CrowdStrike', 'https://crowdstrike.wd5.myworkdayjobs.com/crowdstrikecareers'],
  ['PNC', 'https://pnc.wd5.myworkdayjobs.com/External'],
  ['Synchrony', 'https://synchronyfinancial.wd5.myworkdayjobs.com/careers'],
  ['Fiserv', 'https://fiserv.wd5.myworkdayjobs.com/EXT'],
  ['FIS', 'https://fis.wd5.myworkdayjobs.com/SearchJobs'],
  ['Global Payments', 'https://tsys.wd1.myworkdayjobs.com/TSYS'],
  ['TransUnion', 'https://transunion.wd5.myworkdayjobs.com/TransUnion'],
  ['Northwestern Mutual', 'https://northwesternmutual.wd5.myworkdayjobs.com/CORPORATE-CAREERS'],
  ['Prudential', 'https://pru.wd5.myworkdayjobs.com/Careers'],
  ['The Hartford', 'https://thehartford.wd5.myworkdayjobs.com/Careers_External'],
  ['USAA', 'https://usaa.wd1.myworkdayjobs.com/USAAJOBS'],
  ['Centene', 'https://centene.wd5.myworkdayjobs.com/Centene_External'],
  ['McKesson / CoverMyMeds', 'https://mckesson.wd3.myworkdayjobs.com/External_Careers'],
  ['Walgreens', 'https://walgreens.wd5.myworkdayjobs.com/External'],
  ['HPE', 'https://hpe.wd5.myworkdayjobs.com/Jobsathpe'],
  ['Micron', 'https://micron.wd1.myworkdayjobs.com/External'],
  ['Caterpillar', 'https://cat.wd5.myworkdayjobs.com/CaterpillarCareers'],
  ['John Deere', 'https://johndeere.wd5.myworkdayjobs.com/DeereJobs'],
  ['GE HealthCare', 'https://gehc.wd5.myworkdayjobs.com/GEHC_ExternalSite'],
  ['Leidos', 'https://leidos.wd5.myworkdayjobs.com/External'],
  ['Best Buy', 'https://bestbuy.wd5.myworkdayjobs.com/BestBuy'],
  ['Abercrombie & Fitch', 'https://abercrombie.wd5.myworkdayjobs.com/ANFCareers'],
  ["Victoria's Secret", 'https://victoriassecret.wd5.myworkdayjobs.com/VSCareers'],
  ['Bath & Body Works', 'https://bbw.wd5.myworkdayjobs.com/BBW'],
  ['Designer Brands (DSW)', 'https://designerbrands.wd1.myworkdayjobs.com/DBI'],
  ["Wendy's", 'https://wendys.wd1.myworkdayjobs.com/Wendys_Careers'],
  ['Mettler-Toledo', 'https://mt.wd1.myworkdayjobs.com/MT_Careers'],
  ['Worthington Enterprises', 'https://worthingtonindustries.wd1.myworkdayjobs.com/Worthington_Careers'],
  ['Battelle', 'https://battelle.wd1.myworkdayjobs.com/Battelle'],
  ['Ally Financial', 'https://ally.wd1.myworkdayjobs.com/Ally'],
  ['Regions Bank', 'https://regions.wd1.myworkdayjobs.com/Regions_Careers'],
  ['Citizens Bank', 'https://citizens.wd5.myworkdayjobs.com/citizens'],
  ['M&T Bank', 'https://mtb.wd5.myworkdayjobs.com/MTB'],
  ['Huntington Ingalls', 'https://hii.wd1.myworkdayjobs.com/External'],
  ["Lowe's", 'https://lowes.wd5.myworkdayjobs.com/LWS_External_CS'],
  ['Kroger', 'https://kroger.wd5.myworkdayjobs.com/krogercareers'],
  ['Cardinal Health', 'https://cardinalhealth.wd1.myworkdayjobs.com/EXT'],
  ['Owens Corning', 'https://owenscorning.wd1.myworkdayjobs.com/OC_Careers'],
  ['Progressive', 'https://progressive.wd5.myworkdayjobs.com/Progressive'],
  ['Grange Insurance', 'https://grangeinsurance.wd1.myworkdayjobs.com/Grange'],
  ['Encova Insurance', 'https://encova.wd1.myworkdayjobs.com/Encova'],
  ['State Auto (Liberty)', 'https://libertymutual.wd5.myworkdayjobs.com/LMI'],
  ['Medical Mutual', 'https://medmutual.wd1.myworkdayjobs.com/MMO'],
  ['Cleveland Clinic', 'https://ccf.wd1.myworkdayjobs.com/ClevelandClinicCareers'],
  ['OhioHealth', 'https://ohiohealth.wd1.myworkdayjobs.com/OhioHealth'],
  ["Nationwide Children's", 'https://nationwidechildrens.wd1.myworkdayjobs.com/NCH'],
  ['Sherwin-Williams', 'https://sherwin.wd1.myworkdayjobs.com/External'],
  ['Goodyear', 'https://goodyear.wd1.myworkdayjobs.com/GoodyearCareers'],
  ['Marathon Petroleum', 'https://mpc.wd1.myworkdayjobs.com/MPCCareers'],
  ["Kohl's", 'https://kohls.wd5.myworkdayjobs.com/kohlscareers'],
  ['Gap Inc', 'https://gapinc.wd1.myworkdayjobs.com/GAPINC'],
  ["Macy's", 'https://macys.wd5.myworkdayjobs.com/Macys'],
  ["Dick's Sporting Goods", 'https://dickssportinggoods.wd1.myworkdayjobs.com/DSG'],
  ['CarMax', 'https://carmax.wd1.myworkdayjobs.com/External'],
  ['AutoZone', 'https://autozone.wd1.myworkdayjobs.com/External'],
  ["O'Reilly Auto", 'https://oreillyauto.wd1.myworkdayjobs.com/OReillyCareers'],
  ['Charter / Spectrum', 'https://spectrum.wd5.myworkdayjobs.com/Spectrum'],
  ['Cox', 'https://cox.wd1.myworkdayjobs.com/Cox_Careers'],
  ['Lumen', 'https://lumen.wd1.myworkdayjobs.com/External'],
  ['Frontier', 'https://frontier.wd1.myworkdayjobs.com/Frontier'],
  ['Paychex', 'https://paychex.wd1.myworkdayjobs.com/PaychexCareers'],
  ['ADP', 'https://adp.wd5.myworkdayjobs.com/External'],
  ['Workiva', 'https://workiva.wd1.myworkdayjobs.com/careers'],
  ['Tyler Technologies', 'https://tylertech.wd1.myworkdayjobs.com/TylerTech'],
  ['Epic Systems', 'https://epic.wd1.myworkdayjobs.com/Epic'],
  ['Cerner / Oracle Health', 'https://oracle.wd1.myworkdayjobs.com/Oracle'],
  ['Elevance Health', 'https://elevancehealth.wd1.myworkdayjobs.com/ANT'],
  ['Molina Healthcare', 'https://molinahealthcare.wd1.myworkdayjobs.com/Molina'],
  ['Highmark', 'https://highmarkhealth.wd1.myworkdayjobs.com/highmark'],
  ['Kaiser Permanente', 'https://kp.wd1.myworkdayjobs.com/KP'],
  ['Thermo Fisher', 'https://thermofisher.wd5.myworkdayjobs.com/ThermoFisherCareers'],
  ['Danaher', 'https://danaher.wd1.myworkdayjobs.com/DanaherJobs'],
  ['Becton Dickinson', 'https://bdx.wd1.myworkdayjobs.com/EXTERNAL_CAREER_SITE_USA'],
  ['Stryker', 'https://stryker.wd1.myworkdayjobs.com/StrykerCareers'],
  ['Boston Scientific', 'https://bostonscientific.wd1.myworkdayjobs.com/BSCI'],
  ['Zimmer Biomet', 'https://zimmerbiomet.wd5.myworkdayjobs.com/ZimmerBiomet'],
  ['Baxter', 'https://baxter.wd1.myworkdayjobs.com/baxter'],
  ['Labcorp', 'https://labcorp.wd1.myworkdayjobs.com/External'],
  ['Quest Diagnostics', 'https://questdiagnostics.wd1.myworkdayjobs.com/careers'],
  ['IQVIA', 'https://iqvia.wd1.myworkdayjobs.com/IQVIA'],
  ['Merck', 'https://msd.wd5.myworkdayjobs.com/SearchJobs'],
  ['Johnson & Johnson', 'https://jj.wd5.myworkdayjobs.com/JJ'],
  ['Eli Lilly', 'https://lilly.wd1.myworkdayjobs.com/LLY'],
  ['AbbVie', 'https://abbvie.wd1.myworkdayjobs.com/abbvie'],
  ['Bristol Myers Squibb', 'https://bristolmyerssquibb.wd1.myworkdayjobs.com/BMS'],
  ['Amgen', 'https://amgen.wd1.myworkdayjobs.com/Careers'],
  ['Gilead', 'https://gilead.wd1.myworkdayjobs.com/gileadcareers'],
  ['Honeywell', 'https://honeywell.wd5.myworkdayjobs.com/Honeywell'],
  ['Emerson', 'https://emerson.wd5.myworkdayjobs.com/Emerson'],
  ['Eaton', 'https://eaton.wd1.myworkdayjobs.com/Eaton_Careers'],
  ['Rockwell Automation', 'https://rockwellautomation.wd1.myworkdayjobs.com/External_Rockwell_Automation'],
  ['Cummins', 'https://cummins.wd5.myworkdayjobs.com/cummins'],
  ['Parker Hannifin', 'https://parker.wd1.myworkdayjobs.com/ParkerCareers'],
  ['Whirlpool', 'https://whirlpool.wd1.myworkdayjobs.com/Whirlpool'],
  ['Textron', 'https://textron.wd1.myworkdayjobs.com/External'],
  ['Otis', 'https://otis.wd5.myworkdayjobs.com/REC_Ext_Gateway'],
  ['Carrier', 'https://carrier.wd5.myworkdayjobs.com/jobs'],
  ['Trane', 'https://trane.wd1.myworkdayjobs.com/Trane'],
  ['Johnson Controls', 'https://jci.wd5.myworkdayjobs.com/JCI'],
  ['Schneider Electric', 'https://schneiderelectric.wd1.myworkdayjobs.com/External'],
  ['Expedia', 'https://expedia.wd5.myworkdayjobs.com/search'],
  ['Marriott', 'https://marriott.wd5.myworkdayjobs.com/MarriottCareers'],
  ['Hilton', 'https://hilton.wd5.myworkdayjobs.com/Hilton'],
  ['Southwest Airlines', 'https://southwest.wd1.myworkdayjobs.com/SWA'],
  ['Delta', 'https://delta.wd5.myworkdayjobs.com/Delta'],
  ['United Airlines', 'https://united.wd5.myworkdayjobs.com/UnitedCareers'],
  ['American Airlines', 'https://aa.wd1.myworkdayjobs.com/AACareers'],
  ['FedEx', 'https://fedex.wd1.myworkdayjobs.com/FXE-LAC_External_Career_Site'],
  ['UPS', 'https://ups.wd5.myworkdayjobs.com/UPS'],
  ['Netflix', 'https://netflix.wd1.myworkdayjobs.com/Netflix'],
  ['Warner Bros. Discovery', 'https://warnerbros.wd5.myworkdayjobs.com/global'],
  ['Paramount', 'https://paramount.wd1.myworkdayjobs.com/Paramount'],
  ['Fox', 'https://fox.wd1.myworkdayjobs.com/Fox'],
  ['NBCUniversal', 'https://nbcuniversal.wd1.myworkdayjobs.com/NBCUniversal'],
  ['Electronic Arts', 'https://ea.wd1.myworkdayjobs.com/EA'],
  ['Activision Blizzard', 'https://activision.wd1.myworkdayjobs.com/External'],
  ['Take-Two', 'https://taketwo.wd1.myworkdayjobs.com/External'],
  ['Unity', 'https://unity.wd5.myworkdayjobs.com/Unity'],
  ['Intuit', 'https://intuit.wd1.myworkdayjobs.com/Intuit'],
  ['Adobe', 'https://adobe.wd5.myworkdayjobs.com/external_experienced'],
  ['Cisco', 'https://cisco.wd5.myworkdayjobs.com/Cisco'],
  ['Splunk', 'https://splunk.wd1.myworkdayjobs.com/Splunk'],
  ['VMware', 'https://vmware.wd1.myworkdayjobs.com/VMware'],
  ['Dell', 'https://dell.wd1.myworkdayjobs.com/External'],
  ['Lenovo', 'https://lenovo.wd1.myworkdayjobs.com/Lenovo'],
  ['Xerox', 'https://xerox.wd1.myworkdayjobs.com/Xerox'],
  ['NCR Voyix', 'https://ncr.wd1.myworkdayjobs.com/NCRCareers'],
  ['Diebold Nixdorf', 'https://dieboldnixdorf.wd5.myworkdayjobs.com/DN'],
  ['Sabre', 'https://sabre.wd1.myworkdayjobs.com/SabreJobs'],
  ['Gartner', 'https://gartner.wd5.myworkdayjobs.com/EXT'],
  ["Moody's", 'https://moodys.wd5.myworkdayjobs.com/MoodysCareers'],
  ['S&P Global', 'https://spgi.wd5.myworkdayjobs.com/SPGI_Careers'],
  ['MSCI', 'https://msci.wd1.myworkdayjobs.com/MSCI'],
  ['Nasdaq', 'https://nasdaq.wd1.myworkdayjobs.com/Global_External_Site'],
  ['ICE', 'https://intercontinentalexchange.wd1.myworkdayjobs.com/ICE'],
  ['CME Group', 'https://cmegroup.wd1.myworkdayjobs.com/cme_careers'],
  ['BlackRock', 'https://blackrock.wd1.myworkdayjobs.com/BlackRock_Professional'],
  ['Vanguard', 'https://vanguard.wd5.myworkdayjobs.com/vanguard_external'],
  ['Charles Schwab', 'https://schwab.wd1.myworkdayjobs.com/Schwab'],
  ['T. Rowe Price', 'https://troweprice.wd5.myworkdayjobs.com/TRowePrice'],
  ['Edward Jones', 'https://edwardjones.wd1.myworkdayjobs.com/EJCareers'],
  ['Raymond James', 'https://raymondjames.wd1.myworkdayjobs.com/RaymondJamesCareers'],
  ['Ameriprise', 'https://ameriprise.wd5.myworkdayjobs.com/Ameriprise'],
  ['Principal', 'https://principal.wd1.myworkdayjobs.com/Principal'],
  ['Lincoln Financial', 'https://lnc.wd1.myworkdayjobs.com/LNC'],
  ['Aflac', 'https://aflac.wd1.myworkdayjobs.com/aflac'],
  ['Unum', 'https://unum.wd1.myworkdayjobs.com/External'],
  ['Erie Insurance', 'https://erieinsurance.wd1.myworkdayjobs.com/ErieInsurance'],
  ['Cincinnati Financial', 'https://cinfin.wd1.myworkdayjobs.com/CINFIN'],
  ['Western & Southern', 'https://wsfg.wd1.myworkdayjobs.com/WSFG'],
  ['Fifth Third', 'https://fifththird.wd5.myworkdayjobs.com/53careers'],
  ['KeyBank', 'https://keybank.wd5.myworkdayjobs.com/External_Career_Site'],
  ['Comerica', 'https://comerica.wd1.myworkdayjobs.com/Comerica'],
  ['Zions', 'https://zionsbancorp.wd1.myworkdayjobs.com/Zions'],
  ['Discover', 'https://discover.wd5.myworkdayjobs.com/Discover'],
  ['Navy Federal', 'https://navyfederal.wd1.myworkdayjobs.com/NFCU'],
  ['Cardinal Group', 'https://cardinalgroup.wd1.myworkdayjobs.com/CG'],
].map(([name, url]) => ({ name: pretty(name), url, enabled: true }));
for (const c of EXTRA) if (!DEFAULT_COMPANIES.some(d => d.url === c.url)) DEFAULT_COMPANIES.push(c);
export const COMPANIES_VERSION = 2;

export const DEFAULT_PROFILE = {
  firstName: '', lastName: '', email: '', phone: '',
  address: '', city: 'Columbus', state: 'Ohio', zip: '', country: 'United States',
  linkedin: '', github: '', website: '',
  currentCompany: '', currentTitle: 'Full Stack .NET Developer', yearsExperience: '4',
  workAuthorized: '',      // Yes / No
  needSponsorship: '',     // Yes / No
  willingRelocate: '',     // Yes / No
  salary: '', noticePeriod: '', startDate: '',
  howHeard: 'LinkedIn',
  gender: 'Decline to self-identify', race: 'Decline to self-identify',
  veteran: 'I am not a protected veteran', disability: 'I do not want to answer',
  over18: 'Yes', relatedExperience: 'Yes', workedHereBefore: 'No', relativesHere: 'No',
  backgroundCheck: 'Yes', drugTest: 'Yes', willingTravel: 'Yes', nonCompete: 'No', clearance: 'No',
  experience: [],          // [{company, title, location, start:'YYYY-MM', end:'YYYY-MM', current, description}]
  education: [],           // [{school, degree, field, start, end, gpa}]
  coverLetter: '',
  resumes: [],             // [{name, text, dataUrl, type}]
  extraSkills: [],         // skills you added from "missing" chips
  answers: [               // custom question → answer library
    { match: 'why do you want, why are you interested', answer: '' },
    { match: 'tell us about yourself, summary', answer: '' }
  ]
};

// Skill keyword groups. Each line: Group name: alias, alias, ...
// The group name itself also counts as an alias.
// A job and your resume "share" a skill if both mention ANY word from the group.
export const DEFAULT_SKILL_GROUPS = `
C#: c sharp, csharp, c#.net
.NET: dotnet, .net framework, .net 6, .net 7, .net 8, .net 9, .net core, net core
ASP.NET Core: asp.net core, asp .net core, aspnet core, asp.net 6, asp.net 8
ASP.NET MVC: asp.net mvc, mvc 5, mvc framework, model view controller
ASP.NET Web Forms: webforms, web forms, asp.net webforms
ASP.NET: asp.net, asp .net, aspnet, classic asp
Web API: asp.net web api, web api, webapi, minimal api, minimal apis
VB.NET: vb.net, visual basic, vb .net, vb6
Entity Framework: entity framework, ef core, entity framework core, ef6, linq to entities
LINQ: linq
Blazor: blazor
WCF: wcf, windows communication foundation
WPF: wpf, windows presentation foundation
WinForms: winforms, windows forms
SignalR: signalr
Razor: razor pages, razor, cshtml
JavaScript: javascript, js, es6, ecmascript, vanilla js
TypeScript: typescript
React: react, reactjs, react.js, react js, react hooks
Redux: redux, redux toolkit, rtk
Next.js: next.js, nextjs, next js
Angular: angular, angularjs, angular.js
Vue: vue, vue.js, vuejs, nuxt
Node.js: node.js, nodejs, node js, node
Express: express.js, expressjs
jQuery: jquery
HTML: html, html5
CSS: css, css3, scss, sass
Tailwind: tailwind, tailwindcss
Bootstrap: bootstrap
REST APIs: restful, rest api, rest apis, restful services, restful apis, web services
GraphQL: graphql
gRPC: grpc
Microservices: microservices, micro services, microservice architecture
SQL Server: sql server, ms sql, mssql, microsoft sql server, sql server management studio, ssms
T-SQL: t-sql, tsql, stored procedures, stored procedure
SQL: sql
SSIS: ssis, ssrs, ssas
Oracle: oracle, pl/sql, plsql
PostgreSQL: postgresql, postgres
MySQL: mysql
MongoDB: mongodb, mongo
Cosmos DB: cosmos db, cosmosdb
Redis: redis
Azure: azure, microsoft azure, azure cloud
Azure DevOps: azure devops, ado, vsts, tfs, team foundation server, azure pipelines, azure repos, azure boards
Azure Functions: azure functions, function apps
Azure App Service: app service, azure app services, azure web apps
Azure SQL: azure sql
Azure Service Bus: service bus, azure service bus
AWS: aws, amazon web services, ec2, s3, lambda
GCP: gcp, google cloud
Docker: docker, containers, containerization
Kubernetes: kubernetes, k8s, aks, eks
CI/CD: ci/cd, cicd, continuous integration, continuous delivery, continuous deployment, build pipelines, release pipelines
GitHub Actions: github actions
Jenkins: jenkins
Git: git, github, gitlab, bitbucket
Terraform: terraform, infrastructure as code, iac, bicep, arm templates
IIS: iis, internet information services
Windows Server: windows server
Unit Testing: unit testing, unit tests, xunit, nunit, mstest, moq, tdd, test driven
Jest: jest, react testing library, rtl
Selenium: selenium, playwright, cypress
Accessibility: accessibility, wcag, wcag 2.1, wcag 2.2, ada, section 508, 508 compliance, a11y, aria, screen reader
Security: owasp, application security, secure coding, vulnerability remediation, checkmarx, sast, veracode, fortify, sonarqube
Authentication: oauth, oauth2, openid connect, oidc, jwt, identityserver, azure ad, entra id, active directory, sso, single sign-on
Agile: agile, scrum, kanban, sprint
Jira: jira, confluence
Visual Studio: visual studio, vs code, visual studio code
Design Patterns: design patterns, solid principles, dependency injection, repository pattern, clean architecture
OOP: oop, object oriented, object-oriented programming
Python: python
Java: java, spring boot
Power BI: power bi, powerbi
Crystal Reports: crystal reports
Legacy Modernization: modernization, legacy migration, application modernization, migrating legacy, legacy applications
`.trim();

export function parseSkillGroups(text) {
  const groups = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf(':');
    const name = (i === -1 ? line : line.slice(0, i)).trim();
    const aliases = (i === -1 ? '' : line.slice(i + 1)).split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (!aliases.includes(name.toLowerCase())) aliases.unshift(name.toLowerCase());
    groups.push({ name, aliases });
  }
  return groups;
}
