const SUPABASE = "https://avjthwvppogqezlljksz.supabase.co";
const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF2anRod3ZwcG9ncWV6bGxqa3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1MzM2ODIsImV4cCI6MjA5NzEwOTY4Mn0.xgdZ2WP1sX01LliQztWoy_5NN3so2NxHM3LwzXNbGjY";

module.exports = async function(req, res) {
  const auth = req.headers["authorization"] || "";
  const result = { proxy: "ok", auth_header: auth ? "present" : "missing", tests: {} };

  // Test 1: anon read (no auth)
  try {
    const r1 = await fetch(`${SUPABASE}/rest/v1/clients?select=id&limit=1`, {
      headers: { apikey: KEY }
    });
    result.tests.anon_read = { status: r1.status, body: await r1.text() };
  } catch(e) { result.tests.anon_read = { error: e.message }; }

  // Test 2: authenticated read (with user JWT)
  if (auth) {
    try {
      const r2 = await fetch(`${SUPABASE}/rest/v1/clients?select=id&limit=3`, {
        headers: { apikey: KEY, authorization: auth }
      });
      result.tests.auth_read = { status: r2.status, body: await r2.text() };
    } catch(e) { result.tests.auth_read = { error: e.message }; }
  }

  res.setHeader("Content-Type", "application/json");
  res.status(200).json(result);
};
