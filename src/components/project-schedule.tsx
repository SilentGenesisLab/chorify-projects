"use client";

import { FormEvent, PointerEvent as ReactPointerEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronRight, GripVertical, LoaderCircle, X } from "lucide-react";

type Person = { id: string; name: string; avatarColor: string } | null;
type ScheduleTask = { id: string; code: string; title: string; status: string; priority: string; requirementId: string | null; plannedStartAt: string | null; dueAt: string | null; startedAt: string | null; closedAt: string | null; plannedDays: number | null; actualDays: number | null; health: string; dependencyConflict: boolean; assignee: Person; dependencyIds: string[] };
type ScheduleRequirement = { id: string; code: string; title: string; status: string; priority: string; plannedStartAt: string | null; dueAt: string | null; startedAt: string | null; closedAt: string | null; plannedDays: number | null; actualDays: number | null; health: string; progress: number | null; requester: Person; tasks: ScheduleTask[] };
type ScheduleData = { generatedAt: string; permissions: { canWrite: boolean }; members: Array<{ id: string; name: string }>; requirements: ScheduleRequirement[]; unassignedTasks: ScheduleTask[] };
type Row = { kind: "requirement" | "task"; item: ScheduleRequirement | ScheduleTask; depth: number };
type Zoom = "week" | "month" | "quarter";
type Drag = { id: string; kind: Row["kind"]; mode: "move" | "start" | "end"; originX: number; delta: number };

const DAY = 86_400_000;
const zooms: Record<Zoom, { label: string; days: number; cell: number }> = {
  week: { label: "周", days: 14, cell: 42 }, month: { label: "月", days: 42, cell: 25 }, quarter: { label: "季度", days: 91, cell: 13 },
};
const statusLabels: Record<string, string> = { DRAFT: "草稿", REVIEW: "评审中", APPROVED: "已确认", DEVELOPING: "开发中", IN_PROGRESS: "进行中", DONE: "已完成", TODO: "待处理", PENDING_ACCEPTANCE: "待验收", NEEDS_CHANGES: "需修改", ACCEPTED: "已通过" };
const healthLabels: Record<string, string> = { UNSCHEDULED: "未排期", NOT_STARTED: "未开始", IN_PROGRESS: "进行中", AT_RISK: "临期", OVERDUE: "已逾期", COMPLETED: "按期完成", COMPLETED_LATE: "延期完成" };
const healthClass: Record<string, string> = { UNSCHEDULED: "bg-slate-100 text-slate-500", NOT_STARTED: "bg-slate-100 text-slate-600", IN_PROGRESS: "bg-blue-50 text-blue-700", AT_RISK: "bg-amber-50 text-amber-700", OVERDUE: "bg-rose-50 text-rose-700", COMPLETED: "bg-emerald-50 text-emerald-700", COMPLETED_LATE: "bg-orange-50 text-orange-700" };

function key(value: Date | string) { return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai" }).format(new Date(value)); }
function dateFromKey(value: string) { return new Date(`${value}T00:00:00+08:00`); }
function calendarDay(value: Date | string) { const [year,month,day]=key(value).split("-").map(Number); return new Date(Date.UTC(year,month-1,day)); }
function weekday(value: Date | string) { return calendarDay(value).getUTCDay(); }
function dayNumber(value: Date | string) { return Number(key(value).slice(-2)); }
function addDays(value: Date | string, amount: number) { const d = dateFromKey(key(value)); d.setUTCDate(d.getUTCDate() + amount); return d; }
function diffDays(left: Date | string, right: Date | string) { return Math.round((dateFromKey(key(left)).getTime() - dateFromKey(key(right)).getTime()) / DAY); }
function startOfWeek(value = new Date()) { const d = dateFromKey(key(value)); const offset = (weekday(value) + 6) % 7; d.setUTCDate(d.getUTCDate() - offset); return d; }
function iso(value: string) { return value ? dateFromKey(value).toISOString() : null; }
function monthText(value: Date) { return new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long" }).format(value); }

export function ProjectSchedule({ projectId, highlightedWeek }: { projectId: string; highlightedWeek: string }) {
  const [zoom, setZoom] = useState<Zoom>("month");
  const [anchor, setAnchor] = useState(() => startOfWeek());
  const [data, setData] = useState<ScheduleData | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set()), [showUnscheduled, setShowUnscheduled] = useState(true);
  const [statusFilter,setStatusFilter]=useState("ALL"),[ownerFilter,setOwnerFilter]=useState("ALL");
  const [drag, setDrag] = useState<Drag | null>(null), [editor, setEditor] = useState<Row | null>(null);
  const config = zooms[zoom], end = useMemo(() => addDays(anchor, config.days), [anchor, config.days]);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from: anchor.toISOString(), to: end.toISOString(), includeUnscheduled: String(showUnscheduled) });
      if(statusFilter!=="ALL")params.append("status",statusFilter);
      if(ownerFilter!=="ALL")params.set("assigneeId",ownerFilter);
      const response = await fetch(`/api/projects/${projectId}/schedule?${params}`), body = await response.json();
      if (!response.ok) throw new Error(body.error || "加载排期失败");
      setData(body); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "加载排期失败"); }
    finally { setLoading(false); }
  }, [anchor, end, ownerFilter, projectId, showUnscheduled, statusFilter]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const result: Row[] = [];
    for (const requirement of data.requirements) {
      result.push({ kind: "requirement", item: requirement, depth: 0 });
      if (expanded.has(requirement.id)) result.push(...requirement.tasks.map(item => ({ kind: "task" as const, item, depth: 1 })));
    }
    result.push(...data.unassignedTasks.map(item => ({ kind: "task" as const, item, depth: 0 })));
    return result;
  }, [data, expanded]);
  const days = useMemo(() => Array.from({ length: config.days }, (_, index) => addDays(anchor, index)), [anchor, config.days]);
  const months = useMemo(() => days.reduce<Array<{ text: string; start: number; count: number }>>((items, day, index) => {
    const text = monthText(day), last = items.at(-1);
    if (last?.text === text) last.count++; else items.push({ text, start: index, count: 1 });
    return items;
  }, []), [days]);

  function beginDrag(event: ReactPointerEvent, row: Row, mode: Drag["mode"]) {
    if (!data?.permissions.canWrite || !row.item.plannedStartAt || !row.item.dueAt) return;
    event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ id: row.item.id, kind: row.kind, mode, originX: event.clientX, delta: 0 });
  }
  function moveDrag(event: ReactPointerEvent) { if (drag) setDrag({ ...drag, delta: Math.round((event.clientX - drag.originX) / config.cell) }); }
  async function finishDrag(row: Row) {
    if (!drag || drag.id !== row.item.id || !row.item.plannedStartAt || !row.item.dueAt) return setDrag(null);
    const delta = drag.delta, mode = drag.mode; setDrag(null);
    if (!delta) return;
    let start = dateFromKey(key(row.item.plannedStartAt)), due = dateFromKey(key(row.item.dueAt));
    if (mode !== "end") start = addDays(start, delta);
    if (mode !== "start") due = addDays(due, delta);
    if (due < start) return setError("计划结束时间不能早于计划开始时间");
    try {
      const resourceModule = row.kind === "requirement" ? "requirements" : "tasks";
      const response = await fetch(`/api/projects/${projectId}/workspace/${resourceModule}/${row.item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plannedStartAt: start.toISOString(), dueAt: due.toISOString() }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "保存排期失败"); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存排期失败"); }
  }
  function displayDates(row: Row) {
    if (!drag || drag.id !== row.item.id || !row.item.plannedStartAt || !row.item.dueAt) return { start: row.item.plannedStartAt, due: row.item.dueAt };
    return { start: drag.mode === "end" ? row.item.plannedStartAt : addDays(row.item.plannedStartAt, drag.delta).toISOString(), due: drag.mode === "start" ? row.item.dueAt : addDays(row.item.dueAt, drag.delta).toISOString() };
  }
  const width = config.days * config.cell, highlightLeft = diffDays(highlightedWeek, anchor) * config.cell, todayLeft = diffDays(new Date(), anchor) * config.cell;

  return <section className="project-schedule card overflow-hidden">
    <header className="flex flex-col gap-4 border-b border-slate-100 p-5 lg:flex-row lg:items-center">
      <div><div className="flex items-center gap-2"><CalendarDays size={18} className="text-blue-600"/><h3 className="font-semibold">实时排期</h3><span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] text-blue-700">不随周报固化</span></div><p className="mt-1 text-xs text-slate-400">需求跨周连续展示，展开可查看任务、负责人及依赖冲突</p></div>
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <label className="flex items-center gap-2 text-xs text-slate-500"><input type="checkbox" checked={showUnscheduled} onChange={e=>setShowUnscheduled(e.target.checked)}/>显示未排期</label>
        <select aria-label="排期状态筛选" className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">全部状态</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="排期负责人筛选" className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs" value={ownerFilter} onChange={e=>setOwnerFilter(e.target.value)}><option value="ALL">全部负责人</option>{data?.members.map(member=><option key={member.id} value={member.id}>{member.name}</option>)}</select>
        <button className="secondary-button px-3" onClick={()=>setAnchor(addDays(anchor,-config.days))}>上一周期</button>
        <button className="secondary-button px-3" onClick={()=>setAnchor(startOfWeek())}>今天</button>
        <button className="secondary-button px-3" onClick={()=>setAnchor(addDays(anchor,config.days))}>下一周期</button>
        <div className="flex rounded-xl bg-slate-100 p-1">{(Object.keys(zooms) as Zoom[]).map(value=><button key={value} onClick={()=>setZoom(value)} className={`rounded-lg px-3 py-1.5 text-xs ${zoom===value?"bg-white font-semibold text-blue-700 shadow-sm":"text-slate-500"}`}>{zooms[value].label}</button>)}</div>
      </div>
    </header>
    {error&&<div role="alert" className="border-b border-rose-100 bg-rose-50 px-5 py-3 text-sm text-rose-700">{error}</div>}
    <div className="overflow-x-auto">
      <div className="grid min-w-max" style={{ gridTemplateColumns: `320px ${width}px` }}>
        <div className="sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 px-4 py-4 text-xs font-semibold text-slate-500">工作项 / 负责人 / 状态</div>
        <div className="relative border-b border-slate-200 bg-slate-50" style={{ width }}>
          <div className="relative h-7 border-b border-slate-200">{months.map(item=><span key={`${item.text}-${item.start}`} className="absolute top-1 text-xs font-semibold text-slate-500" style={{left:item.start*config.cell+6}}>{item.text}</span>)}</div>
          <div className="flex h-9">{days.map(day=><div key={key(day)} style={{width:config.cell}} className={`shrink-0 border-r border-slate-200/70 pt-1 text-center text-[10px] ${weekday(day)===0||weekday(day)===6?"bg-slate-100":""}`}><span className={key(day)===key(new Date())?"rounded-full bg-blue-600 px-1.5 py-1 text-white":"text-slate-400"}>{dayNumber(day)}</span>{zoom!=="quarter"&&<div className="mt-1 text-[9px] text-slate-300">{["日","一","二","三","四","五","六"][weekday(day)]}</div>}</div>)}</div>
        </div>
        {loading&&!data?<div className="col-span-2 grid h-44 place-items-center"><LoaderCircle className="animate-spin text-blue-600"/></div>:rows.length===0?<div className="col-span-2 p-12 text-center text-sm text-slate-400">当前范围暂无排期，开启“显示未排期”可为工作项设置日期</div>:rows.map(row=>{
          const dates=displayDates(row), start=dates.start?diffDays(dates.start,anchor):null, due=dates.due?diffDays(dates.due,anchor):null;
          const left=start===null?0:Math.max(0,start)*config.cell, right=due===null?0:Math.min(config.days-1,due), barWidth=start===null||due===null?0:Math.max(config.cell*.7,(right-Math.max(0,start)+1)*config.cell);
          const req=row.kind==="requirement"?row.item as ScheduleRequirement:null;
          return <div className="contents" key={`${row.kind}-${row.item.id}`}>
            <button onClick={()=>setEditor(row)} className={`sticky left-0 z-20 flex h-14 items-center border-b border-r border-slate-100 bg-white px-3 text-left hover:bg-blue-50/40 ${row.depth?"pl-9":""}`}>
              {req&&<span onClick={event=>{event.stopPropagation();setExpanded(value=>{const next=new Set(value);if(next.has(req.id))next.delete(req.id);else next.add(req.id);return next;})}} className="mr-1 rounded p-1 hover:bg-slate-100">{expanded.has(req.id)?<ChevronDown size={14}/>:<ChevronRight size={14}/>}</span>}
              {row.kind==="task"&&<GripVertical size={13} className="mr-2 text-slate-300"/>}<span className="min-w-0"><span className="block max-w-44 truncate text-xs font-medium">{row.item.code} · {row.item.title}</span><span className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400"><span>{row.kind==="requirement"?(row.item as ScheduleRequirement).requester?.name||"未指定提出者":(row.item as ScheduleTask).assignee?.name||"未分配"}</span><span>·</span><span>{statusLabels[row.item.status]||row.item.status}</span>{row.item.plannedDays&&<><span>·</span><span>{row.item.plannedDays}天</span></>}</span></span>
              <span className={`ml-auto shrink-0 rounded-full px-2 py-1 text-[10px] ${healthClass[row.item.health]||healthClass.UNSCHEDULED}`}>{healthLabels[row.item.health]||row.item.health}</span>
            </button>
            <div className="relative h-14 overflow-hidden border-b border-slate-100" style={{width}} onPointerMove={moveDrag} onPointerUp={()=>void finishDrag(row)}>
              <Grid days={days} cell={config.cell}/>{highlightLeft<width&&highlightLeft+7*config.cell>0&&<div className="absolute inset-y-0 bg-blue-50/60" style={{left:Math.max(0,highlightLeft),width:Math.min(width-Math.max(0,highlightLeft),7*config.cell)}}/>}{todayLeft>=0&&todayLeft<width&&<div className="absolute inset-y-0 z-10 w-px bg-blue-500" style={{left:todayLeft+config.cell/2}}/>}
              {start!==null&&due!==null?<div title="拖动调整排期，拖动两端改变起止日期" className={`absolute top-3 z-20 flex h-8 items-center overflow-hidden rounded-lg text-[10px] text-white shadow-sm ${row.kind==="requirement"?"bg-blue-600":"bg-sky-500"} ${row.item.health==="OVERDUE"?"bg-rose-500":row.item.health==="AT_RISK"?"bg-amber-500":""}`} style={{left,width:barWidth}} onPointerDown={event=>beginDrag(event,row,"move")}>
                {data?.permissions.canWrite&&<span className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-black/10" onPointerDown={event=>{event.stopPropagation();beginDrag(event,row,"start")}}/>}<span className="truncate px-3">{req?.progress!==null&&req?.progress!==undefined?`${req.progress}%`:statusLabels[row.item.status]||row.item.status}</span>{(row.item as ScheduleTask).dependencyConflict&&<AlertTriangle size={13} className="ml-auto mr-2 shrink-0"/>}{data?.permissions.canWrite&&<span className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-black/10" onPointerDown={event=>{event.stopPropagation();beginDrag(event,row,"end")}}/>}
              </div>:<button onClick={()=>setEditor(row)} className="absolute left-3 top-4 z-20 text-[11px] text-slate-400 hover:text-blue-600">+ 设置排期</button>}
            </div>
          </div>})}
      </div>
    </div>
    {editor&&<ScheduleDialog projectId={projectId} row={editor} canWrite={Boolean(data?.permissions.canWrite)} onClose={()=>setEditor(null)} onSaved={async()=>{setEditor(null);await load()}}/>}
  </section>;
}

function Grid({days,cell}:{days:Date[];cell:number}) { return <div className="absolute inset-0 flex">{days.map(day=><div key={key(day)} style={{width:cell}} className={`h-full shrink-0 border-r border-slate-100 ${weekday(day)===0||weekday(day)===6?"bg-slate-50":""}`}/>)}</div>; }

function ScheduleDialog({projectId,row,canWrite,onClose,onSaved}:{projectId:string;row:Row;canWrite:boolean;onClose:()=>void;onSaved:()=>void}) {
  const [start,setStart]=useState(row.item.plannedStartAt?key(row.item.plannedStartAt):""),[due,setDue]=useState(row.item.dueAt?key(row.item.dueAt):""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function save(event:FormEvent){event.preventDefault();if(start&&due&&due<start)return setError("计划结束日期不能早于计划开始日期");setBusy(true);try{const resourceModule=row.kind==="requirement"?"requirements":"tasks",response=await fetch(`/api/projects/${projectId}/workspace/${resourceModule}/${row.item.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({plannedStartAt:iso(start),dueAt:iso(due)})}),body=await response.json();if(!response.ok)throw new Error(body.error||"保存失败");onSaved()}catch(cause){setError(cause instanceof Error?cause.message:"保存失败")}finally{setBusy(false)}}
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"><button className="absolute inset-0" aria-label="关闭排期弹窗" onClick={onClose}/><section role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl"><header className="flex items-center border-b border-slate-100 px-5 py-4"><div><h3 className="font-semibold">{row.item.code} · 排期</h3><p className="mt-1 max-w-80 truncate text-xs text-slate-400">{row.item.title}</p></div><button className="ml-auto p-2" onClick={onClose}><X size={18}/></button></header><form onSubmit={save} className="space-y-4 p-5"><label className="block text-sm"><span className="mb-2 block text-xs text-slate-500">计划开始</span><input disabled={!canWrite} className="field" type="date" value={start} onChange={e=>setStart(e.target.value)}/></label><label className="block text-sm"><span className="mb-2 block text-xs text-slate-500">计划结束</span><input disabled={!canWrite} className="field" type="date" value={due} onChange={e=>setDue(e.target.value)}/></label>{row.item.actualDays&&<p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">实际已进行 {row.item.actualDays} 个自然日，首次开始时间不会因重新排期而改变。</p>}{error&&<p className="text-sm text-rose-600">{error}</p>}<footer className="flex justify-end gap-2"><button type="button" className="secondary-button" onClick={onClose}>取消</button>{canWrite&&<button disabled={busy} className="primary-button">{busy?"保存中…":"保存排期"}</button>}</footer></form></section></div>;
}
