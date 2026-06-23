const SUPABASE = "https://avjthwvppogqezlljksz.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2anRod3ZwcG9ncWV6bGxqa3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzM2ODIsImV4cCI6MjA5NzEwOTY4Mn0.xgdZ2WP1sX01LliQztWoy_5NN3so2NxHM3LwzXNbGjY";

module.exports = async function(req, res) {
  const token = req.query.token || req.headers["authorization"]?.replace("Bearer ", "");
  const result = { proxy: "ok", has_token: !!token, tests: {} };

  // Test anon read
  try {
    const r = await fetch(`${SUPABASE}/rest/v1/clients?select=id&limit=1`, {
      headers: { apikey: KEY }
    });
    result.tests.anon_read = { status: r.status, body: await r.text() };
  } catch(e) { result.tests.anon_read = { error: e.message }; }

  // Test authenticated read
  if (token) {
    try {
      const r = await fetch(`${SUPABASE}/rest/v1/clients?select=id,name&limit=5`, {
        headers: { apikey: KEY, authorization: `Bearer ${token}` }
      });
      result.tests.auth_read = { status: r.status, body: await r.text() };
    } catch(e) { result.tests.auth_read = { error: e.message }; }
  } else {
    result.tests.auth_read = "no token - open /api/debug?token=YOUR_JWT";
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(result);
};
