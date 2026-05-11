"use client";

import { useAuditStore } from "@/lib/state/useAuditStore";

export function IssueFilters() {
  const priorityFilter = useAuditStore((state) => state.priorityFilter);
  const sectionFilter = useAuditStore((state) => state.sectionFilter);
  const includeLowPriority = useAuditStore((state) => state.includeLowPriority);
  const setPriorityFilter = useAuditStore((state) => state.setPriorityFilter);
  const setSectionFilter = useAuditStore((state) => state.setSectionFilter);
  const setIncludeLowPriority = useAuditStore((state) => state.setIncludeLowPriority);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        value={priorityFilter}
        onChange={(event) => setPriorityFilter(event.target.value as "all" | "high" | "medium" | "low")}
        className="h-10 rounded-full border border-slate-700 bg-slate-950 px-4 text-sm text-slate-200 outline-none focus:border-cyan-400/50"
      >
        <option value="all">All priorities</option>
        <option value="high">High priority</option>
        <option value="medium">Medium priority</option>
        <option value="low">Low priority</option>
      </select>

      <select
        value={sectionFilter}
        onChange={(event) => setSectionFilter(event.target.value as "all" | "performance" | "accessibility")}
        className="h-10 rounded-full border border-slate-700 bg-slate-950 px-4 text-sm text-slate-200 outline-none focus:border-cyan-400/50"
      >
        <option value="all">All sections</option>
        <option value="performance">Performance</option>
        <option value="accessibility">Accessibility</option>
      </select>

      <label className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-300">
        <input
          type="checkbox"
          checked={includeLowPriority}
          onChange={(event) => setIncludeLowPriority(event.target.checked)}
          className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-cyan-400"
        />
        Include low priority
      </label>
    </div>
  );
}
