"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  ExternalLink,
  GitBranch,
  GitCommitHorizontal,
  LoaderCircle,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Server,
  Settings2,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";
import { SelectField } from "@/components/ui/select-field";

type Item = Record<string, unknown> & { id: string };
type Step = { id: string; key: string; name: string; status: string; logsUrl?: string | null };
type Run = Item & {
  status: string;
  type: string;
  queuedAt: string;
  finishedAt?: string | null;
  failureReason?: string | null;
  githubRunUrl?: string | null;
  initiatedBy: { id: string; name: string };
  version: { id: string; name: string };
  environment: Environment;
  steps: Step[];
  artifacts: Array<{ id: string; commitSha: string; imageRef: string; imageDigest?: string | null; service: { name: string; slug: string } }>;
};
type Service = { id: string; name: string; slug: string; healthPath: string; repository: { id: string; fullName: string; defaultBranch: string } };
type Environment = { id: string; projectId: string; name: string; slug: string; kind: string; url: string; healthStatus: string; lastCheckedAt?: string | null; activeSlot?: string | null; uptime24h?: number | null; uptime7d?: number | null; recentChecks?: Array<{ id: string; status: string; latencyMs?: number | null }> };
type Version = Item & { name: string; status: string; goal: string; plannedAt?: string | null; components: Array<{ id: string; commitSha: string; branch?: string | null; service: { id: string; name: string; slug: string } }>; _count: { requirements: number; tasks: number; fixedBugs: number } };
type Release = Item & { build: string; environment: string; status: string; releasedAt?: string | null; isLegacy: boolean; version: { name: string }; deploymentRunId?: string | null; imageSummary?: Record<string, { ref: string; digest: string }> | null };
type CenterData = { currentUserId: string; repositories: Item[]; services: Service[]; environments: Environment[]; versions: Version[]; runs: Run[]; releases: Release[]; permissions: { canDeploy: boolean; canConfigure: boolean }; activeStatuses: string[] };

const labels: Record<string, string> = {
  PLANNING: "规划中", DEVELOPING: "开发中", TESTING: "测试中", PENDING_RELEASE: "待发布", RELEASED: "已发布", ARCHIVED: "已归档", CANCELLED: "已取消",
  QUEUED: "排队中", WAITING_APPROVAL: "待审批", DISPATCHED: "已触发", BUILDING: "构建中", DEPLOYING: "部署中", VERIFYING: "验证中", SUCCEEDED: "发布成功", FAILED: "失败", ROLLED_BACK: "已回滚", CANCELLED_RUN: "已取消",
  HEALTHY: "在线", DEGRADED: "波动", DOWN: "异常", UNKNOWN: "未检测", STAGING: "预发布", PRODUCTION: "生产",
  PENDING: "等待", RUNNING: "执行中", SKIPPED: "已跳过", APPROVED: "已通过",
};
const active = new Set(["QUEUED", "DISPATCHED", "BUILDING", "DEPLOYING", "VERIFYING"]);
const fmt = (value?: string | null) => value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const shortSha = (value?: string | null) => value ? value.slice(0, 8) : "未锁定";

export function DeploymentCenter({ projectId, onNewVersion, onEditVersion, refreshKey = 0 }: { projectId: string; onNewVersion: () => void; onEditVersion: (version: Version) => void; refreshKey?: number }) {
  const [data, setData] = useState<CenterData | null>(null);
  const [tab, setTab] = useState<"versions" | "pipeline" | "releases" | "environments">("versions");
  const [error, setError] = useState("");
  const [releaseVersion, setReleaseVersion] = useState<Version | null>(null);
  const [configOpen, setConfigOpen] = useState(false);
  const load = useCallback(async (quiet = false) => {
    const response = await fetch(`/api/projects/${projectId}/deployment-center`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { if (!quiet) setError(body.error || "加载发布中心失败"); return; }
    setData(body); setError("");
  }, [projectId]);
  useEffect(() => { void Promise.resolve().then(() => load()); }, [load, refreshKey]);
  useEffect(() => {
    if (!data?.runs.some((run) => active.has(run.status))) return;
    const timer = setInterval(() => void load(true), 5000);
    return () => clearInterval(timer);
  }, [data?.runs, load]);
  if (!data) return <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-blue-600" /></div>;
  const tabs = [
    ["versions", "版本管理", GitBranch], ["pipeline", "流水线", Activity], ["releases", "发布记录", ShieldCheck], ["environments", "环境状态", Server],
  ] as const;
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><h3 className="text-xl font-bold">版本与发布</h3><p className="mt-1 text-sm text-slate-500">锁定代码制品，通过 GitHub Actions 蓝绿发布并持续验证服务状态</p></div>
      <div className="flex gap-2">{data.permissions.canConfigure && <button onClick={() => setConfigOpen(true)} className="secondary-button"><Settings2 size={16}/>CI/CD 配置</button>}<button onClick={onNewVersion} className="primary-button">+ 新建版本</button></div>
    </div>
    <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map(([id, name, Icon]) => <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm ${tab === id ? "bg-blue-50 font-medium text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><Icon size={15}/>{name}</button>)}
    </div>
    {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
    {!data.repositories.length && <SetupNotice onOpen={() => setConfigOpen(true)} />}
    {tab === "versions" && (
      <VersionPanel data={data} onEdit={onEditVersion} onRelease={setReleaseVersion}/>
    )}
    {tab === "pipeline" && <PipelinePanel data={data} reload={load}/>}
    {tab === "releases" && <ReleasePanel data={data} reload={load}/>}
    {tab === "environments" && (
      <EnvironmentPanel projectId={projectId} data={data} reload={load}/>
    )}
    {releaseVersion && (
      <ReleaseDialog
        projectId={projectId}
        version={releaseVersion}
        data={data}
        onClose={() => setReleaseVersion(null)}
        onSaved={async () => {
          setReleaseVersion(null);
          setTab("pipeline");
          await load();
        }}
      />
    )}
    {configOpen && (
      <ConfigDialog
        projectId={projectId}
        onClose={() => setConfigOpen(false)}
        onSaved={async () => {
          setConfigOpen(false);
          await load();
        }}
      />
    )}
  </div>;
}

function SetupNotice({ onOpen }: { onOpen: () => void }) {
  return <div className="flex flex-col gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-5 sm:flex-row sm:items-center"><div className="grid size-10 place-items-center rounded-xl bg-white text-blue-600"><GitBranch size={18}/></div><div className="flex-1"><p className="font-medium text-slate-800">尚未连接代码仓库和部署环境</p><p className="mt-1 text-xs text-slate-500">完成 GitHub App、服务和环境配置后即可从这里一键发布。</p></div><button onClick={onOpen} className="secondary-button">开始配置</button></div>;
}

function VersionPanel({ data, onEdit, onRelease }: { data: CenterData; onEdit: (version: Version) => void; onRelease: (version: Version) => void }) {
  if (!data.versions.length) return <Empty text="尚未创建业务版本"/>;
  return <section className="space-y-3">{data.versions.map((version) => <div key={version.id} className="card p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><GitBranch size={19}/></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h4 className="font-semibold">{version.name}</h4><Status value={version.status}/></div><p className="mt-1 truncate text-sm text-slate-500">{version.goal}</p><div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400"><span>{version._count.requirements} 需求</span><span>{version._count.tasks} 任务</span><span>{version._count.fixedBugs} Bug</span><span>{version.components.length}/{data.services.length} 服务已锁定</span><span>计划 {fmt(version.plannedAt)}</span></div></div><div className="flex items-center gap-2">{data.permissions.canDeploy && <button onClick={() => onRelease(version)} disabled={!data.services.length || !data.environments.length} className="primary-button disabled:cursor-not-allowed disabled:opacity-40"><Play size={15}/>{version.components.length ? "发布" : "锁定并发布"}</button>}<button onClick={() => onEdit(version)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-blue-600"><Pencil size={16}/></button><ChevronRight size={17} className="text-slate-300"/></div></div></div>)}</section>;
}

function PipelinePanel({ data, reload }: { data: CenterData; reload: (quiet?: boolean) => Promise<void> }) {
  if (!data.runs.length) return <Empty text="还没有流水线运行记录"/>;
  return <div className="space-y-3">{data.runs.map((run) => <section key={run.id} className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><RunIcon status={run.status}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium">{run.type === "ROLLBACK" ? "回滚" : "发布"} {run.version.name}</h4><Status value={run.status}/><span className="text-xs text-slate-400">{run.environment.name}</span></div><p className="mt-1 text-xs text-slate-400">{run.initiatedBy.name} · {fmt(run.queuedAt)}{run.artifacts[0] ? ` · ${shortSha(run.artifacts[0].commitSha)}` : ""}</p></div>{run.status === "WAITING_APPROVAL" && data.permissions.canDeploy && (run.initiatedBy.id === data.currentUserId ? <span className="text-xs text-amber-600">等待另一位管理员审批</span> : <button onClick={() => void approve(data, run, reload)} className="primary-button"><ShieldCheck size={15}/>审批发布</button>)}{run.githubRunUrl && <a href={run.githubRunUrl} target="_blank" rel="noreferrer" className="secondary-button">Actions <ExternalLink size={14}/></a>}</div><div className="grid gap-2 p-4 sm:grid-cols-4 lg:grid-cols-8">{run.steps.length ? run.steps.map((step) => <div key={step.id} className="rounded-xl bg-slate-50 p-3"><div className="flex items-center gap-2"><StepIcon status={step.status}/><span className="text-xs font-medium">{step.name}</span></div><p className="mt-2 text-[11px] text-slate-400">{labels[step.status] || step.status}</p></div>) : <p className="col-span-full text-sm text-slate-400">{run.status === "WAITING_APPROVAL" ? "审批通过后开始执行" : "正在等待 GitHub Actions 接收任务"}</p>}</div>{run.failureReason && <div className="border-t border-rose-100 bg-rose-50 px-4 py-3 text-xs text-rose-700">{run.failureReason}</div>}</section>)}</div>;
}

async function approve(data: CenterData, run: Run, reload: (quiet?: boolean) => Promise<void>) {
  if (run.initiatedBy.id === data.currentUserId) return;
  const response = await fetch(`/api/projects/${run.environment.projectId || ""}/deployments/${run.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment: "已核对发布清单，同意发布" }) });
  if (!response.ok) alert((await response.json()).error || "审批失败");
  await reload();
}

function ReleasePanel({ data, reload }: { data: CenterData; reload: (quiet?: boolean) => Promise<void> }) {
  if (!data.releases.length) return <Empty text="还没有正式发布记录"/>;
  return <section className="card divide-y divide-slate-100 overflow-hidden">{data.releases.map((release) => <div key={release.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><ShieldCheck size={18} className={release.status === "SUCCEEDED" ? "text-emerald-600" : "text-slate-400"}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium">{release.version.name} · {release.environment}</p><Status value={release.status}/>{release.isLegacy && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">历史人工记录</span>}</div><p className="mt-1 text-xs text-slate-400">构建 {release.build} · {fmt(release.releasedAt)}</p></div>{data.permissions.canDeploy && release.status === "SUCCEEDED" && release.deploymentRunId && <button onClick={() => void rollback(release, data, reload)} className="secondary-button"><RotateCcw size={14}/>回滚到此版本</button>}</div>)}</section>;
}

async function rollback(release: Release, data: CenterData, reload: (quiet?: boolean) => Promise<void>) {
  const environment = data.environments.find((item) => item.name === release.environment);
  if (!release.deploymentRunId || !environment || !confirm(`确定将“${environment.name}”回滚到 ${release.version.name}？`)) return;
  const response = await fetch(`/api/projects/${environment.projectId || ""}/deployments/${release.deploymentRunId}/rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ environmentId: environment.id }) });
  if (!response.ok) alert((await response.json()).error || "回滚发起失败");
  await reload();
}

function EnvironmentPanel({ projectId, data, reload }: { projectId: string; data: CenterData; reload: (quiet?: boolean) => Promise<void> }) {
  if (!data.environments.length) return <Empty text="尚未配置部署环境"/>;
  return <div className="grid gap-4 lg:grid-cols-2">{data.environments.map((environment) => <section key={environment.id} className="card p-5"><div className="flex items-center"><div className="grid size-10 place-items-center rounded-xl bg-slate-50 text-slate-600"><Server size={18}/></div><div className="ml-3"><div className="flex items-center gap-2"><h4 className="font-semibold">{environment.name}</h4><Status value={environment.kind}/></div><a href={environment.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-blue-600">{environment.url}</a></div><div className="ml-auto text-right"><Status value={environment.healthStatus}/><p className="mt-1 text-[11px] text-slate-400">{fmt(environment.lastCheckedAt)}</p></div></div><div className="mt-5 grid grid-cols-3 rounded-xl bg-slate-50 py-3 text-center"><Metric label="24小时可用率" value={environment.uptime24h == null ? "—" : `${environment.uptime24h}%`}/><Metric label="7天可用率" value={environment.uptime7d == null ? "—" : `${environment.uptime7d}%`}/><Metric label="活动实例" value={environment.activeSlot || "—"}/></div><div className="mt-4 flex items-center gap-1">{(environment.recentChecks || []).slice(0, 24).reverse().map((check) => <span key={check.id} title={`${labels[check.status] || check.status}${check.latencyMs ? ` · ${check.latencyMs}ms` : ""}`} className={`h-7 min-w-1 flex-1 rounded-sm ${check.status === "HEALTHY" ? "bg-emerald-400" : check.status === "DOWN" ? "bg-rose-400" : "bg-amber-300"}`}/>)}{!environment.recentChecks?.length && <p className="text-xs text-slate-400">执行检测后显示健康趋势</p>}</div><button onClick={async () => { await fetch(`/api/projects/${projectId}/environments/${environment.id}/check`, { method: "POST" }); await reload(); }} className="secondary-button mt-4"><RefreshCw size={14}/>立即检测</button></section>)}</div>;
}

function ReleaseDialog({ projectId, version, data, onClose, onSaved }: { projectId: string; version: Version; data: CenterData; onClose: () => void; onSaved: () => void }) {
  const [environmentId, setEnvironmentId] = useState(data.environments[0]?.id || "");
  const [commits, setCommits] = useState<Record<string, string>>(() => Object.fromEntries(data.services.map((service) => [service.id, version.components.find((item) => item.service.id === service.id)?.commitSha || ""])));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const environment = data.environments.find((item) => item.id === environmentId);
  async function resolve(service: Service) {
    const response = await fetch(`/api/projects/${projectId}/repositories/${service.repository.id}/resolve?ref=${encodeURIComponent(service.repository.defaultBranch)}`);
    const body = await response.json();
    if (!response.ok) return setError(body.error || "获取 commit 失败");
    setCommits((value) => ({ ...value, [service.id]: body.sha }));
  }
  async function submit() {
    setSaving(true); setError("");
    const response = await fetch(`/api/projects/${projectId}/deployments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ versionId: version.id, environmentId, migrationRisk: "NONE", components: data.services.map((service) => ({ serviceId: service.id, commitSha: commits[service.id], branch: service.repository.defaultBranch })) }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) return setError(body.error || "发布失败");
    onSaved();
  }
  return <Modal title={`发布 ${version.name}`} subtitle="发布内容会锁定到精确 commit，执行后不可修改" onClose={onClose}><div className="space-y-5"><SelectField label="目标环境" value={environmentId} onChange={setEnvironmentId} options={data.environments.map((item) => ({ value: item.id, label: `${item.name} · ${labels[item.kind]}` }))}/><div><p className="mb-2 text-sm font-medium">服务与代码版本</p><div className="space-y-3">{data.services.map((service) => <label key={service.id} className="block rounded-xl border border-slate-200 p-3"><span className="flex items-center justify-between text-xs text-slate-500"><span>{service.name} · {service.repository.fullName}</span><button type="button" onClick={() => void resolve(service)} className="text-blue-600 hover:text-blue-700">获取 {service.repository.defaultBranch} 最新提交</button></span><div className="mt-2 flex items-center gap-2"><GitCommitHorizontal size={15} className="text-slate-400"/><input value={commits[service.id] || ""} onChange={(event) => setCommits((value) => ({ ...value, [service.id]: event.target.value.trim() }))} placeholder="完整40位 commit SHA" className="min-w-0 flex-1 bg-transparent font-mono text-sm outline-none"/></div></label>)}</div></div>{environment?.kind === "PRODUCTION" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">生产发布提交后需要另一位项目管理员审批，发起人不能自审。</div>}{error && <p className="text-sm text-rose-600">{error}</p>}<div className="flex justify-end gap-2"><button onClick={onClose} className="secondary-button">取消</button><button onClick={() => void submit()} disabled={saving || !environmentId || data.services.some((service) => !/^[a-f0-9]{40}$/i.test(commits[service.id] || ""))} className="primary-button disabled:opacity-40">{saving ? <LoaderCircle size={15} className="animate-spin"/> : <Play size={15}/>} {environment?.kind === "PRODUCTION" ? "提交审批" : "确认发布"}</button></div></div></Modal>;
}

function ConfigDialog({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ installationId: "", owner: "SilentGenesisLab", repository: "chorify-projects", branch: "uat", serviceName: "Web 应用", serviceSlug: "web", environmentName: "预发布", environmentSlug: "staging", environmentUrl: "https://aipms.sligenai.cn", githubEnvironment: "staging" });
  const [error, setError] = useState(""), [saving, setSaving] = useState(false);
  const field = (key: keyof typeof form, label: string) => <label className="block"><span className="mb-1.5 block text-xs text-slate-500">{label}</span><input value={form[key]} onChange={(event) => setForm((value) => ({ ...value, [key]: event.target.value }))} className="input-field w-full"/></label>;
  async function submit() {
    setSaving(true); setError("");
    const response = await fetch(`/api/projects/${projectId}/deployment-config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ repository: { installationId: form.installationId, owner: form.owner, name: form.repository, defaultBranch: form.branch, workflowPath: "chorify-deploy.yml" }, service: { name: form.serviceName, slug: form.serviceSlug, kind: "WEB", dockerfilePath: "Dockerfile", buildContext: ".", healthPath: "/api/health", internalPort: 3000 }, environment: { name: form.environmentName, slug: form.environmentSlug, kind: form.environmentSlug === "production" ? "PRODUCTION" : "STAGING", url: form.environmentUrl, githubEnvironment: form.githubEnvironment, healthPath: "/api/health" } }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) return setError(body.error || "保存配置失败");
    onSaved();
  }
  return <Modal title="CI/CD 配置" subtitle="平台仅保存非敏感配置；SSH与运行密钥保存在 GitHub Environment" onClose={onClose}><div className="grid gap-4 sm:grid-cols-2">{field("installationId", "GitHub App Installation ID")}{field("owner", "GitHub 组织")}{field("repository", "仓库名称")}{field("branch", "候选分支")}{field("serviceName", "服务名称")}{field("serviceSlug", "服务标识")}{field("environmentName", "环境名称")}{field("environmentSlug", "环境标识")}{field("environmentUrl", "环境域名")}{field("githubEnvironment", "GitHub Environment")}</div>{error && <p className="mt-4 text-sm text-rose-600">{error}</p>}<div className="mt-5 flex justify-end gap-2"><button onClick={onClose} className="secondary-button">取消</button><button onClick={() => void submit()} disabled={saving} className="primary-button">{saving && <LoaderCircle size={15} className="animate-spin"/>}保存配置</button></div></Modal>;
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/25 p-4 backdrop-blur-sm"><div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"><div className="sticky top-0 z-10 flex items-start border-b border-slate-100 bg-white px-5 py-4"><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div><button onClick={onClose} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18}/></button></div><div className="p-5">{children}</div></div></div>; }
function Status({ value }: { value: string }) { const tone = value === "HEALTHY" || value === "SUCCEEDED" || value === "RELEASED" ? "bg-emerald-50 text-emerald-700" : value === "FAILED" || value === "DOWN" ? "bg-rose-50 text-rose-700" : value === "WAITING_APPROVAL" || value === "DEGRADED" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"; return <span className={`rounded-full px-2 py-1 text-[11px] ${tone}`}>{labels[value] || value}</span>; }
function RunIcon({ status }: { status: string }) { return <span className={`grid size-9 place-items-center rounded-xl ${status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-600" : status === "FAILED" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}>{status === "SUCCEEDED" ? <CheckCircle2 size={17}/> : status === "FAILED" ? <XCircle size={17}/> : active.has(status) ? <LoaderCircle size={17} className="animate-spin"/> : <Clock3 size={17}/>}</span>; }
function StepIcon({ status }: { status: string }) { return status === "SUCCEEDED" ? <CheckCircle2 size={14} className="text-emerald-600"/> : status === "FAILED" ? <XCircle size={14} className="text-rose-600"/> : status === "RUNNING" ? <LoaderCircle size={14} className="animate-spin text-blue-600"/> : <CircleDashed size={14} className="text-slate-300"/>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><strong className="text-sm">{value}</strong><p className="mt-1 text-[11px] text-slate-400">{label}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="card grid min-h-52 place-items-center text-sm text-slate-400">{text}</div>; }
