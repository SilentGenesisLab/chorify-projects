"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { naturalDays, shanghaiDateKey } from "@/lib/project-schedule";

type Endpoint = "start" | "end";
type Range = { start: string; end: string };
const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function datePart(value: string) { return value.slice(0, 10); }
function timePart(value: string, fallback: string) { return value.includes("T") ? value.slice(11, 16) : fallback; }
function join(date: string, time: string, includeTime: boolean) { return date ? includeTime ? `${date}T${time}` : date : ""; }
function parts(value: string) { const [year, month, day] = value.split("-").map(Number); return { year, month, day }; }
function monthKey(year: number, month: number) { return `${year}-${String(month).padStart(2, "0")}`; }
function shiftMonth(value: string, amount: number) { const { year, month } = parts(`${value}-01`), date = new Date(Date.UTC(year, month - 1 + amount, 1)); return monthKey(date.getUTCFullYear(), date.getUTCMonth() + 1); }
function formatDate(value: string) { if (!value) return "请选择"; const { year, month, day } = parts(datePart(value)); return `${year}年${month}月${day}日${value.includes("T") ? ` ${value.slice(11, 16)}` : ""}`; }

export function DateRangeField({ start, end, onChange, disabled = false, includeTime = false, title = "排期" }: {
  start: string;
  end: string;
  onChange: (value: Range) => void;
  disabled?: boolean;
  includeTime?: boolean;
  title?: string;
}) {
  const today = shanghaiDateKey(new Date());
  const [active, setActive] = useState<Endpoint | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => (datePart(start || end) || today).slice(0, 7));
  const days = start && end && datePart(end) >= datePart(start) ? naturalDays(datePart(start), datePart(end)) : null;
  const cells = useMemo(() => {
    const { year, month } = parts(`${visibleMonth}-01`), first = new Date(Date.UTC(year, month - 1, 1)), offset = (first.getUTCDay() + 6) % 7;
    return Array.from({ length: 42 }, (_, index) => { const value = new Date(Date.UTC(year, month - 1, index - offset + 1)); return { key: `${monthKey(value.getUTCFullYear(), value.getUTCMonth() + 1)}-${String(value.getUTCDate()).padStart(2, "0")}`, current: value.getUTCMonth() === month - 1 }; });
  }, [visibleMonth]);
  function open(endpoint: Endpoint) { if (disabled) return; const value = endpoint === "start" ? start : end; setVisibleMonth((datePart(value) || today).slice(0, 7)); setActive(endpoint); }
  function select(date: string) {
    if (!active) return;
    if (active === "start") {
      const nextStart = join(date, timePart(start, "09:00"), includeTime), nextEnd = !end || datePart(end) < date ? join(date, timePart(end, "18:00"), includeTime) : end;
      onChange({ start: nextStart, end: nextEnd }); setActive("end"); return;
    }
    const nextEnd = join(date, timePart(end, "18:00"), includeTime), nextStart = !start || date < datePart(start) ? join(date, timePart(start, "09:00"), includeTime) : start;
    onChange({ start: nextStart, end: nextEnd }); setActive(null);
  }
  function setTime(endpoint: Endpoint, time: string) { const value = endpoint === "start" ? start : end, next = join(datePart(value), time, true); onChange(endpoint === "start" ? { start: next, end } : { start, end: next }); }
  const { year, month } = parts(`${visibleMonth}-01`);
  return <fieldset className="relative col-span-full rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
    <legend className="px-2 text-sm font-semibold text-slate-700">{title}</legend>
    <div className="grid gap-3 sm:grid-cols-2">{(["start", "end"] as Endpoint[]).map(endpoint => { const value = endpoint === "start" ? start : end; return <div key={endpoint}><span className="mb-2 block text-xs text-slate-500">{endpoint === "start" ? "计划开始" : "计划完成"}</span><div className="flex flex-wrap gap-2"><button type="button" disabled={disabled} aria-label={`选择${endpoint === "start" ? "计划开始" : "计划完成"}日期`} onClick={() => open(endpoint)} style={{width:"auto"}} className={`field flex min-h-11 min-w-44 flex-1 items-center justify-between gap-2 text-left ${active === endpoint ? "border-blue-500 ring-2 ring-blue-100" : ""}`}><span className={value ? "text-slate-700" : "text-slate-400"}>{formatDate(value)}</span><CalendarDays size={16} className="shrink-0 text-slate-400" /></button>{includeTime && <input aria-label={`${endpoint === "start" ? "计划开始" : "计划完成"}时间`} disabled={disabled || !value} type="time" style={{width:112,flex:"none"}} className="field" value={timePart(value, endpoint === "start" ? "09:00" : "18:00")} onChange={event => setTime(endpoint, event.target.value)} />}</div></div>; })}</div>
    <p className="mt-3 text-xs text-slate-500">{start && end ? `${formatDate(start)} 至 ${formatDate(end)}${days ? ` · ${days} 个自然日` : ""}` : "开始和结束时间共同组成需求排期"}</p>
    {active && <div className="absolute left-4 top-full z-50 mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" role="dialog" aria-label="排期日历"><div className="mb-3 flex items-center"><button type="button" aria-label="上个月" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setVisibleMonth(value => shiftMonth(value, -1))}><ChevronLeft size={16}/></button><strong className="flex-1 text-center text-sm">{year}年{month}月</strong><button type="button" aria-label="下个月" className="rounded-lg p-2 hover:bg-slate-100" onClick={() => setVisibleMonth(value => shiftMonth(value, 1))}><ChevronRight size={16}/></button></div><div className="grid grid-cols-7 text-center">{WEEKDAYS.map(day => <span key={day} className="py-2 text-xs text-slate-400">{day}</span>)}{cells.map(cell => { const selected = cell.key === datePart(start) || cell.key === datePart(end), inRange = start && end && cell.key > datePart(start) && cell.key < datePart(end); return <button type="button" key={cell.key} onClick={() => select(cell.key)} className={`mx-auto grid size-9 place-items-center rounded-lg text-sm ${selected ? "bg-blue-600 font-semibold text-white" : inRange ? "bg-blue-50 text-blue-700" : cell.current ? "text-slate-700 hover:bg-slate-100" : "text-slate-300 hover:bg-slate-50"}`}>{Number(cell.key.slice(-2))}</button>; })}</div><div className="mt-3 flex justify-between border-t border-slate-100 pt-3"><button type="button" className="text-xs text-slate-500 hover:text-blue-600" onClick={() => { onChange({ start: "", end: "" }); setActive(null); }}>清除排期</button><button type="button" className="text-xs font-medium text-blue-600" onClick={() => select(today)}>今天</button></div></div>}
  </fieldset>;
}
