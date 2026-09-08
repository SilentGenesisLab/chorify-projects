"use client";

import { naturalDays } from "@/lib/project-schedule";

export function DateRangeField({
  start,
  end,
  onChange,
  disabled = false,
}: {
  start: string;
  end: string;
  onChange: (value: { start: string; end: string }) => void;
  disabled?: boolean;
}) {
  const days = start && end && end >= start ? naturalDays(start, end) : null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-2 block text-xs text-slate-500">计划开始</span>
          <input disabled={disabled} className="field" type="date" value={start} onChange={(event) => onChange({ start: event.target.value, end })} />
        </label>
        <label className="block text-sm">
          <span className="mb-2 block text-xs text-slate-500">计划结束</span>
          <input disabled={disabled} className="field" type="date" value={end} onChange={(event) => onChange({ start, end: event.target.value })} />
        </label>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {start && end ? `${start} 至 ${end}${days ? ` · ${days} 个自然日` : ""}` : "尚未设置完整时间区间"}
      </p>
    </div>
  );
}
