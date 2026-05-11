import { Suspense } from "react";

import { AuditDashboard } from "@/components/dashboard/AuditDashboard";
import { AppShell } from "@/components/layout/AppShell";

export default function HomePage() {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <AuditDashboard />
      </Suspense>
    </AppShell>
  );
}
