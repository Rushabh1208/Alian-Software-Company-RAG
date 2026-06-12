import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getAdminJobsApi } from "../../lib/api";
import { EmptyState, Skeleton } from "../../components/ui/Feedback";

export function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminJobsApi().then((payload) => setJobs(payload.jobs || [])).finally(() => setLoading(false));
  }, []);

  const counts = {
    active: jobs.filter((job) => job.status === "active").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    completed: jobs.filter((job) => job.status === "completed").length,
  };

  return (
    <DashboardShell eyebrow="Jobs" title="Indexing jobs" description="Track active, failed, completed, and retryable jobs.">
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Active Jobs", counts.active],
          ["Failed Jobs", counts.failed],
          ["Completed Jobs", counts.completed],
        ].map(([label, value]) => (
          <Card key={label} className="p-5">
            <p className="text-sm text-body">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-ink-strong">{String(value)}</p>
          </Card>
        ))}
      </div>
      <div className="grid gap-4">
        {loading ? <Skeleton className="h-72" /> : jobs.length ? jobs.map((job) => (
          <Card key={job.id} className="p-5">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-medium text-ink-strong">{job.id}</p>
                <p className="mt-1 text-xs text-body">{job.type} · {job.status}</p>
              </div>
              <div className="flex gap-2">
                {job.status === "failed" ? <button className="rounded-full border border-primary/30 px-4 py-2 text-sm text-primary">Retry Failed Jobs</button> : null}
              </div>
            </div>
          </Card>
        )) : <EmptyState title="No jobs" description="Indexing jobs will appear here once they are queued." />}
      </div>
    </DashboardShell>
  );
}
