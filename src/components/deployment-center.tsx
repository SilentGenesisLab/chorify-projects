"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Activity,
  AlertTriangle,
  BellRing,
  BookOpen,
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
  failureStepKey?: string | null;
  failureDetails?: { failedStepName?: string | null; annotation?: string | null; exitCode?: number | null } | null;
  githubRunUrl?: string | null;
  initiatedBy: { id: string; name: string };
  version: { id: string; name: string };
  environment: Environment;
  steps: Step[];
  artifacts: Array<{ id: string; commitSha: string; imageRef: string; imageDigest?: string | null; service: { name: string; slug: string } }>;
};
type Service = { id: string; name: string; slug: string; healthPath: string; repository: { id: string; fullName: string; defaultBranch: string } };
type Environment = { id: string; projectId: string; name: string; slug: string; kind: string; url: string; enabled?: boolean; healthStatus: string; lastCheckedAt?: string | null; activeSlot?: string | null; uptime24h?: number | null; uptime7d?: number | null; recentChecks?: Array<{ id: string; status: string; latencyMs?: number | null }> };
type Version = Item & { name: string; status: string; goal: string; plannedAt?: string | null; components: Array<{ id: string; commitSha: string; branch?: string | null; service: { id: string; name: string; slug: string } }>; _count: { requirements: number; tasks: number; fixedBugs: number } };
type Release = Item & { build: string; environment: string; status: string; releasedAt?: string | null; isLegacy: boolean; version: { name: string }; deploymentRunId?: string | null; imageSummary?: Record<string, { ref: string; digest: string }> | null };
type CenterData = { currentUserId: string; repositories: Item[]; services: Service[]; environments: Environment[]; versions: Version[]; runs: Run[]; releases: Release[]; permissions: { canDeploy: boolean; canConfigure: boolean }; activeStatuses: string[] };
type ConfigData = { repositories: Array<Record<string, unknown> & { id: string; owner: string; name: string; installationId: string; defaultBranch: string; workflowPath: string; status: string; lastError?: string | null }>; services: Array<Record<string, unknown> & { id: string; repositoryId: string; name: string; slug: string; kind: string; dockerfilePath: string; buildContext: string; healthPath: string; internalPort: number; enabled: boolean; repository: { id: string; fullName: string } }>; environments: Array<Environment & { githubEnvironment: string; healthPath: string; enabled: boolean }>; readiness: Array<{ id: string; title: string; status: string; detail: string }>; guideMarkdown: string; requiredSecrets: string[]; feishu: { configured: boolean; enabled: boolean; notifyDeploymentSucceeded: boolean; lastTestedAt?: string | null; lastTestStatus?: string | null; lastError?: string | null }; permissions: { canConfigure: boolean } };
type Notify = (text: string, tone?: "success" | "error" | "info") => void;

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
  const [notice, setNotice] = useState<{ text: string; tone: "success" | "error" | "info" } | null>(null);
  const seenFailures = useRef<Set<string> | null>(null);
  const notify: Notify = (text, tone = "info") => { setNotice({ text, tone }); window.setTimeout(() => setNotice(null), 5000); };
  const load = useCallback(async (quiet = false) => {
    const response = await fetch(`/api/projects/${projectId}/deployment-center`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) { if (!quiet) setError(body.error || "加载发布中心失败"); return; }
    const next = body as CenterData;
    const failedIds = new Set(next.runs.filter((run) => run.status === "FAILED").map((run) => run.id));
    if (seenFailures.current) {
      const fresh = next.runs.find((run) => run.status === "FAILED" && !seenFailures.current?.has(run.id));
      if (fresh) setNotice({ text: `${fresh.version.name} 发布失败：${fresh.failureReason || "请查看流水线详情"}`, tone: "error" });
    }
    seenFailures.current = failedIds;
    setData(next); setError("");
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
    {notice && <div role={notice.tone === "error" ? "alert" : "status"} className={`fixed right-6 top-6 z-[80] max-w-md rounded-xl border px-4 py-3 text-sm shadow-xl ${notice.tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : notice.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{notice.text}</div>}
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
    {tab === "pipeline" && <PipelinePanel data={data} reload={load} notify={notify}/>}
    {tab === "releases" && <ReleasePanel data={data} reload={load} notify={notify}/>}
    {tab === "environments" && (
      <EnvironmentPanel projectId={projectId} data={data} reload={load} notify={notify} onConfigure={() => setConfigOpen(true)}/>
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
          await load(); notify("发布任务已创建", "success");
        }}
      />
    )}
    {configOpen && (
      <ConfigDialog
        projectId={projectId}
        notify={notify}
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

function PipelinePanel({ data, reload, notify }: { data: CenterData; reload: (quiet?: boolean) => Promise<void>; notify: Notify }) {
  const [detailId, setDetailId] = useState<string | null>(null);
  if (!data.runs.length) return <Empty text="还没有流水线运行记录"/>;
  async function retry(run: Run) {
    const response = await fetch(`/api/projects/${run.environment.projectId}/deployments/${run.id}/retry`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) return notify(body.error || "重新执行失败", "error");
    notify(run.environment.kind === "PRODUCTION" ? "重试任务已提交审批" : "重试任务已创建", "success");
    await reload();
  }
  return <div className="space-y-3">{data.runs.map((run) => <section key={run.id} className={`card overflow-hidden ${run.status === "FAILED" ? "border-rose-200" : ""}`}>
    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><RunIcon status={run.status}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h4 className="font-medium">{run.type === "ROLLBACK" ? "回滚" : "发布"} {run.version.name}</h4><Status value={run.status}/><span className="text-xs text-slate-400">{run.environment.name}</span></div><p className="mt-1 text-xs text-slate-400">{run.initiatedBy.name} · {fmt(run.queuedAt)}{run.artifacts[0] ? ` · ${shortSha(run.artifacts[0].commitSha)}` : ""}</p></div>{run.status === "WAITING_APPROVAL" && data.permissions.canDeploy && (run.initiatedBy.id === data.currentUserId ? <span className="text-xs text-amber-600">等待另一位管理员审批</span> : <button onClick={() => void approve(data, run, reload, notify)} className="primary-button"><ShieldCheck size={15}/>审批发布</button>)}{run.githubRunUrl && <a href={run.githubRunUrl} target="_blank" rel="noreferrer" className="secondary-button">Actions <ExternalLink size={14}/></a>}</div>
    <div className="grid gap-2 p-4 sm:grid-cols-5 lg:grid-cols-10">{run.steps.length ? run.steps.map((step) => <div key={step.id} className={`rounded-xl p-3 ${step.status === "FAILED" ? "bg-rose-50 ring-1 ring-rose-100" : "bg-slate-50"}`}><div className="flex items-center gap-2"><StepIcon status={step.status}/><span className="text-xs font-medium">{step.name}</span></div><p className="mt-2 text-[11px] text-slate-400">{labels[step.status] || step.status}</p></div>) : <p className="col-span-full text-sm text-slate-400">{run.status === "WAITING_APPROVAL" ? "审批通过后开始执行" : "正在等待 GitHub Actions 接收任务"}</p>}</div>
    {run.failureReason && <div className="border-t border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><AlertTriangle size={17} className="shrink-0"/><div className="flex-1"><b>{run.failureReason}</b><p className="mt-1 text-xs text-rose-600">{run.failureDetails?.annotation || "流水线没有返回更多诊断信息，请查看 GitHub Actions 日志。"}</p></div><button onClick={() => setDetailId(detailId === run.id ? null : run.id)} className="secondary-button">{detailId === run.id ? "收起详情" : "排查详情"}</button>{data.permissions.canDeploy && run.type === "DEPLOY" && <button onClick={() => void retry(run)} className="secondary-button"><RefreshCw size={14}/>按原提交重试</button>}</div>{detailId === run.id && <div className="mt-3 rounded-xl border border-rose-100 bg-white/70 p-3 text-xs leading-6 text-slate-600"><p>失败阶段：{run.failureStepKey ? run.steps.find((step) => step.key === run.failureStepKey)?.name || run.failureStepKey : "未识别"}</p><p>错误码：{run.failureDetails?.exitCode ?? "—"}</p><p>完成时间：{fmt(run.finishedAt)}</p>{run.githubRunUrl && <a href={run.githubRunUrl} target="_blank" rel="noreferrer" className="font-medium text-blue-600">打开完整 Actions 日志</a>}</div>}</div>}
  </section>)}</div>;
}

async function approve(data: CenterData, run: Run, reload: (quiet?: boolean) => Promise<void>, notify: Notify) {
  if (run.initiatedBy.id === data.currentUserId) return;
  const response = await fetch(`/api/projects/${run.environment.projectId || ""}/deployments/${run.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ comment: "已核对发布清单，同意发布" }) });
  if (!response.ok) return notify((await response.json()).error || "审批失败", "error");
  notify("审批已提交", "success");
  await reload();
}

function ReleasePanel({ data, reload, notify }: { data: CenterData; reload: (quiet?: boolean) => Promise<void>; notify: Notify }) {
  if (!data.releases.length) return <Empty text="还没有正式发布记录"/>;
  return <section className="card divide-y divide-slate-100 overflow-hidden">{data.releases.map((release) => <div key={release.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><ShieldCheck size={18} className={release.status === "SUCCEEDED" ? "text-emerald-600" : "text-slate-400"}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="text-sm font-medium">{release.version.name} · {release.environment}</p><Status value={release.status}/>{release.isLegacy && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">历史人工记录</span>}</div><p className="mt-1 text-xs text-slate-400">构建 {release.build} · {fmt(release.releasedAt)}</p></div>{data.permissions.canDeploy && release.status === "SUCCEEDED" && release.deploymentRunId && <button onClick={() => void rollback(release, data, reload, notify)} className="secondary-button"><RotateCcw size={14}/>回滚到此版本</button>}</div>)}</section>;
}

async function rollback(release: Release, data: CenterData, reload: (quiet?: boolean) => Promise<void>, notify: Notify) {
  const environment = data.environments.find((item) => item.name === release.environment);
  if (!release.deploymentRunId || !environment || !confirm(`确定将“${environment.name}”回滚到 ${release.version.name}？`)) return;
  const response = await fetch(`/api/projects/${environment.projectId || ""}/deployments/${release.deploymentRunId}/rollback`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ environmentId: environment.id }) });
  if (!response.ok) return notify((await response.json()).error || "回滚发起失败", "error");
  notify("回滚任务已创建", "success");
  await reload();
}

function EnvironmentPanel({ projectId, data, reload, notify, onConfigure }: { projectId: string; data: CenterData; reload: (quiet?: boolean) => Promise<void>; notify: Notify; onConfigure: () => void }) {
  async function check(environment: Environment) {
    const response = await fetch(`/api/projects/${projectId}/environments/${environment.id}/check`, { method: "POST" });
    const body = await response.json();
    if (!response.ok) return notify(body.error || "环境检测失败", "error");
    notify(body.status === "HEALTHY" ? `${environment.name}健康检查通过` : `${environment.name}健康检查异常`, body.status === "HEALTHY" ? "success" : "error");
    await reload();
  }
  return <div className="grid gap-4 lg:grid-cols-2">{(["STAGING", "PRODUCTION"] as const).map((kind) => {
    const environments = data.environments.filter((item) => item.kind === kind);
    if (!environments.length) return <section key={kind} className="card grid min-h-64 place-items-center p-6 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-50 text-slate-400"><Server size={20}/></span><h4 className="mt-3 font-semibold">{kind === "PRODUCTION" ? "生产环境未配置" : "预发布环境未配置"}</h4><p className="mt-1 text-sm text-slate-400">在 CI/CD 配置中心补充服务器、域名与 GitHub Environment。</p>{data.permissions.canConfigure && <button onClick={onConfigure} className="secondary-button mt-4">前往配置</button>}</div></section>;
    return <div key={kind} className="space-y-4">{environments.map((environment) => <section key={environment.id} className={`card p-5 ${"enabled" in environment && !environment.enabled ? "opacity-60" : ""}`}><div className="flex items-center"><div className="grid size-10 place-items-center rounded-xl bg-slate-50 text-slate-600"><Server size={18}/></div><div className="ml-3"><div className="flex items-center gap-2"><h4 className="font-semibold">{environment.name}</h4><Status value={environment.kind}/></div><a href={environment.url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-blue-600">{environment.url}</a></div><div className="ml-auto text-right"><Status value={environment.healthStatus}/><p className="mt-1 text-[11px] text-slate-400">{fmt(environment.lastCheckedAt)}</p></div></div><div className="mt-5 grid grid-cols-3 rounded-xl bg-slate-50 py-3 text-center"><Metric label="24小时可用率" value={environment.uptime24h == null ? "—" : `${environment.uptime24h}%`}/><Metric label="7天可用率" value={environment.uptime7d == null ? "—" : `${environment.uptime7d}%`}/><Metric label="活动实例" value={environment.activeSlot || "—"}/></div><div className="mt-4 flex items-center gap-1">{(environment.recentChecks || []).slice(0, 24).reverse().map((item) => <span key={item.id} title={`${labels[item.status] || item.status}${item.latencyMs ? ` · ${item.latencyMs}ms` : ""}`} className={`h-7 min-w-1 flex-1 rounded-sm ${item.status === "HEALTHY" ? "bg-emerald-400" : item.status === "DOWN" ? "bg-rose-400" : "bg-amber-300"}`}/>)}{!environment.recentChecks?.length && <p className="text-xs text-slate-400">执行检测后显示健康趋势</p>}</div><div className="mt-4 flex gap-2"><button onClick={() => void check(environment)} className="secondary-button"><RefreshCw size={14}/>立即检测</button>{data.permissions.canConfigure && <button onClick={onConfigure} className="secondary-button"><Settings2 size={14}/>编辑环境</button>}</div></section>)}</div>;
  })}</div>;
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

function ConfigDialog({ projectId, notify, onClose, onSaved }: { projectId: string; notify: Notify; onClose: () => void; onSaved: () => void }) {
  type Tab = "overview" | "resources" | "environments" | "guide" | "feishu";
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<ConfigData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resourceForm, setResourceForm] = useState({ installationId: "", owner: "SilentGenesisLab", repository: "chorify-projects", branch: "uat", workflowPath: "chorify-deploy.yml", repositoryStatus: "ACTIVE", serviceName: "Web 应用", serviceSlug: "web", serviceKind: "WEB", dockerfilePath: "Dockerfile", buildContext: ".", healthPath: "/api/health", internalPort: "3000", serviceEnabled: true });
  const [environmentForm, setEnvironmentForm] = useState({ id: "", name: "预发布", slug: "staging", kind: "STAGING", url: "https://aipms.sligenai.cn", githubEnvironment: "staging", healthPath: "/api/health", enabled: true });
  const [guide, setGuide] = useState("");
  const [feishu, setFeishu] = useState({ webhook: "", secret: "", enabled: false, notifyDeploymentSucceeded: false });
  const load = useCallback(async () => {
    const response = await fetch(`/api/projects/${projectId}/deployment-config`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) return setError(body.error || "加载配置失败");
    const next = body as ConfigData; setData(next); setGuide(next.guideMarkdown || ""); setFeishu((value) => ({ ...value, enabled: next.feishu.enabled, notifyDeploymentSucceeded: next.feishu.notifyDeploymentSucceeded }));
    const repository = next.repositories[0], service = next.services[0], environment = next.environments.find((item) => item.kind === "STAGING") || next.environments[0];
    if (repository || service) setResourceForm((value) => ({ ...value, installationId: repository?.installationId || value.installationId, owner: repository?.owner || value.owner, repository: repository?.name || value.repository, branch: repository?.defaultBranch || value.branch, workflowPath: repository?.workflowPath || value.workflowPath, repositoryStatus: repository?.status || value.repositoryStatus, serviceName: service?.name || value.serviceName, serviceSlug: service?.slug || value.serviceSlug, serviceKind: service?.kind || value.serviceKind, dockerfilePath: service?.dockerfilePath || value.dockerfilePath, buildContext: service?.buildContext || value.buildContext, healthPath: service?.healthPath || value.healthPath, internalPort: String(service?.internalPort || value.internalPort), serviceEnabled: service?.enabled ?? value.serviceEnabled }));
    if (environment) setEnvironmentForm({ id: environment.id, name: environment.name, slug: environment.slug, kind: environment.kind, url: environment.url, githubEnvironment: environment.githubEnvironment, healthPath: environment.healthPath, enabled: environment.enabled });
  }, [projectId]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);
  const input = (label: string, value: string, change: (value: string) => void, placeholder = "") => <label className="block"><span className="mb-1.5 block text-xs font-medium text-slate-500">{label}</span><input className="field" value={value} onChange={(event) => change(event.target.value)} placeholder={placeholder}/></label>;
  const request = async (url: string, method: string, body?: unknown) => { setBusy(true); setError(""); const response = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) }); const result = await response.json(); setBusy(false); if (!response.ok) { setError(result.error || "操作失败"); return null; } return result; };
  const composite = (environment = environmentForm) => ({ repository: { installationId: resourceForm.installationId, owner: resourceForm.owner, name: resourceForm.repository, defaultBranch: resourceForm.branch, workflowPath: resourceForm.workflowPath }, service: { name: resourceForm.serviceName, slug: resourceForm.serviceSlug, kind: resourceForm.serviceKind, dockerfilePath: resourceForm.dockerfilePath, buildContext: resourceForm.buildContext, healthPath: resourceForm.healthPath, internalPort: Number(resourceForm.internalPort) }, environment: { name: environment.name, slug: environment.slug, kind: environment.kind, url: environment.url, githubEnvironment: environment.githubEnvironment, healthPath: environment.healthPath } });
  async function saveResources() {
    if (!data) return;
    if (!data.repositories[0] || !data.services[0] || !data.environments[0]) {
      if (!await request(`/api/projects/${projectId}/deployment-config`, "PUT", composite())) return;
    } else {
      const repository = data.repositories[0], service = data.services[0];
      if (!await request(`/api/projects/${projectId}/deployment-config`, "PATCH", { resource: "repository", resourceId: repository.id, data: { installationId: resourceForm.installationId, owner: resourceForm.owner, name: resourceForm.repository, defaultBranch: resourceForm.branch, workflowPath: resourceForm.workflowPath, status: resourceForm.repositoryStatus } })) return;
      if (!await request(`/api/projects/${projectId}/deployment-config`, "PATCH", { resource: "service", resourceId: service.id, data: { repositoryId: repository.id, name: resourceForm.serviceName, slug: resourceForm.serviceSlug, kind: resourceForm.serviceKind, dockerfilePath: resourceForm.dockerfilePath, buildContext: resourceForm.buildContext, healthPath: resourceForm.healthPath, internalPort: Number(resourceForm.internalPort), enabled: resourceForm.serviceEnabled } })) return;
    }
    notify("仓库与服务配置已保存", "success"); await load();
  }
  async function saveEnvironment() {
    if (!data) return;
    const saved = environmentForm.id ? await request(`/api/projects/${projectId}/deployment-config`, "PATCH", { resource: "environment", resourceId: environmentForm.id, data: { name: environmentForm.name, slug: environmentForm.slug, kind: environmentForm.kind, url: environmentForm.url, githubEnvironment: environmentForm.githubEnvironment, healthPath: environmentForm.healthPath, enabled: environmentForm.enabled } }) : await request(`/api/projects/${projectId}/deployment-config`, "PUT", composite(environmentForm));
    if (!saved) return; notify("部署环境已保存", "success"); await load();
  }
  async function verify() { const result = await request(`/api/projects/${projectId}/deployment-config/verify`, "POST"); if (!result) return; const failed = result.results.filter((item: { status: string }) => item.status !== "READY").length; notify(failed ? `验证完成，${failed} 项需要处理` : "所有配置验证通过", failed ? "error" : "success"); await load(); }
  async function saveGuide() { if (!await request(`/api/projects/${projectId}/deployment-guide`, "PATCH", { guideMarkdown: guide })) return; notify("部署与运维说明已保存", "success"); await load(); }
  async function saveFeishu() { if (!await request(`/api/projects/${projectId}/deployment-alerts/feishu`, "PUT", feishu)) return; setFeishu((value) => ({ ...value, webhook: "", secret: "" })); notify("飞书告警配置已保存", "success"); await load(); }
  async function testFeishu() { if (!await request(`/api/projects/${projectId}/deployment-alerts/feishu/test`, "POST")) return; notify("测试消息已发送到项目群", "success"); await load(); }
  const tabs: Array<[Tab, string]> = [["overview", "接入概览"], ["resources", "仓库与服务"], ["environments", "环境管理"], ["guide", "部署教程"], ["feishu", "飞书告警"]];
  return <Modal title="CI/CD 配置中心" subtitle="集中维护代码仓库、部署资源、接入教程和故障通知" onClose={onClose} wide><div className="flex min-h-[620px] flex-col lg:flex-row"><nav className="flex gap-1 overflow-x-auto border-b border-slate-100 bg-slate-50/70 p-3 lg:w-44 lg:flex-col lg:border-b-0 lg:border-r">{tabs.map(([id, title]) => <button key={id} onClick={() => { setTab(id); setError(""); }} className={`rounded-xl px-3 py-2.5 text-left text-sm ${tab === id ? "bg-white font-medium text-blue-700 shadow-sm" : "text-slate-500 hover:bg-white/70"}`}>{title}</button>)}</nav><div className="min-w-0 flex-1 p-5 sm:p-7">{!data ? <div className="grid min-h-96 place-items-center"><LoaderCircle className="animate-spin text-blue-600"/></div> : <>
    {tab === "overview" && <div className="space-y-6"><div className="flex items-center justify-between"><div><h4 className="font-semibold">发布就绪状态</h4><p className="mt-1 text-sm text-slate-400">状态根据实际配置、连接与环境检测结果计算。</p></div><button onClick={() => void verify()} disabled={busy} className="secondary-button"><RefreshCw size={14}/>重新验证</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.readiness.map((item) => <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"><div className="flex items-center justify-between"><p className="text-sm font-medium">{item.title}</p><span className={`rounded-full px-2 py-1 text-[10px] ${item.status === "READY" ? "bg-emerald-50 text-emerald-700" : item.status === "WARNING" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{item.status === "READY" ? "已就绪" : item.status === "WARNING" ? "待确认" : "未配置"}</span></div><p className="mt-2 text-xs leading-5 text-slate-400">{item.detail}</p></div>)}</div><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5"><h4 className="flex items-center gap-2 font-medium text-slate-700"><ShieldCheck size={17} className="text-blue-600"/>GitHub Environment 所需 Secrets</h4><p className="mt-1 text-xs text-slate-500">敏感信息只保存在 GitHub Environment，平台不读取明文。</p><div className="mt-4 flex flex-wrap gap-2">{data.requiredSecrets.map((secret) => <code key={secret} className="rounded-lg bg-white px-2.5 py-1.5 text-xs text-slate-600 shadow-sm">{secret}</code>)}</div></div></div>}
    {tab === "resources" && <div className="space-y-6"><div><h4 className="font-semibold">仓库与服务</h4><p className="mt-1 text-sm text-slate-400">连接 GitHub App，声明标准 Docker 构建和健康检查入口。</p></div><div className="grid gap-4 sm:grid-cols-2">{input("GitHub App Installation ID", resourceForm.installationId, (value) => setResourceForm({ ...resourceForm, installationId: value }))}{input("GitHub 组织", resourceForm.owner, (value) => setResourceForm({ ...resourceForm, owner: value }))}{input("仓库名称", resourceForm.repository, (value) => setResourceForm({ ...resourceForm, repository: value }))}{input("候选分支", resourceForm.branch, (value) => setResourceForm({ ...resourceForm, branch: value }))}{input("Actions 工作流文件", resourceForm.workflowPath, (value) => setResourceForm({ ...resourceForm, workflowPath: value }))}{input("服务名称", resourceForm.serviceName, (value) => setResourceForm({ ...resourceForm, serviceName: value }))}{input("服务标识", resourceForm.serviceSlug, (value) => setResourceForm({ ...resourceForm, serviceSlug: value }))}<SelectField label="服务类型" value={resourceForm.serviceKind} onChange={(value) => setResourceForm({ ...resourceForm, serviceKind: value })} options={[{ value: "WEB", label: "Web" }, { value: "API", label: "API" }, { value: "WORKER", label: "Worker" }]}/>{input("Dockerfile 路径", resourceForm.dockerfilePath, (value) => setResourceForm({ ...resourceForm, dockerfilePath: value }))}{input("构建上下文", resourceForm.buildContext, (value) => setResourceForm({ ...resourceForm, buildContext: value }))}{input("健康检查路径", resourceForm.healthPath, (value) => setResourceForm({ ...resourceForm, healthPath: value }))}{input("容器内部端口", resourceForm.internalPort, (value) => setResourceForm({ ...resourceForm, internalPort: value }))}</div><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={resourceForm.serviceEnabled} onChange={(event) => setResourceForm({ ...resourceForm, serviceEnabled: event.target.checked })}/>启用此服务</label><button onClick={() => void saveResources()} disabled={busy} className="primary-button">保存仓库与服务</button></div>}
    {tab === "environments" && <div className="space-y-6"><div className="flex items-center justify-between"><div><h4 className="font-semibold">环境管理</h4><p className="mt-1 text-sm text-slate-400">环境类型显式配置，生产环境不会从标识自动推断。</p></div><button onClick={() => setEnvironmentForm({ id: "", name: "生产环境", slug: "production", kind: "PRODUCTION", url: "https://", githubEnvironment: "production", healthPath: "/api/health", enabled: true })} className="secondary-button">+ 新增生产环境</button></div><div className="flex flex-wrap gap-2">{data.environments.map((item) => <button key={item.id} onClick={() => setEnvironmentForm({ id: item.id, name: item.name, slug: item.slug, kind: item.kind, url: item.url, githubEnvironment: item.githubEnvironment, healthPath: item.healthPath, enabled: item.enabled })} className={`rounded-xl border px-3 py-2 text-sm ${environmentForm.id === item.id ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200"}`}>{item.name} · {labels[item.kind]}</button>)}{!data.environments.some((item) => item.kind === "PRODUCTION") && <span className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">生产环境未配置</span>}</div><div className="grid gap-4 sm:grid-cols-2">{input("环境名称", environmentForm.name, (value) => setEnvironmentForm({ ...environmentForm, name: value }))}{input("环境标识", environmentForm.slug, (value) => setEnvironmentForm({ ...environmentForm, slug: value }))}<SelectField label="环境类型" value={environmentForm.kind} onChange={(value) => setEnvironmentForm({ ...environmentForm, kind: value })} options={[{ value: "STAGING", label: "预发布" }, { value: "PRODUCTION", label: "生产" }]}/>{input("GitHub Environment", environmentForm.githubEnvironment, (value) => setEnvironmentForm({ ...environmentForm, githubEnvironment: value }))}{input("访问域名（HTTPS）", environmentForm.url, (value) => setEnvironmentForm({ ...environmentForm, url: value }))}{input("健康检查路径", environmentForm.healthPath, (value) => setEnvironmentForm({ ...environmentForm, healthPath: value }))}</div><label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={environmentForm.enabled} onChange={(event) => setEnvironmentForm({ ...environmentForm, enabled: event.target.checked })}/>启用此环境</label><button onClick={() => void saveEnvironment()} disabled={busy} className="primary-button">保存环境</button></div>}
    {tab === "guide" && <div className="space-y-5"><div><h4 className="font-semibold">部署接入向导</h4><p className="mt-1 text-sm text-slate-400">内置步骤可直接执行，项目特有信息在下方 Markdown 中持续维护并留痕。</p></div><ol className="grid gap-2 text-sm text-slate-600 sm:grid-cols-2">{["安装 GitHub App 并授权仓库", "配置分支、Dockerfile 与健康路径", "创建 GitHub Environment", "添加回调、SSH、服务器所需 Secrets", "安装受限部署命令和蓝绿 Nginx 配置", "配置 DNS、HTTPS 与目标域名", "验证仓库、环境和发布权限", "完成一次预发布与回滚演练"].map((item, index) => <li key={item} className="flex gap-3 rounded-xl bg-slate-50 p-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-xs font-semibold text-blue-600">{index + 1}</span>{item}</li>)}</ol><div className="grid overflow-hidden rounded-2xl border border-slate-200 lg:grid-cols-2"><label className="block p-4"><span className="mb-2 block text-sm font-medium">项目部署与运维说明</span><textarea className="field min-h-80 resize-y font-mono text-sm" value={guide} onChange={(event) => setGuide(event.target.value)} placeholder="# 项目部署说明\n\n记录服务器资源、域名、值班与排障流程。"/></label><div className="border-t bg-slate-50/60 p-4 lg:border-l lg:border-t-0"><p className="text-sm font-medium">Markdown 预览</p><div className="markdown-content mt-3 min-h-80 rounded-xl bg-white p-4 text-sm text-slate-600"><ReactMarkdown remarkPlugins={[remarkGfm]}>{guide || "_尚未填写项目部署说明_"}</ReactMarkdown></div></div></div><button onClick={() => void saveGuide()} disabled={busy} className="primary-button"><BookOpen size={15}/>保存说明</button></div>}
    {tab === "feishu" && <div className="space-y-6"><div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-5"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-white text-blue-600"><BellRing size={18}/></span><div><h4 className="font-semibold">项目统一群机器人</h4><p className="mt-1 text-xs text-slate-500">失败、自动回滚、环境掉线和恢复默认通知；同一事件自动去重。</p></div></div></div>{input("飞书 / Lark 群机器人 Webhook", feishu.webhook, (value) => setFeishu({ ...feishu, webhook: value }), data.feishu.configured ? "已安全保存，留空表示保持不变" : "https://open.feishu.cn/open-apis/bot/v2/hook/...")}{input("签名密钥（可选）", feishu.secret, (value) => setFeishu({ ...feishu, secret: value }), data.feishu.configured ? "留空表示保持不变" : "群机器人安全设置中的签名密钥")}<div className="space-y-3 rounded-2xl bg-slate-50 p-4"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={feishu.enabled} onChange={(event) => setFeishu({ ...feishu, enabled: event.target.checked })}/>启用项目发布告警</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={feishu.notifyDeploymentSucceeded} onChange={(event) => setFeishu({ ...feishu, notifyDeploymentSucceeded: event.target.checked })}/>发布成功也发送通知（默认关闭）</label></div>{data.feishu.lastTestedAt && <p className="text-xs text-slate-500">最后测试：{fmt(data.feishu.lastTestedAt)} · {data.feishu.lastTestStatus === "SUCCESS" ? "成功" : `失败：${data.feishu.lastError || "未知原因"}`}</p>}<div className="flex gap-2"><button onClick={() => void saveFeishu()} disabled={busy} className="primary-button">保存告警配置</button><button onClick={() => void testFeishu()} disabled={busy || !data.feishu.configured} className="secondary-button">发送测试消息</button></div></div>}
    {error && <p role="alert" className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}</>}</div></div><div className="flex justify-end border-t border-slate-100 px-5 py-4"><button onClick={() => { onSaved(); onClose(); }} className="secondary-button">完成</button></div></Modal>;
}

function Modal({ title, subtitle, onClose, children, wide = false }: { title: string; subtitle: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/25 p-4 backdrop-blur-sm"><div className={`max-h-[92vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl ${wide ? "max-w-6xl" : "max-w-2xl"}`}><div className="sticky top-0 z-10 flex items-start border-b border-slate-100 bg-white px-5 py-4"><div><h3 className="font-semibold">{title}</h3><p className="mt-1 text-xs text-slate-400">{subtitle}</p></div><button onClick={onClose} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-50"><X size={18}/></button></div>{wide ? children : <div className="p-5">{children}</div>}</div></div>; }
function Status({ value }: { value: string }) { const tone = value === "HEALTHY" || value === "SUCCEEDED" || value === "RELEASED" ? "bg-emerald-50 text-emerald-700" : value === "FAILED" || value === "DOWN" ? "bg-rose-50 text-rose-700" : value === "WAITING_APPROVAL" || value === "DEGRADED" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"; return <span className={`rounded-full px-2 py-1 text-[11px] ${tone}`}>{labels[value] || value}</span>; }
function RunIcon({ status }: { status: string }) { return <span className={`grid size-9 place-items-center rounded-xl ${status === "SUCCEEDED" ? "bg-emerald-50 text-emerald-600" : status === "FAILED" ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}>{status === "SUCCEEDED" ? <CheckCircle2 size={17}/> : status === "FAILED" ? <XCircle size={17}/> : active.has(status) ? <LoaderCircle size={17} className="animate-spin"/> : <Clock3 size={17}/>}</span>; }
function StepIcon({ status }: { status: string }) { return status === "SUCCEEDED" ? <CheckCircle2 size={14} className="text-emerald-600"/> : status === "FAILED" ? <XCircle size={14} className="text-rose-600"/> : status === "RUNNING" ? <LoaderCircle size={14} className="animate-spin text-blue-600"/> : <CircleDashed size={14} className="text-slate-300"/>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><strong className="text-sm">{value}</strong><p className="mt-1 text-[11px] text-slate-400">{label}</p></div>; }
function Empty({ text }: { text: string }) { return <div className="card grid min-h-52 place-items-center text-sm text-slate-400">{text}</div>; }
