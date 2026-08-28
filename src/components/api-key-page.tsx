"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Clipboard, KeyRound, LoaderCircle, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, X } from "lucide-react";
import { API_PERMISSION_GROUPS, API_PERMISSION_LABELS, DEFAULT_API_PERMISSIONS, type ApiTokenPermission } from "@/lib/api-token-permissions";
import { SelectField } from "@/components/ui/select-field";

type Project = { id: string; code: string; name: string };
type Token = { id: string; name: string; prefix: string; allProjects: boolean; permissions: string[]; projects: Project[]; expiresAt: string | null; revokedAt: string | null; lastUsedAt: string | null; createdAt: string };
type Form = { name: string; allProjects: boolean; projectIds: string[]; permissions: ApiTokenPermission[]; expiry: string; customExpiry: string };
const emptyForm = (): Form => ({ name: "", allProjects: true, projectIds: [], permissions: [...DEFAULT_API_PERMISSIONS], expiry: "90", customExpiry: "" });
const displayDate = (value: string | null) => value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const getStatus = (token: Token) => token.revokedAt ? "已撤销" : token.expiresAt && new Date(token.expiresAt) <= new Date() ? "已过期" : "有效";

export function ApiKeyPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"create" | "edit" | "detail" | null>(null);
  const [selected, setSelected] = useState<Token | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [secret, setSecret] = useState("");
  const [copied, setCopied] = useState(false);
  const [query, setQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [permissionFilter, setPermissionFilter] = useState("ALL");

  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/v1/tokens"); const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加载失败");
      setTokens(data.tokens); setProjects(data.projects);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "加载失败"); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/tokens").then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "加载失败");
      if (active) { setTokens(data.tokens); setProjects(data.projects); }
    }).catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "加载失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visible = useMemo(() => tokens.filter((token) =>
    token.name.toLowerCase().includes(query.toLowerCase()) &&
    (projectFilter === "ALL" || (projectFilter === "DYNAMIC" ? token.allProjects : token.projects.some((project) => project.id === projectFilter))) &&
    (statusFilter === "ALL" || getStatus(token) === statusFilter) &&
    (permissionFilter === "ALL" || token.permissions.includes(permissionFilter)),
  ), [tokens, query, projectFilter, statusFilter, permissionFilter]);

  function startCreate() { setSelected(null); setForm(emptyForm()); setError(""); setDialog("create"); }
  function startEdit(token: Token) {
    setSelected(token); setError("");
    setForm({ name: token.name, allProjects: token.allProjects, projectIds: token.projects.map((project) => project.id), permissions: token.permissions as ApiTokenPermission[], expiry: token.expiresAt ? "custom" : "never", customExpiry: token.expiresAt?.slice(0, 16) || "" });
    setDialog("edit");
  }
  function expiresAt() {
    if (form.expiry === "never") return null;
    if (form.expiry === "custom") return form.customExpiry ? new Date(form.customExpiry).toISOString() : null;
    return new Date(Date.now() + Number(form.expiry) * 86_400_000).toISOString();
  }
  async function save() {
    setError("");
    if (form.name.trim().length < 2) return setError("名称至少需要 2 个字符");
    if (!form.allProjects && !form.projectIds.length) return setError("请至少选择一个项目");
    if (!form.permissions.length) return setError("请至少选择一项权限");
    if (form.expiry === "custom" && !form.customExpiry) return setError("请选择自定义有效期");
    setSaving(true);
    try {
      const response = await fetch(selected ? `/api/v1/tokens/${selected.id}` : "/api/v1/tokens", { method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name.trim(), allProjects: form.allProjects, projectIds: form.projectIds, permissions: form.permissions, expiresAt: expiresAt() }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "保存失败");
      setDialog(null); if (data.token) setSecret(data.token); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  }
  async function revoke(token: Token) {
    if (!window.confirm(`撤销“${token.name}”后将立即失效且无法恢复，确认撤销？`)) return;
    const response = await fetch(`/api/v1/tokens/${token.id}`, { method: "DELETE" }); const data = await response.json();
    if (!response.ok) return setError(data.error || "撤销失败"); await load();
  }
  async function copySecret() { await navigator.clipboard.writeText(secret); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }

  return <div className="flex min-h-[calc(100vh-112px)] flex-col gap-5 md:min-h-[calc(100vh-136px)]">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-2xl font-bold">API Key</h2><p className="mt-1 max-w-4xl text-sm leading-6 text-slate-500">授权 Codex 以当前真人用户身份安全读取和提交工作。API 请求头使用 <code className="mx-1 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-blue-700">Authorization: Bearer &lt;API Key&gt;</code>，项目、需求、任务和文档接口统一遵循这里配置的项目与权限范围。</p></div><button onClick={startCreate} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"><Plus size={17}/>创建 API Key</button></div>
    <Notice tone="amber"><b>安全提示：</b>完整密钥只在创建时显示一次。系统仅保存哈希，撤销后立即失效并保留审计记录。</Notice>
    <div className="flex flex-wrap gap-2"><div className="flex h-10 min-w-[240px] items-center gap-2 rounded-xl border bg-white px-3"><Search size={16} className="text-slate-400"/><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full text-sm outline-none" placeholder="搜索 API Key 名称"/></div><SelectField value={projectFilter} onChange={setProjectFilter} className="min-w-44" options={[{value:"ALL",label:"全部项目"},{value:"DYNAMIC",label:"全部可访问项目"},...projects.map((project)=>({value:project.id,label:project.name,description:project.code}))]}/><SelectField value={statusFilter} onChange={setStatusFilter} className="min-w-36" options={[{value:"ALL",label:"全部状态"},{value:"有效",label:"有效"},{value:"已过期",label:"已过期"},{value:"已撤销",label:"已撤销"}]}/><SelectField value={permissionFilter} onChange={setPermissionFilter} className="min-w-40" options={[{value:"ALL",label:"全部权限"},...Object.entries(API_PERMISSION_LABELS).map(([value,label])=>({value,label}))]}/></div>
    <div className="card flex min-h-[320px] flex-1 flex-col overflow-hidden"><div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-left"><thead><tr className="border-b bg-slate-50 text-xs text-slate-500">{["名称 / Key", "项目范围", "权限", "状态", "有效期", "最近使用", "创建时间", "操作"].map((label) => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead>{!loading && visible.length > 0 && <tbody>{visible.map((token) => <TokenRow key={token.id} token={token} detail={() => { setSelected(token); setDialog("detail"); }} edit={() => startEdit(token)} revoke={() => void revoke(token)}/>)}</tbody>}</table></div>{loading ? <div className="flex flex-1 flex-col items-center justify-center text-sm text-slate-400"><LoaderCircle className="mb-2 animate-spin"/>正在加载</div> : visible.length === 0 && <div className="flex flex-1 flex-col items-center justify-center"><KeyRound className="mb-3 text-slate-300" size={30}/><p className="text-sm text-slate-600">暂无符合条件的 API Key</p></div>}</div>
    {error && !dialog && <Notice tone="rose">{error}</Notice>}
    {(dialog === "create" || dialog === "edit") && <TokenDialog title={dialog === "create" ? "创建 API Key" : "编辑 API Key"} form={form} update={setForm} projects={projects} error={error} saving={saving} close={() => setDialog(null)} save={() => void save()}/>} 
    {dialog === "detail" && selected && <DetailDialog token={selected} close={() => setDialog(null)}/>} 
    {secret && <SecretDialog token={secret} copied={copied} copy={() => void copySecret()} close={() => setSecret("")}/>} 
  </div>;
}

function TokenRow({ token, detail, edit, revoke }: { token: Token; detail: () => void; edit: () => void; revoke: () => void }) {
  const status = getStatus(token);
  return <tr className="border-b last:border-0 hover:bg-slate-50/60"><td className="px-4 py-4"><p className="font-medium">{token.name}</p><code className="mt-1 block text-xs text-slate-400">{token.prefix}••••••••</code></td><td className="px-4 py-4 text-sm text-slate-600">{token.allProjects ? "全部可访问项目" : token.projects.map((project) => project.name).join("、")}</td><td className="px-4 py-4"><button onClick={detail} className="text-sm font-medium text-blue-600">{token.permissions.length} 项权限</button></td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs ${status === "有效" ? "bg-emerald-50 text-emerald-700" : status === "已过期" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500"}`}>{status}</span></td><td className="px-4 py-4 text-sm text-slate-500">{token.expiresAt ? displayDate(token.expiresAt) : "永不过期"}</td><td className="px-4 py-4 text-sm text-slate-500">{displayDate(token.lastUsedAt)}</td><td className="px-4 py-4 text-sm text-slate-500">{displayDate(token.createdAt)}</td><td className="px-4 py-4"><div className="flex gap-2"><button onClick={detail} className="text-sm text-slate-500">详情</button>{status === "有效" && <><button onClick={edit} title="编辑" className="text-slate-400 hover:text-blue-600"><Pencil size={16}/></button><button onClick={revoke} title="撤销" className="text-slate-400 hover:text-rose-600"><Trash2 size={16}/></button></>}</div></td></tr>;
}

function TokenDialog({ title, form, update, projects, error, saving, close, save }: { title: string; form: Form; update: React.Dispatch<React.SetStateAction<Form>>; projects: Project[]; error: string; saving: boolean; close: () => void; save: () => void }) {
  const toggle = (permission: ApiTokenPermission) => update((value) => ({ ...value, permissions: value.permissions.includes(permission) ? value.permissions.filter((item) => item !== permission) : [...value.permissions, permission] }));
  const footer = <><button onClick={close} className="h-10 rounded-xl border bg-white px-4 text-sm">取消</button><button onClick={save} disabled={saving} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60">{saving && <LoaderCircle size={16} className="animate-spin"/>}确认保存</button></>;
  return <Modal title={title} close={close} footer={footer}><div className="space-y-5"><div className="flex gap-3 rounded-2xl bg-blue-50/70 p-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-blue-600 shadow-sm"><KeyRound size={19}/></span><div><p className="text-sm font-semibold text-slate-700">为真人用户的 Codex 工作流创建访问凭证</p><p className="mt-1 text-xs leading-5 text-slate-500">按实际用途选择项目和权限。密钥创建后仅展示一次，后续可随时调整或撤销。</p></div></div><div className="grid gap-4 sm:grid-cols-[1fr_220px]"><label className="block"><span className="mb-2 block text-sm font-medium text-slate-700">名称</span><input value={form.name} onChange={(event) => update({ ...form, name: event.target.value })} className="field" placeholder="例如：Codex 开发环境"/></label><label className="block"><span className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-700"><CalendarClock size={15} className="text-slate-400"/>有效期</span><SelectField value={form.expiry} onChange={(expiry) => update({ ...form, expiry })} options={[{value:"7",label:"7 天"},{value:"30",label:"30 天"},{value:"90",label:"90 天（推荐）"},{value:"custom",label:"自定义"},{value:"never",label:"永不过期"}]}/></label></div>{form.expiry === "custom" && <label className="block rounded-xl bg-slate-50 p-3"><span className="mb-2 block text-xs font-medium text-slate-500">自定义到期时间</span><input type="datetime-local" value={form.customExpiry} onChange={(event) => update({ ...form, customExpiry: event.target.value })} className="field"/></label>}<fieldset className="rounded-2xl bg-slate-50/80 p-4"><legend className="px-1 text-sm font-semibold text-slate-700">项目范围</legend><div className="mt-2 grid gap-2 sm:grid-cols-2"><Choice active={form.allProjects} title="全部可访问项目" description="自动包含未来加入的项目" click={() => update({ ...form, allProjects: true, projectIds: [] })}/><Choice active={!form.allProjects} title="指定项目" description="仅允许访问选中的项目" click={() => update({ ...form, allProjects: false })}/></div>{!form.allProjects && <div className="mt-3 grid gap-2 sm:grid-cols-2">{projects.map((project) => {const active=form.projectIds.includes(project.id);return <button type="button" key={project.id} onClick={() => update({ ...form, projectIds: active ? form.projectIds.filter((id) => id !== project.id) : [...form.projectIds, project.id] })} className={`flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 text-left text-sm shadow-sm ring-1 transition ${active?"ring-blue-300":"ring-slate-100 hover:ring-slate-200"}`}><span className={`grid size-5 shrink-0 place-items-center rounded-md ${active?"bg-blue-600 text-white":"bg-slate-100 text-transparent"}`}><Check size={13}/></span><span className="min-w-0 flex-1 truncate">{project.name}</span><code className="text-xs text-slate-400">{project.code}</code></button>})}</div>}</fieldset><fieldset><div className="mb-3 flex items-center"><div><legend className="text-sm font-semibold text-slate-700">权限范围</legend><p className="mt-0.5 text-xs text-slate-400">已选择 {form.permissions.length} 项权限</p></div><button type="button" onClick={() => update({ ...form, permissions: [...DEFAULT_API_PERMISSIONS] })} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600"><Sparkles size={13}/>恢复推荐</button></div><div className="grid gap-2 sm:grid-cols-2">{API_PERMISSION_GROUPS.map((group) => <div key={group.key} className="rounded-2xl bg-slate-50/80 p-3.5"><p className="mb-2 text-xs font-semibold tracking-wide text-slate-500">{group.label}</p><div className="flex flex-wrap gap-1.5">{group.permissions.map((permission) => <PermissionToggle key={permission} active={form.permissions.includes(permission)} label={API_PERMISSION_LABELS[permission]} click={() => toggle(permission)}/>)}</div></div>)}</div></fieldset>{error && <Notice tone="rose">{error}</Notice>}</div></Modal>;
}

function DetailDialog({ token, close }: { token: Token; close: () => void }) { return <Modal title="API Key 详情" close={close}><div className="grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><Info label="名称" value={token.name}/><Info label="密钥前缀" value={`${token.prefix}••••••••`}/><Info label="项目范围" value={token.allProjects ? "全部可访问项目" : token.projects.map((project) => project.name).join("、")}/><Info label="状态" value={getStatus(token)}/><Info label="有效期" value={token.expiresAt ? displayDate(token.expiresAt) : "永不过期"}/><Info label="最近使用" value={displayDate(token.lastUsedAt)}/></div><p className="mb-3 mt-5 text-sm font-semibold">权限范围</p><div className="flex flex-wrap gap-2">{token.permissions.map((permission) => <span key={permission} className="rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">{API_PERMISSION_LABELS[permission as ApiTokenPermission] || permission}</span>)}</div></Modal>; }
function SecretDialog({ token, copied, copy, close }: { token: string; copied: boolean; copy: () => void; close: () => void }) { return <Modal title="API Key 创建成功" close={close} footer={<button onClick={close} className="h-10 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white">我已安全保存</button>}><div className="text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><ShieldCheck/></div><h4 className="mt-3 font-semibold">请立即复制并安全保存</h4><p className="mt-1 text-sm text-slate-500">完整密钥关闭后将无法再次查看。</p><div className="mt-5 flex items-center gap-2 rounded-xl border bg-slate-50 p-3 text-left"><code className="min-w-0 flex-1 break-all text-sm">{token}</code><button onClick={copy} className="rounded-lg bg-white p-2 text-blue-600 shadow-sm">{copied ? <Check size={18}/> : <Clipboard size={18}/>}</button></div></div></Modal>; }
function Modal({ title, close, children, footer }: { title: string; close: () => void; children: React.ReactNode; footer?: React.ReactNode }) { return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/30 p-4 backdrop-blur-[2px]"><section role="dialog" aria-modal="true" className="max-h-[92vh] w-full max-w-[760px] overflow-hidden rounded-3xl border border-white/80 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.2)]"><header className="flex items-center px-6 pb-2 pt-5"><h3 className="text-lg font-semibold">{title}</h3><button onClick={close} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={20}/></button></header><div className="max-h-[calc(92vh-132px)] overflow-y-auto px-6 pb-6 pt-3">{children}</div>{footer && <footer className="flex justify-end gap-2 border-t border-slate-100 bg-white/90 px-6 py-4 backdrop-blur">{footer}</footer>}</section></div>; }
function Notice({ tone, children }: { tone: "blue" | "amber" | "rose"; children: React.ReactNode }) { const style = tone === "blue" ? "border-blue-200 bg-blue-50 text-blue-800" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-rose-200 bg-rose-50 text-rose-700"; return <div role={tone === "rose" ? "alert" : undefined} className={`rounded-xl border px-4 py-3 text-sm ${style}`}>{children}</div>; }
function Choice({ active, title, description, click }: { active: boolean; title: string; description: string; click: () => void }) { return <button type="button" onClick={click} className={`rounded-xl bg-white p-3 text-left shadow-sm ring-1 transition ${active ? "ring-blue-300" : "ring-slate-100 hover:ring-slate-200"}`}><span className="flex items-center text-sm font-medium"><span className={`mr-2 grid size-5 place-items-center rounded-md ${active?"bg-blue-600 text-white":"bg-slate-100 text-transparent"}`}><Check size={13}/></span>{title}</span><span className="ml-7 mt-1 block text-xs text-slate-400">{description}</span></button>; }
function PermissionToggle({active,label,click}:{active:boolean;label:string;click:()=>void}){return <button type="button" onClick={click} className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition ${active?"bg-white text-blue-700 shadow-sm ring-1 ring-blue-200":"text-slate-500 hover:bg-white"}`}><span className={`grid size-4 place-items-center rounded ${active?"bg-blue-600 text-white":"bg-slate-200 text-transparent"}`}><Check size={11}/></span>{label}</button>}
function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>; }
