import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { adminHealth } from "../../components/admin/adminData";

export function AdminSystemHealthPage() {
  return (
    <DashboardShell eyebrow="System Health" title="System health" description="Monitor Node API, FastAPI, ChromaDB, and storage usage in a mock operational view.">
      <div className="grid gap-4 xl:grid-cols-2">
        {adminHealth.map((item) => (
          <Card key={item.label} className="p-5">
            <p className="text-sm text-body">{item.label}</p>
            <p className={`mt-3 text-2xl font-semibold ${item.tone}`}>{item.value}</p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <p className="text-sm font-medium text-ink-strong">Storage Usage</p>
        <div className="mt-4 h-4 rounded-full bg-canvas">
          <div className="h-4 w-[68%] rounded-full bg-primary" />
        </div>
        <p className="mt-2 text-xs text-body">Primary storage at 68% capacity.</p>
      </Card>
    </DashboardShell>
  );
}
