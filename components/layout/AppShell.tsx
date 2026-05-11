import { APP_NAME } from "@/lib/constants/app";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-6">
        <header className="panel relative overflow-hidden rounded-[28px] p-6 sm:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-80 bg-[radial-gradient(circle_at_center,rgba(34,211,238,0.18),transparent_65%)] lg:block" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="mb-3 inline-flex items-center rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-200">
                Local Performance + ADA Inspector
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-50 sm:text-4xl">{APP_NAME}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
                Audit any URL or uploaded HTML file with Lighthouse, Puppeteer, axe-core, and AI-assisted fixes. The
                interface is designed like a focused DevTools workstation: scan, triage, simulate, and ship fixes fast.
              </p>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-950/50 px-4 py-3 text-sm text-slate-300 sm:grid-cols-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Engine</div>
                <div className="mt-1 font-medium text-slate-100">Lighthouse + Puppeteer</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">ADA</div>
                <div className="mt-1 font-medium text-slate-100">axe-core + custom heuristics</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Fix Layer</div>
                <div className="mt-1 font-medium text-slate-100">OpenAI or deterministic fallback</div>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>
    </main>
  );
}
