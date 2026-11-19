// pa11y-ci loads this file with require(), so it uses module.exports instead of export.
// The .cjs extension allows that here, although package.json makes our other files ES modules.
// Same rule as vite.config.js, so these URLs always match where the site is served.
const siteUrl = process.env.SITE_URL;
const base = `http://localhost:4173${siteUrl ? new URL(siteUrl).pathname : '/'}`;

module.exports = {
  defaults: {
    standard: 'WCAG2AA', // WCAG 2 level AA
    runners: ['axe', 'htmlcs'], // two rule engines; each catches issues the other misses
  },
  urls: [base],
};
