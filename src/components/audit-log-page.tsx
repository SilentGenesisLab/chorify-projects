"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Bot, ChevronDown, Download, Eye, KeyRound, LoaderCircle, Search, UserRound, X } from "lucide-react";

type Project = { id: string; code: string; name: string };
type Log = {
  id: string; actor: { id: string; name: string; phone: string } | null; action: string; resource: string;
  resourceId: string | null; channel: string; token: { id: string; name: string; prefix: string } | null;
  project: Project | null; result: string; metadata: Record<string, unknown>; createdAt: string;
};

const actions: Record<string, string> = {
  REGISTER: "注册账户", CREATE_TEAM: "创建团队", CREATE_PROJECT: "创建项目", CREATE_TEAM_INVITE: "创建邀请链接",
  ACCEPT_TEAM_INVITE: "加入团队", REVOKE_TEAM_INVITE: "撤销邀请", RESET_TEAM_INVITE: "重置邀请",
  UPDATE_TEAM_ROLE: "修改成员角色", REMOVE_TEAM_MEMBER: "移除团队成员", CREATE_API_TOKEN: "创建 API Key",
  UPDATE_API_TOKEN: "修改 API Key", REVOKE_API_TOKEN: "撤销 API Key", READ_WORK_CONTEXT: "读取工作上下文",
  READ_TASK_CONTEXT: "读取任务上下文", SUBMIT_REPORT: "提交工作汇报", SUBMIT_FEEDBACK: "提交反馈",
};
const resources: Record<string, string> = { USER: "用户", TEAM: "团队", TEAM_INVITE: "团队邀请", TEAM_MEMBER: "团队成员", PROJECT: "项目", API_TOKEN: "API Key", TASK: "任务", FEEDBACK: "反馈" };
const dateTime = (value: string) => new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "medium" }).format(new Date(value));
const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function AuditLogPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("ALL");
  const [channel, setChannel] = useState("ALL");
  const [result, setResult] = useState("ALL");
  const [selected, setSelected] = useState<Log | null>(null);

  useEffect(() => { fetch("/api/audit-logs").then(async (response) => {
    const data = await response.json(); if (!response.ok) throw new Error(data.error || "加载失败"); return data;
  }).then((data) => { setLogs(data.logs); setProjects(data.projects); }).catch((cause) => setError(cause instanceof Error ? cause.message : "加载失败")).finally(() => setLoading(false)); }, []);

  const filtered = useMemo(() => logs.filter((log) => {
    const text = `${log.actor?.name ?? ""} ${actions[log.action] ?? log.action} ${log.resourceId ?? ""} ${log.project?.name ?? ""} ${log.token?.name ?? ""}`.toLowerCase();
    return (!query || text.includes(query.toLowerCase())) && (project === "ALL" || log.project?.id === project) &&
      (channel === "ALL" || (channel === "API" ? log.channel !== "WEB" : log.channel === "WEB")) && (result === "ALL" || log.result === result);
  }), [logs, query, project, channel, result]);

  function exportCsv() {
    const rows = [["时间", "操作者", "来源", "API Key", "项目", "操作", "资源", "资源 ID", "结果"], ...filtered.map((log) => [dateTime(log.createdAt), log.actor?.name ?? "系统", log.channel === "WEB" ? "网页" : "API Key", log.token ? `${log.token.name} (${log.token.prefix})` : "", log.project?.name ?? "", actions[log.action] ?? log.action, resources[log.resource] ?? log.resource, log.resourceId ?? "", log.result])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `chorify-audit-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-bold tracking-tight">操作日志</h2><p className="mt-1 text-sm text-slate-500">查看真人网页操作，以及 Codex 等工具通过 API Key 进行的项目操作</p></div><button onClick={exportCsv} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#376ce7] px-4 text-sm font-semibold text-white"><Download size={17}/>导出日志</button></div>
    <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_180px_160px_150px_auto]">
      <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-slate-400"><Search size={16}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索操作者、操作、资源或 Key" className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none"/></label>
      <Select value={project} onChange={setProject} options={[{ value: "ALL", label: "全部项目" }, ...projects.map((x) => ({ value: x.id, label: `${x.code} · ${x.name}` }))]}/>
      <Select value={channel} onChange={setChannel} options={[{value:"ALL",label:"全部来源"},{value:"WEB",label:"网页操作"},{value:"API",label:"API Key"}]}/>
      <Select value={result} onChange={setResult} options={[{value:"ALL",label:"全部结果"},{value:"SUCCESS",label:"成功"},{value:"DENIED",label:"拒绝"},{value:"FAILED",label:"失败"}]}/>
      <div className="flex items-center justify-end text-sm text-slate-500">共 {filtered.length} 条</div>
    </div>
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      {loading ? <div className="grid min-h-64 place-items-center text-slate-400"><LoaderCircle className="animate-spin"/></div> : error ? <div className="p-10 text-center text-rose-600">{error}</div> : filtered.length === 0 ? <div className="grid min-h-64 place-items-center text-center text-slate-400"><div><Activity className="mx-auto mb-3"/><p>暂无符合条件的操作记录</p></div></div> :
      <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left"><thead className="bg-slate-50 text-xs font-medium text-slate-500"><tr><th className="px-5 py-3">操作者 / 来源</th><th className="px-4 py-3">操作</th><th className="px-4 py-3">项目</th><th className="px-4 py-3">资源</th><th className="px-4 py-3">结果</th><th className="px-4 py-3">时间</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((log) => <tr key={log.id} className="hover:bg-slate-50/70">
        <td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`grid size-9 place-items-center rounded-xl ${log.channel === "WEB" ? "bg-blue-50 text-blue-600" : "bg-violet-50 text-violet-600"}`}>{log.channel === "WEB" ? <UserRound size={17}/> : <Bot size={17}/>}</span><div><p className="text-sm font-medium">{log.actor?.name ?? "系统"}</p><p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">{log.channel === "WEB" ? "网页" : <><KeyRound size={11}/>{log.token ? `${log.token.name} · ${log.token.prefix}` : "API Key"}</>}</p></div></div></td>
        <td className="px-4 py-4 text-sm font-medium text-slate-700">{actions[log.action] ?? log.action}</td><td className="px-4 py-4 text-sm text-slate-600">{log.project ? <><span className="font-medium">{log.project.code}</span><span className="block text-xs text-slate-400">{log.project.name}</span></> : "—"}</td>
        <td className="px-4 py-4"><p className="text-sm text-slate-600">{resources[log.resource] ?? log.resource}</p><p className="max-w-[150px] truncate text-xs text-slate-400">{log.resourceId ?? "—"}</p></td><td className="px-4 py-4"><Result value={log.result}/></td><td className="px-4 py-4 text-sm text-slate-500">{dateTime(log.createdAt)}</td><td className="px-5 py-4"><button onClick={() => setSelected(log)} title="查看详情" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><Eye size={17}/></button></td>
      </tr>)}</tbody></table></div>}
    </div>
    {selected && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && setSelected(null)}><div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><h3 className="text-lg font-semibold">操作详情</h3><p className="mt-1 text-sm text-slate-500">日志只保存安全的操作摘要，不保存密钥原文</p></div><button onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><dl className="mt-5 grid grid-cols-[100px_1fr] gap-x-4 gap-y-3 text-sm"><dt className="text-slate-400">操作者</dt><dd>{selected.actor?.name ?? "系统"}</dd><dt className="text-slate-400">来源</dt><dd>{selected.channel === "WEB" ? "网页" : selected.token ? `API Key · ${selected.token.name} (${selected.token.prefix})` : "API Key"}</dd><dt className="text-slate-400">操作</dt><dd>{actions[selected.action] ?? selected.action}</dd><dt className="text-slate-400">项目</dt><dd>{selected.project ? `${selected.project.code} · ${selected.project.name}` : "—"}</dd><dt className="text-slate-400">资源</dt><dd className="break-all">{resources[selected.resource] ?? selected.resource} · {selected.resourceId ?? "—"}</dd><dt className="text-slate-400">时间</dt><dd>{dateTime(selected.createdAt)}</dd></dl><div className="mt-5 rounded-xl bg-slate-50 p-4"><p className="mb-2 text-xs font-medium text-slate-500">安全元数据</p><pre className="max-h-52 overflow-auto whitespace-pre-wrap break-all text-xs leading-5 text-slate-600">{JSON.stringify(selected.metadata, null, 2)}</pre></div></div></div>}
  </div>;
}

function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) { return <label className="relative"><select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 w-full appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-9 text-sm text-slate-600 outline-none focus:border-blue-400">{options.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-3 text-slate-400"/></label>; }
function Result({ value }: { value: string }) { const style = value === "SUCCESS" ? "bg-emerald-50 text-emerald-700" : value === "DENIED" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"; return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${style}`}>{value === "SUCCESS" ? "成功" : value === "DENIED" ? "已拒绝" : "失败"}</span>; }
