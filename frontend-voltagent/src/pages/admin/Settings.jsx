import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";

export function AdminSettingsPage() {
  return (
    <DashboardShell eyebrow="Settings" title="Admin settings" description="Mock platform configuration controls for the admin dashboard.">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-strong">Platform Preferences</p>
          <div className="mt-4 space-y-3 text-sm text-body">
            <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">Maintenance window: Off</div>
            <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">New account approvals: Manual</div>
            <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">Telemetry: Enabled</div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-strong">Security Defaults</p>
          <div className="mt-4 space-y-3 text-sm text-body">
            <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">Rate limiting: Enabled</div>
            <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">Audit logs: Enabled</div>
            <div className="rounded-xl border border-hairline bg-canvas px-4 py-3">Admin notifications: Enabled</div>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
