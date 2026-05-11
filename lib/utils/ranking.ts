import { AuditIssue, IssuePriority } from "@/lib/types/audit";
import { priorityWeight } from "@/lib/utils/format";

export function sortIssues(issues: AuditIssue[]) {
  return [...issues].sort((left, right) => {
    const priorityDelta = priorityWeight(right.priority) - priorityWeight(left.priority);
    if (priorityDelta !== 0) return priorityDelta;

    const savingsDelta = (right.savingsMs ?? 0) - (left.savingsMs ?? 0);
    if (savingsDelta !== 0) return savingsDelta;

    return left.title.localeCompare(right.title);
  });
}

export function countByPriority(issues: AuditIssue[]) {
  const result: Record<IssuePriority, number> = {
    high: 0,
    medium: 0,
    low: 0
  };

  for (const issue of issues) {
    result[issue.priority] += 1;
  }

  return result;
}
