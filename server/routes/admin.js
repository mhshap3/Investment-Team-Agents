const express = require("express");
const router = express.Router();

module.exports = (db) => {
  // GET /admin/deal/:name — dump raw DB record for debugging
  router.get("/deal/:name", (req, res) => {
    const name = `%${req.params.name}%`;
    const row = db.prepare(
      "SELECT id, company_name, from_email, fact_sheet, analysis FROM deals WHERE company_name LIKE ? LIMIT 1"
    ).get(name);

    if (!row) return res.status(404).json({ error: "Not found" });

    try { row.fact_sheet = JSON.parse(row.fact_sheet); } catch {}
    try { row.analysis = JSON.parse(row.analysis); } catch {}

    res.json(row);
  });

  return router;
};
