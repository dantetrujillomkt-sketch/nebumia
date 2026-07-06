// Tipo de cambio oficial SUNAT por fecha. Se llama desde el cliente como
// /api/tipocambio?date=YYYY-MM-DD y evita problemas de CORS al ir por el servidor.
module.exports = async function handler(req, res) {
  const date = String(req.query.date || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: "Falta date (YYYY-MM-DD)" });
  }
  try {
    const r = await fetch(`https://api.apis.net.pe/v1/tipo-cambio-sunat?fecha=${date}`);
    if (!r.ok) return res.status(502).json({ error: `SUNAT respondió ${r.status}`, date });
    const d = await r.json();
    // Una vez publicado, el TC de una fecha no cambia → se puede cachear fuerte.
    res.setHeader("Cache-Control", "public, max-age=604800, s-maxage=604800");
    res.status(200).json({ date, compra: d.compra, venta: d.venta, origen: d.origen || "SUNAT" });
  } catch (e) {
    res.status(502).json({ error: e.message, date });
  }
};
