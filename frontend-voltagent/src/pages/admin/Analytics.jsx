import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getAdminOverviewApi, getUserAnalyticsApi } from "../../lib/api";
import { Skeleton } from "../../components/ui/Feedback";

export function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    Promise.all([getAdminOverviewApi(), getUserAnalyticsApi()])
      .then(([overviewPayload, analyticsPayload]) => {
        setOverview(overviewPayload);
        setAnalytics(analyticsPayload);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardShell eyebrow="Analytics" title="Admin analytics" description="User growth, website growth, chat analytics, and revenue analytics.">
      {loading ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-strong">Revenue Analytics</p>
            <p className="mt-3 text-3xl font-semibold text-primary">${overview?.revenueSummary?.monthlyRevenue || 0}</p>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-medium text-ink-strong">Chat Analytics</p>
            <p className="mt-3 text-3xl font-semibold text-primary">{analytics?.daily?.reduce((sum, row) => sum + Number(row.queries || 0), 0) || 0}</p>
          </Card>
        </div>
      )}
    </DashboardShell>
  );
}
