# JobPilot – Job Finder & Autofill (Chrome extension)

## Install (2 minutes)
1. Unzip `JobPilot.zip` to a folder you'll keep, e.g. `C:\JobPilot`. Don't delete the folder later; Chrome runs the extension from it.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and choose the `jobpilot` folder (the one with `manifest.json` in it).
5. Pin it: click the puzzle icon in Chrome's toolbar, then the pin next to JobPilot.

The dashboard opens on the Profile tab the first time.

## First-time setup
1. **Profile & resume:** upload your resume (PDF or Word), fill in your details and the common answers (work authorization, sponsorship and so on), then click **Save profile**.
2. **Settings:** check the keywords, location, sites and filters, then click **Save settings**.
3. In normal Chrome tabs, log in to LinkedIn, Dice, Indeed and ZipRecruiter once.
4. Click **Scan now** to test. Chrome opens a minimized window, searches, and closes it when done.

## Daily use
- Scans run every 3 hours (between the hours you choose) while Chrome is open and the laptop is awake.
- Open the dashboard and click **Review & Submit** on a job. The posting opens. Click the site's Apply button and the JobPilot panel fills each page, including company sites (Workday, Greenhouse, Lever and others).
- Fill anything listed under "Needs you", check the page, then click **Submit** yourself.
- The job is marked **Applied** automatically when a "thank you for applying" page appears. You can also click **Mark applied**.
- On any other application page, click the JobPilot icon, then **Fill this page**.

## Keep the laptop awake (Windows)
- Go to Settings → System → Power → Screen and sleep. Set "When plugged in, put my device to sleep after" to **Never**.
- In Control Panel → Power Options → Choose what closing the lid does, set "When plugged in" to **Do nothing**.
- Leave Chrome open and lock the screen with Windows key + L.

## Company career sites
Company career sites are searched first, then LinkedIn, Dice, Indeed and ZipRecruiter. Settings → Company career sites starts with about 100 companies and grows by itself: when a portal job links to a company's own career site (Workday, Greenhouse, Lever, Ashby, SmartRecruiters), that company is added. A company that fails 3 scans in a row is turned off. After a scan each shows ✓ or ✗. For a ✗, open that company's careers page, search for a job, and paste the page link (put {q} where the search word goes).

## Email alerts (free)
Settings → Email alerts: follow the 5 steps shown there (copy a small script into script.google.com, deploy it as a Web app, paste its link). Emails come from and go to your own Gmail, free, about 100 a day.

## Phone alerts (optional, free)
1. Install the **ntfy** app on your iPhone and subscribe to a long random topic name.
2. Put the same name in Settings → Phone alerts, tick the box, and click **Send test**.

## Good to know
- Everything is stored only in this Chrome profile. Nothing is sent anywhere, except AI checks (only if you add a key) and ntfy alerts (only if you turn them on).
- The extension never clicks Submit, never solves CAPTCHAs, and never stores site passwords. Let Chrome's password manager save those.
- LinkedIn is searched through its public job listings, so your LinkedIn account isn't used for searching.
- Job sites change their pages from time to time. If a site shows "OK · 0 results" for a while, its page layout probably changed and that site's reader needs an update.
- To update: replace the folder's files, then click the reload icon on JobPilot in `chrome://extensions`.
