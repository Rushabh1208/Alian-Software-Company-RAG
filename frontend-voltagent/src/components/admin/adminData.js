export const adminOverviewStats = [
  { label: "Total Users", value: "2,148", delta: "+64 this month" },
  { label: "Total Websites", value: "391", delta: "+22 this week" },
  { label: "Total Chats", value: "18,420", delta: "+1.4k today" },
  { label: "Active Jobs", value: "17", delta: "3 failed" },
];

export const adminUsers = [
  { name: "Aman Singh", email: "aman@voltagent.dev", role: "Owner", status: "Active", lastSeen: "2 min ago" },
  { name: "Sofia Chen", email: "sofia@northstar.ai", role: "Admin", status: "Disabled", lastSeen: "1 day ago" },
  { name: "Jordan Lee", email: "jordan@studio.io", role: "Member", status: "Active", lastSeen: "10 min ago" },
];

export const adminWebsites = [
  { domain: "voltagent.dev", status: "Healthy", widgets: 3, reindex: "Available" },
  { domain: "docs.voltagent.dev", status: "Queued", widgets: 1, reindex: "Running" },
  { domain: "help.voltagent.dev", status: "Attention", widgets: 0, reindex: "Required" },
];

export const adminJobs = [
  { id: "job-101", type: "Crawl", status: "Active", updated: "3 min ago" },
  { id: "job-102", type: "Chunking", status: "Failed", updated: "12 min ago" },
  { id: "job-103", type: "Embedding", status: "Completed", updated: "35 min ago" },
];

export const adminHealth = [
  { label: "Node API Status", value: "Operational", tone: "text-primary" },
  { label: "FastAPI Status", value: "Operational", tone: "text-primary" },
  { label: "ChromaDB Status", value: "Degraded", tone: "text-yellow-400" },
  { label: "Storage Usage", value: "68%", tone: "text-body" },
];
