const SUPABASE = "https://avjthwvppogqezlljksz.supabase.co";

module.exports = async function handler(req, res) {
  // Path comes in as _path query param to avoid Vercel catch-all routing issues.
  // All other query params are forwarded as-is (raw, no re-encoding).
  const rawUrl = req.url;
  const qmark = rawUrl.indexOf("?");
  const rawQs = qmark >= 0 ? rawUrl.slice(qmark + 1) : "";

  const pathMatch = rawQs.match(/(?:^|&)_path=([^&]+)/);
  const sbPath = pathMatch ? decodeURIComponent(pathMatch[1]) : "";
  if (!sbPath) return res.status(400).json({ error: "missing _path" });

  const rest = rawQs.replace(/(?:^|&)_path=[^&]*/g, "").replace(/^&/, "");
  const url = `${SUPABASE}/${sbPath}${rest ? "?" + rest : ""}`;

  const headers = {};
  for (const h of ["apikey", "content-type", "prefer", "accept", "x-client-info", "range"]) {
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
