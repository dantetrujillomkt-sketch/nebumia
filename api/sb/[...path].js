const SUPABASE = "https://avjthwvppogqezlljksz.supabase.co";

module.exports = async function handler(req, res) {
  const parts = req.query.path || [];
  const subpath = Array.isArray(parts) ? parts.join("/") : parts;

  // Use raw query string from req.url to preserve PostgREST operators (* . " etc)
  const qmark = req.url.indexOf("?");
  const rawQs = qmark >= 0 ? req.url.slice(qmark + 1) : "";
  const url = `${SUPABASE}/${subpath}${rawQs ? "?" + rawQs : ""}`;

  const headers = {};
  for (const h of ["apikey", "authorization", "content-type", "prefer", "accept", "x-client-info", "range"]) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }

  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!headers["content-type"]) headers["content-type"] = "application/json";
  }

  try {
    const r = await fetch(url, init);
    const body = await r.text();
    const ct = r.headers.get("content-type");
    if (ct) res.setHeader("Content-Type", ct);
    const cr = r.headers.get("content-range");
    if (cr) res.setHeader("Content-Range", cr);
    res.status(r.status).send(body);
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
};
