"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Bug,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  Edit3,
  ListChecks,
  LoaderCircle,
  Plus,
  Rocket,
  Target,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SelectField } from "@/components/ui/select-field";

type Member = { id: string; name: string; avatarColor: string; role: string };
type Version = { id: string; name: string; status: string };
type Milestone = {
  id: string;
  title: string;
  description: string;
  status: string;
  dueAt: string;
  completedAt: string | null;
  ownerId: string | null;
  versionId: string | null;
  owner: { id: string; name: string; avatarColor: string } | null;
  version: { id: string; name: string } | null;
  overdue: boolean;
  upcoming: boolean;
};
type OverviewData = {
  project: {
    id: string;
    code: string;
    name: string;
    description: string;
    background: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
    team: { id: string; name: string };
    owner: { id: string; name: string; avatarColor: string } | null;
  };
  members: Member[];
  versions: Version[];
  permissions: { canManage: boolean };
  kpis: {
    requirements: { total: number; completed: number };
    tasks: { total: number; active: number; pendingAcceptance: number };
    bugs: { open: number; serious: number };
  };
  progress: {
    overall: number;
    breakdown: Record<
      "requirements" | "tasks" | "bugs" | "milestones",
      { value: number; count: number; available: boolean }
    >;
  };
  trend: Array<{ date: string; count: number }>;
  currentVersion: {
    id: string;
    name: string;
    status: string;
    plannedAt: string | null;
    progress: number;
  } | null;
  milestones: Milestone[];
  attention: Array<{ type: "warning" | "danger" | "info"; text: string }>;
  recentCompleted: Array<{
    id: string;
    code: string;
    title: string;
    completedAt: string;
    assignee: { id: string; name: string } | null;
  }>;
};

const labels: Record<string, string> = {
  ACTIVE: "进行中",
  PAUSED: "已暂停",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
  PLANNED: "计划中",
  IN_PROGRESS: "进行中",
  DELAYED: "已延期",
  CANCELLED: "已取消",
  DEVELOPING: "开发中",
  TESTING: "测试中",
  PENDING_RELEASE: "待发布",
  RELEASED: "已发布",
};

const dateText = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-CN", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(value))
    : "未设置";
const dateInput = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Asia/Shanghai",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date(value))
    : "";
const isoDate = (value: string) =>
  value ? new Date(`${value}T00:00:00+08:00`).toISOString() : null;

export function ProjectOverview({ projectId }: { projectId: string }) {
  const [data, setData] = useState<OverviewData | null>(null),
    [days, setDays] = useState(14),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [profileOpen, setProfileOpen] = useState(false),
    [milestone, setMilestone] = useState<Milestone | null | undefined>(undefined);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/overview?days=${days}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "加载项目概览失败");
      setData(body);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载项目概览失败");
    } finally {
      setLoading(false);
    }
  }, [days, projectId]);
  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  if (loading && !data)
    return (
      <div className="grid min-h-80 place-items-center">
        <LoaderCircle className="animate-spin text-blue-600" size={28} />
      </div>
    );
  if (!data)
    return (
      <div className="card p-10 text-center text-sm text-rose-600">
        {error || "无法加载项目概览"}
      </div>
    );

  const cards = [
    {
      label: "需求",
      value: data.kpis.requirements.total,
      note: `${data.kpis.requirements.completed} 项已完成`,
      icon: Target,
    },
    {
      label: "任务",
      value: data.kpis.tasks.total,
      note: `${data.kpis.tasks.active} 项待推进 · ${data.kpis.tasks.pendingAcceptance} 项待验收`,
      icon: ListChecks,
    },
    {
      label: "未关闭 Bug",
      value: data.kpis.bugs.open,
      note: `${data.kpis.bugs.serious} 个高优先级问题`,
      icon: Bug,
    },
    {
      label: "当前版本",
      value: data.currentVersion?.name || "—",
      note: data.currentVersion
        ? `${labels[data.currentVersion.status] || data.currentVersion.status} · 完成度 ${data.currentVersion.progress}%`
        : "尚未创建版本",
      icon: Rocket,
    },
  ];
  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">项目介绍</h3>
              <StatusBadge value={data.project.status} />
            </div>
            <p className="mt-3 max-w-4xl text-sm leading-6 text-slate-600">
              {data.project.description || "暂无项目介绍"}
            </p>
          </div>
          {data.permissions.canManage && (
            <button onClick={() => setProfileOpen(true)} className="secondary-button shrink-0">
              <Edit3 size={16} />
              编辑资料
            </button>
          )}
        </div>
        <div className="grid border-t border-slate-100 bg-slate-50/70 sm:grid-cols-3">
          <InfoCell icon={UserRound} label="项目负责人" value={data.project.owner?.name || "未指定"} />
          <InfoCell icon={CalendarDays} label="项目周期" value={`${dateText(data.project.startDate)} — ${dateText(data.project.endDate)}`} />
          <InfoCell icon={CircleDot} label="所属团队" value={data.project.team.name} />
        </div>
        <div className="border-t border-slate-100 p-5">
          <p className="text-xs font-semibold text-slate-400">项目背景</p>
          <div className="markdown-content mt-3 text-sm leading-6 text-slate-600">
            {data.project.background.trim() ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{data.project.background}</ReactMarkdown>
            ) : (
              <span className="text-slate-400">暂无项目背景，项目经理可在项目资料中补充。</span>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((item) => (
          <div className="card p-5" key={item.label}>
            <div className="flex items-start">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <item.icon size={19} />
              </span>
              <span className="ml-auto text-2xl font-bold">{item.value}</span>
            </div>
            <p className="mt-4 text-sm font-medium">{item.label}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{item.note}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.55fr]">
        <section className="card p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold">综合项目进度</h3>
              <p className="mt-1 text-xs text-slate-400">需求 20% · 任务 50% · Bug 20% · 里程碑 10%</p>
            </div>
            <span className="text-3xl font-bold text-blue-600">{data.progress.overall}%</span>
          </div>
          <div className="mt-6 space-y-4">
            {(
              [
                ["requirements", "需求"],
                ["tasks", "任务"],
                ["bugs", "Bug"],
                ["milestones", "里程碑"],
              ] as const
            ).map(([key, label]) => {
              const item = data.progress.breakdown[key];
              return (
                <div key={key}>
                  <div className="mb-1.5 flex justify-between text-xs text-slate-500">
                    <span>{label} · {item.count} 项</span>
                    <b className="text-slate-700">{item.available ? `${item.value}%` : "暂无数据"}</b>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-blue-500" style={{ width: `${item.available ? item.value : 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <section className="card min-w-0 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold">每日完成任务</h3>
              <p className="mt-1 text-xs text-slate-400">按北京时间统计任务首次验收通过或完成的日期</p>
            </div>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {[7, 14, 30].map((value) => (
                <button
                  key={value}
                  onClick={() => setDays(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium ${days === value ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}
                >
                  {value} 天
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend} margin={{ top: 10, right: 12, left: -24, bottom: 0 }}>
                <CartesianGrid stroke="#eef2f7" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => String(value).slice(5)} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(value) => `${value}`}
                  formatter={(value) => [`${value} 项`, "完成任务"]}
                  contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", boxShadow: "0 8px 24px rgba(15,23,42,.08)", fontSize: 12 }}
                />
                <Line type="monotone" dataKey="count" stroke="#3478f6" strokeWidth={2.5} dot={{ r: 3, fill: "#fff", strokeWidth: 2 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <section className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">项目里程碑</h3>
              <p className="mt-1 text-xs text-slate-400">跟踪评审、内测、交付与发布等关键节点</p>
            </div>
            {data.permissions.canManage && (
              <button onClick={() => setMilestone(null)} className="secondary-button">
                <Plus size={16} />
                新建里程碑
              </button>
            )}
          </div>
          <div className="mt-5 space-y-1">
            {data.milestones.map((item, index) => (
              <div key={item.id} className="group flex gap-4 rounded-xl px-2 py-3 hover:bg-slate-50">
                <div className="flex w-5 flex-col items-center">
                  <span className={`mt-1 size-3 rounded-full ring-4 ${item.status === "COMPLETED" ? "bg-emerald-500 ring-emerald-50" : item.overdue || item.status === "DELAYED" ? "bg-rose-500 ring-rose-50" : item.upcoming ? "bg-amber-500 ring-amber-50" : "bg-blue-500 ring-blue-50"}`} />
                  {index < data.milestones.length - 1 && <span className="mt-2 h-full w-px bg-slate-200" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-slate-800">{item.title}</p>
                    <StatusBadge value={item.overdue && item.status !== "DELAYED" ? "DELAYED" : item.status} />
                    {item.version && <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] text-blue-600">{item.version.name}</span>}
                  </div>
                  {item.description && <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.description}</p>}
                  <p className="mt-2 text-xs text-slate-400">{dateText(item.dueAt)} · {item.owner?.name || "未指定负责人"}</p>
                </div>
                {data.permissions.canManage && (
                  <button onClick={() => setMilestone(item)} className="self-start rounded-lg p-2 text-slate-400 opacity-0 hover:bg-white hover:text-blue-600 group-hover:opacity-100" aria-label={`编辑 ${item.title}`}>
                    <Edit3 size={15} />
                  </button>
                )}
              </div>
            ))}
            {!data.milestones.length && <div className="py-12 text-center text-sm text-slate-400">暂无里程碑</div>}
          </div>
        </section>
        <div className="space-y-5">
          <section className="card p-5">
            <h3 className="font-semibold">需要关注</h3>
            <div className="mt-4 space-y-3">
              {data.attention.map((item) => (
                <div key={item.text} className="flex items-start gap-2 text-sm text-slate-600">
                  <AlertTriangle className={`mt-0.5 shrink-0 ${item.type === "danger" ? "text-rose-500" : item.type === "warning" ? "text-amber-500" : "text-blue-500"}`} size={16} />
                  <span>{item.text}</span>
                </div>
              ))}
              {!data.attention.length && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 size={16} /> 当前没有需要特别关注的风险
                </div>
              )}
            </div>
          </section>
          <section className="card p-5">
            <h3 className="font-semibold">最近完成</h3>
            <div className="mt-4 space-y-4">
              {data.recentCompleted.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={14} /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-slate-400">{item.code} · {item.assignee?.name || "未指定负责人"} · {dateText(item.completedAt)}</p>
                  </div>
                </div>
              ))}
              {!data.recentCompleted.length && <p className="py-6 text-center text-sm text-slate-400">还没有已完成任务</p>}
            </div>
          </section>
        </div>
      </div>

      {profileOpen && (
        <ProfileDialog
          project={data.project}
          close={() => setProfileOpen(false)}
          saved={async () => {
            setProfileOpen(false);
            await load();
          }}
        />
      )}
      {milestone !== undefined && (
        <MilestoneDialog
          projectId={projectId}
          item={milestone}
          members={data.members}
          versions={data.versions}
          close={() => setMilestone(undefined)}
          saved={async () => {
            setMilestone(undefined);
            await load();
          }}
        />
      )}
    </div>
  );
}

function InfoCell({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-slate-100 px-5 py-4 sm:border-r sm:last:border-r-0">
      <Icon size={17} className="shrink-0 text-slate-400" />
      <div className="min-w-0">
        <p className="text-[11px] text-slate-400">{label}</p>
        <p className="mt-0.5 truncate text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  const tone = value === "COMPLETED" || value === "RELEASED" ? "bg-emerald-50 text-emerald-700" : value === "DELAYED" || value === "PAUSED" ? "bg-rose-50 text-rose-700" : value === "CANCELLED" || value === "ARCHIVED" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${tone}`}>{labels[value] || value}</span>;
}

function ProfileDialog({ project, close, saved }: { project: OverviewData["project"]; close: () => void; saved: () => Promise<void> }) {
  const [description, setDescription] = useState(project.description),
    [background, setBackground] = useState(project.background),
    [status, setStatus] = useState(project.status),
    [startDate, setStartDate] = useState(dateInput(project.startDate)),
    [endDate, setEndDate] = useState(dateInput(project.endDate)),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ description, background, status, startDate: isoDate(startDate), endDate: isoDate(endDate) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      await saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }
  return (
    <DialogShell title="编辑项目资料" subtitle="完善项目介绍、背景和计划周期" close={close}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="项目介绍"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={300} className="form-input resize-none" placeholder="用一两句话说明项目要解决的问题" /></Field>
        <Field label="项目背景（支持 Markdown）"><textarea value={background} onChange={(e) => setBackground(e.target.value)} rows={8} maxLength={20000} className="form-input resize-y" placeholder="补充业务背景、目标用户、项目边界和预期价值" /></Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="项目状态"><SelectField value={status} onChange={setStatus} options={[{ value: "ACTIVE", label: "进行中" }, { value: "PAUSED", label: "已暂停" }, { value: "COMPLETED", label: "已完成" }, { value: "ARCHIVED", label: "已归档" }]} /></Field>
          <Field label="开始日期"><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="form-input" /></Field>
          <Field label="结束日期"><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="form-input" /></Field>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <DialogActions close={close} saving={saving} />
      </form>
    </DialogShell>
  );
}

function MilestoneDialog({ projectId, item, members, versions, close, saved }: { projectId: string; item: Milestone | null; members: Member[]; versions: Version[]; close: () => void; saved: () => Promise<void> }) {
  const [title, setTitle] = useState(item?.title || ""),
    [description, setDescription] = useState(item?.description || ""),
    [status, setStatus] = useState(item?.status || "PLANNED"),
    [dueAt, setDueAt] = useState(dateInput(item?.dueAt || null)),
    [ownerId, setOwnerId] = useState(item?.ownerId || ""),
    [versionId, setVersionId] = useState(item?.versionId || ""),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!dueAt) return setError("请选择计划日期");
    setSaving(true); setError("");
    try {
      const response = await fetch(item ? `/api/projects/${projectId}/milestones/${item.id}` : `/api/projects/${projectId}/milestones`, { method: item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, description, status, dueAt: isoDate(dueAt), ownerId: ownerId || null, versionId: versionId || null }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "保存失败");
      await saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }
  async function remove() {
    if (!item || !window.confirm(`确认删除里程碑“${item.title}”？`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/projects/${projectId}/milestones/${item.id}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "删除失败");
      await saved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); setSaving(false); }
  }
  return (
    <DialogShell title={item ? "编辑里程碑" : "新建里程碑"} subtitle="定义项目关键节点、负责人和关联版本" close={close}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="里程碑名称"><input value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={120} required className="form-input" placeholder="例如：完成首轮内部验收" /></Field>
        <Field label="说明"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={2000} className="form-input resize-none" placeholder="说明交付内容和完成标准" /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="状态"><SelectField value={status} onChange={setStatus} options={[{ value: "PLANNED", label: "计划中" }, { value: "IN_PROGRESS", label: "进行中" }, { value: "COMPLETED", label: "已完成" }, { value: "DELAYED", label: "已延期" }, { value: "CANCELLED", label: "已取消" }]} /></Field>
          <Field label="计划日期"><input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} required className="form-input" /></Field>
          <Field label="负责人"><SelectField value={ownerId} onChange={setOwnerId} options={[{ value: "", label: "暂不指定" }, ...members.map((member) => ({ value: member.id, label: member.name }))]} /></Field>
          <Field label="关联版本"><SelectField value={versionId} onChange={setVersionId} options={[{ value: "", label: "不关联版本" }, ...versions.map((version) => ({ value: version.id, label: version.name, description: labels[version.status] || version.status }))]} /></Field>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <div className="flex items-center gap-2 border-t border-slate-100 pt-4">
          {item && <button type="button" onClick={() => void remove()} disabled={saving} className="mr-auto flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-rose-600 hover:bg-rose-50"><Trash2 size={16} />删除</button>}
          <button type="button" onClick={close} className="secondary-button">取消</button>
          <button disabled={saving} className="primary-button">{saving && <LoaderCircle size={16} className="animate-spin" />}{item ? "保存修改" : "创建里程碑"}</button>
        </div>
      </form>
    </DialogShell>
  );
}

function DialogShell({ title, subtitle, close, children }: { title: string; subtitle: string; close: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[70] grid place-items-center overflow-y-auto bg-slate-950/30 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true">
      <div className="my-6 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start border-b border-slate-100 px-6 py-5">
          <div><h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-400">{subtitle}</p></div>
          <button onClick={close} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100" aria-label="关闭"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>{children}</label>;
}

function DialogActions({ close, saving }: { close: () => void; saving: boolean }) {
  return <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={close} className="secondary-button">取消</button><button disabled={saving} className="primary-button">{saving && <LoaderCircle size={16} className="animate-spin" />}保存项目资料</button></div>;
}
