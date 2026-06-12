const { ensureSeeded, readTable, writeTable } = require("../utils/dbStore");

function listIndexingJobs() {
  ensureSeeded();
  return readTable("indexing_jobs");
}

function seedJobs() {
  const jobs = readTable("indexing_jobs");
  if (jobs.length) return jobs;
  const now = new Date().toISOString();
  const seeded = [
    { id: "job_1", website_id: "website_1", type: "crawl", status: "active", created_at: now, updated_at: now },
    { id: "job_2", website_id: "website_2", type: "embed", status: "failed", created_at: now, updated_at: now },
    { id: "job_3", website_id: "website_3", type: "index", status: "completed", created_at: now, updated_at: now },
  ];
  writeTable("indexing_jobs", seeded);
  return seeded;
}

module.exports = { listIndexingJobs, seedJobs };
