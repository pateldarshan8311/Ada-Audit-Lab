export function ProgressBar({
  progress,
  label
}: {
  progress: number;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-950/55 p-4">
      <div className="flex items-center justify-between gap-3 text-sm text-slate-300">
        <span>{label}</span>
        <span className="font-medium text-cyan-200">{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-900">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#22d3ee,#84cc16)] transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
