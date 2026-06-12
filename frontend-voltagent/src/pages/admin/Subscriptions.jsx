import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";

export function AdminSubscriptionsPage() {
  return (
    <DashboardShell eyebrow="Subscriptions" title="Subscription management" description="Mock plan oversight for platform accounts and billing status.">
      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ["Starter", "842 accounts"],
          ["Growth", "1,109 accounts"],
          ["Scale", "197 accounts"],
        ].map(([name, value]) => (
          <Card key={name} className="p-5">
            <p className="text-sm font-medium text-ink-strong">{name}</p>
            <p className="mt-3 text-3xl font-semibold text-primary">{value}</p>
          </Card>
        ))}
      </div>
    </DashboardShell>
  );
}
