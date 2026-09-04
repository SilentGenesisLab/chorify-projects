"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Activity, Camera, Check, Clock3, LoaderCircle, Pencil, Target, UserRound, X } from "lucide-react";

type MemberList = { viewerUserId: string; members: Array<{ id: string; userId: string; name: string }> };
type Profile = {
  member: { id: string; userId: string; displayName: string; projectDisplayName: string | null; title: string | null; projectTitle: string | null; responsibility: string | null; projectResponsibility: string | null; bio: string | null; projectBio: string | null; avatarUrl: string | null; projectAvatarUrl: string | null; avatarColor: string; phone: string; roleLabel: string };
  project: { id: string; name: string; team: { id: string; name: string } | null };
  permissions: { canEdit: boolean; canViewDetails: boolean; isSelf: boolean };
};
type Statistics = {
  contribution: { requirementsProposed: number; requirementsClosed: number; averageRequirementHours: number | null; weeklyCompletedTasks: number; pendingAcceptance: number; currentTasks: Array<{ id: string; code: string; title: string; status: string; priority: string; dueAt: string | null }> };
};

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "请求失败");
  return body;
}
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
  const [profile, setProfile] = useState<Profile | null>(null), [stats, setStats] = useState<Statistics | null>(null), [editing, setEditing] = useState(false), [error, setError] = useState("");
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
    {editing && <EditProfile profile={profile} close={() => setEditing(false)} saved={async () => { setEditing(false); await load(); }} />}
  </div>;
  return close ? <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/35 p-4 backdrop-blur-sm"><button aria-label="关闭成员详情" className="fixed inset-0" onClick={close}/><section className="relative mx-auto my-5 max-w-5xl rounded-2xl bg-[#f7f9fc] p-5 shadow-2xl"><button onClick={close} className="absolute right-4 top-4 z-10 rounded-lg bg-white p-2 text-slate-400"><X size={18}/></button>{content}</section></div> : content;
}

function Info({ title, value }: { title: string; value: string }) { return <div><p className="text-xs text-slate-400">{title}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{value}</p></div>; }
function Metric({ label, value, icon: Icon }: { label: string; value: string | number; icon: typeof Target }) { return <div className="card p-4"><div className="flex items-center gap-2 text-slate-400"><Icon size={16}/><span className="text-xs">{label}</span></div><p className="mt-3 text-xl font-bold">{value}</p></div>; }

function EditProfile({ profile, close, saved }: { profile: Profile; close: () => void; saved: () => void }) {
  const [form, setForm] = useState({ displayName: profile.member.projectDisplayName || "", title: profile.member.projectTitle || "", responsibility: profile.member.projectResponsibility || "", bio: profile.member.projectBio || "", avatarUrl: profile.member.projectAvatarUrl || "" }), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  function set(key: keyof typeof form, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  function avatar(file?: File) { if (!file) return; if (file.size > 512 * 1024) return setError("头像不能超过 512KB"); const reader = new FileReader(); reader.onload = () => set("avatarUrl", String(reader.result)); reader.readAsDataURL(file); }
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); try { await json(`/api/projects/${profile.project.id}/members/${profile.member.id}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || null]))) }); saved(); } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); } finally { setBusy(false); } }
  return <Modal title="编辑项目成员档案" close={close}><form onSubmit={submit} className="space-y-4"><div className="flex items-center gap-3"><label className="secondary-button cursor-pointer"><Camera size={16}/>上传项目头像<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(event) => avatar(event.target.files?.[0])}/></label>{form.avatarUrl && <button type="button" onClick={() => set("avatarUrl", "")} className="text-sm text-slate-500">移除</button>}</div><Field label="项目内显示名"><input className="field" value={form.displayName} onChange={(event) => set("displayName", event.target.value)} maxLength={40}/></Field><Field label="项目岗位"><input className="field" value={form.title} onChange={(event) => set("title", event.target.value)} maxLength={80}/></Field><Field label="项目职责"><textarea className="field min-h-24" value={form.responsibility} onChange={(event) => set("responsibility", event.target.value)} maxLength={500}/></Field><Field label="个人介绍"><textarea className="field min-h-28" value={form.bio} onChange={(event) => set("bio", event.target.value)} maxLength={1000}/></Field><p className="text-xs text-slate-400">以上信息只在当前项目生效，不会修改全局账户资料。</p>{error && <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<button disabled={busy} className="primary-button w-full">{busy ? "保存中…" : "保存项目档案"}</button></form></Modal>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>; }
function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm"><button aria-label="关闭" className="absolute inset-0" onClick={close}/><section className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center"><h3 className="text-lg font-semibold">{title}</h3><button onClick={close} className="ml-auto text-slate-400"><X size={19}/></button></div>{children}</section></div>; }
