"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { ScheduleZoom, schedulePeriod, shanghaiDateKey } from "@/lib/project-schedule";

const labels: Record<ScheduleZoom, string> = { week: "周", month: "月", quarter: "季度" };

function periodLabel(anchor: Date, zoom: ScheduleZoom) {
  const period = schedulePeriod(anchor, zoom);
  const start = shanghaiDateKey(period.start);
  const end = shanghaiDateKey(new Date(period.end.getTime() - 86_400_000));
  const [year, month, day] = start.split("-").map(Number);
  if (zoom === "month") return `${year}年${month}月`;
  if (zoom === "quarter") return `${year}年第${Math.floor((month - 1) / 3) + 1}季度`;
  const [, endMonth, endDay] = end.split("-").map(Number);
  return `${year}年${month}月${day}日 — ${endMonth}月${endDay}日`;
}

export function SchedulePeriodControl({ anchor, zoom, onZoom, onPrevious, onToday, onNext }: {
  anchor: Date;
  zoom: ScheduleZoom;
  onZoom: (zoom: ScheduleZoom) => void;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-56 items-center gap-2 px-2">
        <CalendarDays size={16} className="text-blue-600" />
        <span className="text-sm font-semibold text-slate-700">{periodLabel(anchor, zoom)}</span>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="上一周期" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onPrevious}><ChevronLeft size={16} /></button>
        <button type="button" className="rounded-lg px-3 py-2 text-xs text-slate-600 hover:bg-slate-100" onClick={onToday}>今天</button>
        <button type="button" aria-label="下一周期" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={onNext}><ChevronRight size={16} /></button>
      </div>
      <div className="flex rounded-xl bg-slate-100 p-1">
        {(Object.keys(labels) as ScheduleZoom[]).map((value) => <button type="button" key={value} onClick={() => onZoom(value)} className={`rounded-lg px-3 py-1.5 text-xs ${zoom === value ? "bg-white font-semibold text-blue-700 shadow-sm" : "text-slate-500"}`}>{labels[value]}</button>)}
      </div>
    </div>
  );
}
