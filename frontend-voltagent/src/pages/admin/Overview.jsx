import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getAdminOverviewApi } from "../../lib/api";
import { Skeleton } from "../../components/ui/Feedback";

export function AdminOverviewPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getAdminOverviewApi().then(setData);
  }, []);

  return (
    <DashboardShell eyebrow="Overview" title="Admin overview" description="Control center for users, websites, jobs, analytics, and revenue.">
      {!data ? <Skeleton className="h-72" /> : (
        <>
          <div className="grid gap-4 xl:grid-cols-4">
            {[
              ["Total Users", data.metrics.totalUsers],
              ["Total Websites", data.metrics.totalWebsites],
              ["Total Chats", data.metrics.totalChats],
              ["Active Indexing Jobs", data.metrics.activeJobs],
            ].map(([label, value]) => (
              <Card key={label} className="p-5">
                <p className="text-sm text-body">{label}</p>
                <p className="mt-3 text-3xl font-semibold text-ink-strong">{String(value)}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="p-5">
              <p className="text-sm font-medium text-ink-strong">Revenue Summary</p>
              <p className="mt-2 text-3xl font-semibold text-primary">${data.revenueSummary.monthlyRevenue}</p>
            </Card>
            <Card className="p-5">
              <p className="text-sm font-medium text-ink-strong">Subscription Statistics</p>
              <p className="mt-2 text-sm text-body">{data.subscriptions.length} plans available</p>
            </Card>
          </div>
        </>
      )}
    </DashboardShell>
  );
}
