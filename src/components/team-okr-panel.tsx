"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Goal, LoaderCircle, Plus, Target, Users, X } from "lucide-react";
import { SelectField } from "@/components/ui/select-field";

type Team = {
  id: string;
  permissions: { canManage: boolean };
  members: Array<{ userId: string; name: string; avatarColor: string; role: string }>;
};
type Objective = {
  id: string;
  title: string;
  description: string;
  periodLabel: string;
  status: string;
  owner: { id: string; name: string; avatarColor: string };
  keyResults: Array<{
    id: string;
    title: string;
    targetValue: number;
    currentValue: number;
    unit: string;
    confidence: number;
    owner: { id: string; name: string };
    alignments: Array<{ user: { id: string; name: string } }>;
  }>;
};
type MemberSummary = {
  userId: string;
  name: string;
  avatarColor: string;
  objectiveCount: number;
  keyResultCount: number;
  avgProgress: number;
  atRisk: number;
};

const statusLabels: Record<string, string> = {
  DRAFT: "草稿",
  ACTIVE: "进行中",
  AT_RISK: "有风险",
  COMPLETED: "已完成",
  ARCHIVED: "已归档",
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "操作失败");
  return body;
}

export function TeamOkrPanel({ team }: { team: Team }) {
  const [objectives, setObjectives] = useState<Objective[]>([]),
    [members, setMembers] = useState<MemberSummary[]>([]),
    [memberId, setMemberId] = useState(""),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  const load = useCallback(() =>
    request<{ objectives: Objective[]; members: MemberSummary[] }>(
        `/api/teams/${team.id}/okrs?all=1${memberId ? `&memberId=${memberId}` : ""}`,
      ).then((data) => {
      setObjectives(data.objectives);
      setMembers(data.members);
      setError("");
    }).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : "加载 OKR 失败");
    }).finally(() => {
      setLoading(false);
    }), [memberId, team.id]);
  useEffect(() => { void load(); }, [load]);
  const selected = members.find((member) => member.userId === memberId);
  const summary = useMemo(() => ({
    objectives: objectives.length,
    keyResults: objectives.reduce((sum, objective) => sum + objective.keyResults.length, 0),
    atRisk: objectives.filter((objective) => objective.status === "AT_RISK").length,
  }), [objectives]);
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <h3 className="font-semibold">成员 OKR 总览</h3>
          <p className="mt-1 text-sm text-slate-500">查看团队目标，以及每位成员负责或参与的目标和关键结果</p>
        </div>
        <div className="flex gap-2 sm:ml-auto">
          <div className="min-w-48">
            <SelectField value={memberId} onChange={setMemberId} options={[{ value: "", label: "全部成员" }, ...members.map((member) => ({ value: member.userId, label: member.name, description: `${member.objectiveCount} 个目标` }))]} />
          </div>
          {team.permissions.canManage && <button onClick={() => setOpen(true)} className="primary-button"><Plus size={16} />新建 OKR</button>}
        </div>
      </div>
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[{ label: selected ? `${selected.name}的目标` : "团队目标", value: summary.objectives, icon: Goal }, { label: "关键结果", value: summary.keyResults, icon: Target }, { label: "风险目标", value: summary.atRisk, icon: AlertTriangle }].map((item) => <div key={item.label} className="card flex items-center gap-4 p-4"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><item.icon size={18} /></span><div><b className="text-2xl">{item.value}</b><p className="text-xs text-slate-500">{item.label}</p></div></div>)}
      </div>
      {!memberId && members.length > 0 && (
        <section className="card p-5">
          <div className="flex items-center gap-2"><Users size={18} className="text-slate-400" /><h4 className="font-semibold">成员情况</h4></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {members.map((member) => <button key={member.userId} onClick={() => setMemberId(member.userId)} className="rounded-xl border border-slate-100 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50/30"><div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: member.avatarColor }}>{member.name.slice(0, 1)}</span><div><b className="text-sm">{member.name}</b><p className="text-xs text-slate-400">{member.objectiveCount} 个目标 · {member.keyResultCount} 个 KR</p></div></div><div className="mt-4 flex items-center gap-3"><div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${member.avgProgress}%` }} /></div><b className="text-xs text-blue-600">{member.avgProgress}%</b></div>{member.atRisk > 0 && <p className="mt-2 text-xs text-amber-600">{member.atRisk} 个目标需要关注</p>}</button>)}
          </div>
        </section>
      )}
      {loading ? <div className="grid min-h-56 place-items-center"><LoaderCircle className="animate-spin text-blue-600" /></div> : (
        <div className="grid gap-4">
          {objectives.map((objective) => <section className="card p-5" key={objective.id}><div className="flex flex-wrap items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600"><Goal size={19} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-semibold">{objective.title}</h4><span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{objective.periodLabel}</span><span className={`rounded-full px-2 py-1 text-xs ${objective.status === "AT_RISK" ? "bg-amber-50 text-amber-700" : objective.status === "COMPLETED" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{statusLabels[objective.status] || objective.status}</span></div><p className="mt-1 text-sm text-slate-500">负责人 {objective.owner.name}{objective.description ? ` · ${objective.description}` : ""}</p></div></div><div className="mt-4 space-y-3">{objective.keyResults.map((result) => { const progress = Math.min(100, Math.round(result.currentValue / result.targetValue * 100)); return <div key={result.id} className="rounded-xl border border-slate-100 p-4"><div className="flex flex-wrap justify-between gap-2 text-sm"><span>{result.title}</span><b>{result.currentValue}/{result.targetValue} {result.unit}</b></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-slate-400">负责人 {result.owner.name} · 对齐 {result.alignments.map((item) => item.user.name).join("、") || "无"} · 信心 {result.confidence}%</p></div>; })}</div></section>)}
          {!objectives.length && <div className="card p-12 text-center text-sm text-slate-400">{selected ? `${selected.name} 暂无负责或参与的 OKR` : "当前团队暂无 OKR"}</div>}
        </div>
      )}
      {open && <CreateOkrDialog team={team} close={() => setOpen(false)} saved={async () => { setOpen(false); await load(); }} />}
    </div>
  );
}

function CreateOkrDialog({ team, close, saved }: { team: Team; close: () => void; saved: () => Promise<void> }) {
  const now = new Date(), quarter = Math.floor(now.getMonth() / 3) + 1;
  const formalMembers = team.members.filter((member) => member.role !== "GUEST");
  const [title, setTitle] = useState(""), [description, setDescription] = useState(""), [keyResult, setKeyResult] = useState(""), [target, setTarget] = useState(100), [unit, setUnit] = useState("%"), [ownerId, setOwnerId] = useState(formalMembers[0]?.userId || ""), [error, setError] = useState(""), [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const startsAt = new Date(now.getFullYear(), (quarter - 1) * 3, 1), endsAt = new Date(now.getFullYear(), quarter * 3, 0, 23, 59, 59);
    try { await request(`/api/teams/${team.id}/okrs`, { method: "POST", body: JSON.stringify({ title, description, periodType: "QUARTERLY", periodLabel: `${now.getFullYear()} Q${quarter}`, startsAt, endsAt, ownerId, status: "ACTIVE", keyResults: [{ title: keyResult, targetValue: target, currentValue: 0, unit, confidence: 70, ownerId, alignedUserIds: [] }] }) }); await saved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); setSaving(false); }
  }
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4"><div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"><div className="flex items-center"><h3 className="text-lg font-semibold">新建团队 OKR</h3><button onClick={close} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18} /></button></div><form onSubmit={submit} className="mt-5 space-y-4"><label className="block"><span className="mb-2 block text-sm font-medium">目标</span><input className="field" value={title} onChange={(event) => setTitle(event.target.value)} required /></label><label className="block"><span className="mb-2 block text-sm font-medium">目标说明</span><textarea className="form-input min-h-20" value={description} onChange={(event) => setDescription(event.target.value)} /></label><label className="block"><span className="mb-2 block text-sm font-medium">关键结果</span><input className="field" value={keyResult} onChange={(event) => setKeyResult(event.target.value)} required /></label><div className="grid grid-cols-2 gap-3"><label><span className="mb-2 block text-sm font-medium">目标值</span><input className="field" type="number" step="any" value={target} onChange={(event) => setTarget(Number(event.target.value))} /><span className="mt-1 block text-xs text-slate-400">支持整数或小数，建议优先使用整数</span></label><label><span className="mb-2 block text-sm font-medium">单位</span><input className="field" value={unit} onChange={(event) => setUnit(event.target.value)} /></label></div><label className="block"><span className="mb-2 block text-sm font-medium">负责人</span><SelectField value={ownerId} onChange={setOwnerId} options={formalMembers.map((member) => ({ value: member.userId, label: member.name }))} /></label>{error && <p className="text-sm text-rose-600">{error}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={close} className="secondary-button">取消</button><button disabled={saving} className="primary-button">{saving && <LoaderCircle size={16} className="animate-spin" />}创建</button></div></form></div></div>;
}
