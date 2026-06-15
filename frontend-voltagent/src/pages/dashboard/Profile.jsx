import { useEffect, useState } from "react";
import { Card } from "../../components/marketing/MarketingPrimitives";
import { DashboardShell } from "../../components/dashboard/DashboardShell";
import { getSessionApi } from "../../lib/api";

export function ProfilePage() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    getSessionApi().then((payload) => setUser(payload.user));
  }, []);

  return (
    <DashboardShell eyebrow="Profile" title="Account profile" description="User information and API usage details.">
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <p className="text-sm font-medium text-ink-strong">Account Information</p>
          <div className="mt-4 space-y-3 text-sm text-body">
            <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3"><span>Name</span><span className="text-ink-strong">{user?.name || "—"}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3"><span>Email</span><span className="text-ink-strong">{user?.email || "—"}</span></div>
            <div className="flex items-center justify-between rounded-xl border border-hairline bg-canvas px-4 py-3"><span>Role</span><span className="text-ink-strong">{user?.role || "User"}</span></div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="rounded-2xl border border-hairline bg-canvas p-4">
            <p className="text-sm font-medium text-ink-strong">API Usage Details</p>
            <p className="mt-2 text-sm text-body">API usage metrics are available once usage tracking is expanded in the backend.</p>
          </div>
        </Card>
      </div>
    </DashboardShell>
  );
}
