"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Camera, Check, Clock3, Copy, KeyRound, Laptop, LoaderCircle, Pencil, Target, UserRound, X } from "lucide-react";

type MemberList = { viewerUserId: string; members: Array<{ id: string; userId: string; name: string }> };
type Profile = {
  member: { id: string; userId: string; displayName: string; projectDisplayName: string | null; title: string | null; projectTitle: string | null; responsibility: string | null; projectResponsibility: string | null; bio: string | null; projectBio: string | null; avatarUrl: string | null; projectAvatarUrl: string | null; avatarColor: string; phone: string; roleLabel: string };
  project: { id: string; name: string; team: { id: string; name: string } | null };
  permissions: { canEdit: boolean; canViewDetails: boolean; isSelf: boolean };
};
type Usage = { totalTokens: number | string; sessions: number };
type Statistics = {
  contribution: { requirementsProposed: number; requirementsClosed: number; averageRequirementHours: number | null; weeklyCompletedTasks: number; pendingAcceptance: number; currentTasks: Array<{ id: string; code: string; title: string; status: string; priority: string; dueAt: string | null }> };
  usage: { today: Usage; week: Usage; month: Usage; all: Usage; scopeLabel: string; details: null | Array<{ date: string; tool: string; model: string; inputTokens: number | string; outputTokens: number | string; cacheTokens: number | string; reasoningTokens: number | string; sessions: number }>; devices: Array<{ id?: string; name?: string; platform?: string; clientVersion?: string; lastSeenAt: string | null; lastStatus: string; lastError?: string | null; revokedAt?: string | null }> };
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body;
}
function number(value: number | string) { return typeof value === "number" ? value : Number(value); }
function compact(value: number | string) { return new Intl.NumberFormat("zh-CN", { notation: "compact", maximumFractionDigits: 2 }).format(number(value)); }
function dateTime(value: string | null) { return value ? new Date(value).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }) : "尚未上报"; }
function duration(hours: number | null) { if (hours === null) return "暂无数据"; return hours < 24 ? `${hours} 小时` : `${(hours / 24).toFixed(1)} 天`; }

export function ProjectPersonalInfo({ projectId }: { projectId: string }) {
  const [memberId, setMemberId] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { json<MemberList>(`/api/projects/${projectId}/members`).then((data) => { const own = data.members.find((member) => member.userId === data.viewerUserId); if (own) setMemberId(own.id); else setError("你可以管理此团队项目，但尚未作为项目成员加入，暂无项目个人信息。"); }).catch((cause) => setError(cause.message)); }, [projectId]);
  if (error) return <div className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>;
  if (!memberId) return <div className="grid min-h-64 place-items-center"><LoaderCircle className="animate-spin text-blue-600" /></div>;
  return <ProjectMemberProfile projectId={projectId} memberId={memberId} />;
}

export function ProjectMemberProfile({ projectId, memberId, close }: { projectId: string; memberId: string; close?: () => void }) {
  const [profile, setProfile] = useState<Profile | null>(null), [stats, setStats] = useState<Statistics | null>(null), [editing, setEditing] = useState(false), [registration, setRegistration] = useState<{ installCommand: string; expiresAt: string } | null>(null), [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const [nextProfile, nextStats] = await Promise.all([json<Profile>(`/api/projects/${projectId}/members/${memberId}/profile`), json<Statistics>(`/api/projects/${projectId}/members/${memberId}/statistics`)]);
      setProfile(nextProfile); setStats(nextStats); setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败"); }
  }, [memberId, projectId]);
  useEffect(() => {
    let active = true;
    Promise.all([json<Profile>(`/api/projects/${projectId}/members/${memberId}/profile`), json<Statistics>(`/api/projects/${projectId}/members/${memberId}/statistics`)])
      .then(([nextProfile, nextStats]) => { if (active) { setProfile(nextProfile); setStats(nextStats); setError(""); } })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "加载失败"); });
    return () => { active = false; };
  }, [memberId, projectId]);
  const toolUsage = useMemo(() => {
    const values = new Map<string, number>();
    for (const row of stats?.usage.details || []) values.set(row.tool, (values.get(row.tool) || 0) + number(row.inputTokens) + number(row.outputTokens) + number(row.cacheTokens) + number(row.reasoningTokens));
    return [...values];
  }, [stats]);
  if (!profile || !stats) return <div className={close ? "fixed inset-0 z-[90] grid place-items-center bg-slate-950/35" : "grid min-h-64 place-items-center"}>{error || <LoaderCircle className="animate-spin text-blue-600" />}</div>;
  const content = <div className="space-y-5">
    {error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    <section className="card p-5 sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl text-2xl font-bold text-white" style={{ backgroundColor: profile.member.avatarColor }}>{profile.member.avatarUrl ? <Image src={profile.member.avatarUrl} alt="项目头像" width={80} height={80} unoptimized className="size-full object-cover" /> : profile.member.displayName.slice(0, 1)}</span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="text-xl font-bold">{profile.member.displayName}</h3><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{profile.member.roleLabel}</span></div><p className="mt-1 text-sm text-slate-500">{profile.member.title || "暂未设置项目岗位"} · {profile.member.phone}</p><p className="mt-2 text-sm text-slate-500">{profile.project.name} · {profile.project.team?.name || "个人项目"}</p></div>
        {profile.permissions.canEdit && <button onClick={() => setEditing(true)} className="secondary-button"><Pencil size={16} />编辑项目档案</button>}
      </div>
      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 md:grid-cols-2"><Info title="项目职责" value={profile.member.responsibility || "暂未设置"} /><Info title="个人介绍" value={profile.member.bio || "暂未设置"} /></div>
    </section>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Metric label="提出需求" value={stats.contribution.requirementsProposed} icon={Target} /><Metric label="闭环需求" value={stats.contribution.requirementsClosed} icon={Check} /><Metric label="平均闭环时间" value={duration(stats.contribution.averageRequirementHours)} icon={Clock3} /><Metric label="本周完成" value={stats.contribution.weeklyCompletedTasks} icon={Activity} /><Metric label="待我验收" value={stats.contribution.pendingAcceptance} icon={UserRound} /></div>
    <section className="card overflow-hidden"><div className="border-b border-slate-100 p-5"><h4 className="font-semibold">当前任务</h4><p className="mt-1 text-xs text-slate-400">当前项目中由该成员负责且尚未完成的任务</p></div>{stats.contribution.currentTasks.length ? <div className="divide-y divide-slate-100">{stats.contribution.currentTasks.map((task) => <div key={task.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">{task.title}</p><p className="mt-0.5 text-xs text-slate-400">{task.code}</p></div><div className="sm:ml-auto"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{task.status}</span></div></div>)}</div> : <div className="p-10 text-center text-sm text-slate-400">当前没有未完成任务</div>}</section>
    <section className="card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start"><div><h4 className="font-semibold">AI Token 用量</h4><p className="mt-1 text-xs text-amber-600">{stats.usage.scopeLabel}</p></div>{profile.permissions.isSelf && <button onClick={async () => { try { setRegistration(await json("/api/usage-collectors/registrations", { method: "POST" })); } catch (cause) { setError(cause instanceof Error ? cause.message : "生成失败"); } }} className="primary-button sm:ml-auto"><KeyRound size={16} />接入 Token 统计</button>}</div>
      <div className="mt-5 grid gap-3 sm:grid-cols-4"><UsageMetric label="今日" usage={stats.usage.today} /><UsageMetric label="本周" usage={stats.usage.week} /><UsageMetric label="本月" usage={stats.usage.month} /><UsageMetric label="累计" usage={stats.usage.all} /></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="rounded-xl border border-slate-100 p-4"><p className="text-sm font-medium">工具分布（近30日）</p>{toolUsage.length ? <div className="mt-4 space-y-3">{toolUsage.map(([tool, total]) => <div key={tool}><div className="flex text-xs"><span>{tool === "CODEX" ? "Codex" : "Claude Code"}</span><span className="ml-auto">{compact(total)}</span></div><div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.max(4, total / Math.max(...toolUsage.map(([, value]) => value)) * 100)}%` }} /></div></div>)}</div> : <p className="mt-6 text-sm text-slate-400">接入采集器后显示用量趋势</p>}</div><div className="rounded-xl border border-slate-100 p-4"><p className="text-sm font-medium">采集设备</p><div className="mt-3 space-y-2">{stats.usage.devices.length ? stats.usage.devices.map((device, index) => <div key={device.id || index} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"><Laptop size={17} className="text-blue-500"/><div className="min-w-0"><p className="truncate text-sm">{device.name || "采集设备"}</p><p className="text-xs text-slate-400">{device.lastStatus} · {dateTime(device.lastSeenAt)}</p></div>{profile.permissions.isSelf && device.id && !device.revokedAt && <button onClick={async()=>{await json(`/api/usage-collectors/devices/${device.id}`,{method:"DELETE"});await load();}} className="ml-auto text-xs text-rose-600">撤销</button>}</div>) : <p className="py-4 text-sm text-slate-400">尚未接入采集设备</p>}</div></div></div>
    </section>
    {editing && <EditProfile profile={profile} close={() => setEditing(false)} saved={async () => { setEditing(false); await load(); }} />}
    {registration && <Registration command={registration.installCommand} expiresAt={registration.expiresAt} close={() => setRegistration(null)} />}
  </div>;
  return close ? <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-sm"><button aria-label="关闭成员详情" className="fixed inset-0" onClick={close}/><section className="relative mx-auto my-5 max-w-5xl rounded-2xl bg-[#f7f9fc] p-5 shadow-2xl"><button onClick={close} className="absolute right-4 top-4 z-10 rounded-lg bg-white p-2 text-slate-400"><X size={18}/></button>{content}</section></div> : content;
}

function Info({ title, value }: { title: string; value: string }) { return <div><p className="text-xs text-slate-400">{title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{value}</p></div>; }
function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Target }) { return <div className="card p-4"><div className="flex items-center gap-2 text-slate-400"><Icon size={16}/><span className="text-xs">{label}</span></div><p className="mt-3 text-xl font-bold">{value}</p></div>; }
function UsageMetric({ label, usage }: { label: string; usage: Usage }) { return <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-400">{label}</p><p className="mt-2 text-xl font-bold text-slate-800">{compact(usage.totalTokens)}</p><p className="mt-1 text-[11px] text-slate-400">{usage.sessions} 个会话</p></div>; }

function EditProfile({ profile, close, saved }: { profile: Profile; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ displayName: profile.member.projectDisplayName || "", title: profile.member.projectTitle || "", responsibility: profile.member.projectResponsibility || "", bio: profile.member.projectBio || "", avatarUrl: profile.member.projectAvatarUrl || "" }), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  function set(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function avatar(file?: File) { if (!file) return; if (file.size > 512 * 1024) return setError("头像不能超过 512KB"); const reader = new FileReader(); reader.onload = () => set("avatarUrl", String(reader.result)); reader.readAsDataURL(file); }
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await json(`/api/projects/${profile.project.id}/members/${profile.member.id}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null]))) }); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); } finally { setBusy(false); } }
  return <Modal title="编辑项目成员档案" close={close}><form onSubmit={submit} className="space-y-4"><div className="flex items-center gap-3"><label className="secondary-button cursor-pointer"><Camera size={16}/>上传项目头像<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => avatar(event.target.files?.[0])}/></label>{form.avatarUrl && <button type="button" onClick={() => set("avatarUrl", "")} className="text-sm text-slate-500">移除</button>}</div><Field label="项目内显示名"><input className="field" value={form.displayName} onChange={(event) => set("displayName", event.target.value)} maxLength={40}/></Field><Field label="项目岗位"><input className="field" value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={80}/></Field><Field label="项目职责"><textarea className="field min-h-24" value={form.responsibility} onChange={(event) => set("responsibility", event.target.value)} maxLength={500}/></Field><Field label="个人介绍"><textarea className="field min-h-28" value={form.bio} onChange={(event) => set("bio", event.target.value)} maxLength={1000}/></Field><p className="text-xs text-slate-400">以上信息只在当前项目生效，不会修改全局账户资料。</p>{error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<button disabled={busy} className="primary-button w-full">{busy ? "保存中…" : "保存项目档案"}</button></form></Modal>;
}
function Registration({ command, expiresAt, close }: { command: string; expiresAt: string; close: () => void }) { const [copied, setCopied] = useState(false); return <Modal title="接入 Token 统计" close={close}><div className="space-y-4"><p className="text-sm leading-6 text-slate-600">在 Windows PowerShell 中执行以下命令。注册码10分钟内有效且只能使用一次，安装后每30分钟静默上报 Codex 与 Claude Code 的 Token 汇总。</p><div className="flex items-start gap-2 rounded-xl bg-slate-950 p-3 text-slate-100"><code className="min-w-0 flex-1 break-all text-xs leading-5">{command}</code><button onClick={async()=>{await navigator.clipboard.writeText(command);setCopied(true)}} className="rounded-lg bg-white/10 p-2">{copied?<Check size={16}/>:<Copy size={16}/>}</button></div><p className="text-xs text-slate-400">有效期至 {dateTime(expiresAt)}。不会上传提示词、代码、文件内容或密钥。</p></div></Modal>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"><button aria-label="关闭" className="absolute inset-0" onClick={close}/><section className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center"><h3 className="text-lg font-semibold">{title}</h3><button onClick={close} className="ml-auto text-slate-400"><X size={19}/></button></div>{children}</section></div>; }
