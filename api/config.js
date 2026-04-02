function normalizeUrl(value) {
  if (!value) return '';
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getRequestOrigin(req) {
  const headers = (req && req.headers) || {};
  const proto = (headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host = (
    headers['x-forwarded-host'] ||
    headers.host ||
    ''
  ).split(',')[0].trim();

  if (!host) return '';
  return normalizeUrl(`${proto}://${host}`);
}

module.exports = function handler(req, res) {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    appUrl:
      normalizeUrl(process.env.APP_URL) ||
      normalizeUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
      normalizeUrl(process.env.VERCEL_URL) ||
      getRequestOrigin(req),
  };

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res
    .status(200)
    .send(`window.__APP_CONFIG__ = Object.freeze(${JSON.stringify(config)});`);
};
