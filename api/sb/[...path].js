const SUPABASE = "https://avjthwvppogqezlljksz.supabase.co";

module.exports = async function handler(req, res) {
  const parts = req.query.path || [];
  const subpath = Array.isArray(parts) ? parts.join("/") : parts;

  const qp = new URLSearchParams();
  for (const [k, v] of Object.entries(req.query)) {
    if (k === "path") continue;
    if (Array.isArray(v)) v.forEach(val => qp.append(k, val));
    else qp.set(k, v);
  }
  const qs = qp.toString();
  const url = `${SUPABASE}/${subpath}${qs ? "?" + qs : ""}`;

  const headers = {};
  for (const h of ["apikey", "authorization", "content-type", "prefer", "accept", "x-client-info", "range"]) {
    if (req.headers[h]) headers[h] = req.headers[h];
  }

  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body != null) {
    init.body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (!headers["content-type"]) headers["content-type"] = "application/json";
  }

  const r = await fetch(url, init);
  const body = await r.text();

  const ct = r.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);
  const cr = r.headers.get("content-range");
  if (cr) res.setHeader("Content-Range", cr);

  res.status(r.status).send(body);
};
