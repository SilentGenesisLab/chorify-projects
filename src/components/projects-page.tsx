"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { ProjectWorkspace } from "@/components/project-workspace";
import { ProjectOverview } from "@/components/project-overview";
import { FileManager } from "@/components/file-manager";
import { SelectField } from "@/components/ui/select-field";
import {
  Bug,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Folder,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Rocket,
  Search,
  Target,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";

type Project = {
  id: string;
  code: string;
  name: string;
  description: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  canManage: boolean;
  canDelete: boolean;
  team: { id: string; name: string };
  memberCount: number;
  taskCount: number;
};
type Team = { id: string; name: string };
type Section =
  "overview" | "team" | "requirements" | "tasks" | "bugs" | "versions" | "files";
const sections: { id: Section; label: string; icon: typeof LayoutDashboard }[] =
  [
    { id: "overview", label: "概览", icon: LayoutDashboard },
    { id: "team", label: "团队管理", icon: Users },
    { id: "requirements", label: "需求管理", icon: Target },
    { id: "tasks", label: "任务管理", icon: ListChecks },
    { id: "bugs", label: "Bug 管理", icon: Bug },
    { id: "versions", label: "版本与发布", icon: Rocket },
    { id: "files", label: "项目文件", icon: Folder },
  ];

export function ProjectsPage({
  projectId,
  section,
}: {
  projectId?: string;
  section?: string;
}) {
  const [projects, setProjects] = useState<Project[]>([]),
    [teams, setTeams] = useState<Team[]>([]),
    [loading, setLoading] = useState(true),
    [open, setOpen] = useState(false),
    [menuId, setMenuId] = useState(""),
    [editing, setEditing] = useState<Project | null>(null),
    [deleting, setDeleting] = useState<Project | null>(null),
    [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/projects");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "加载失败");
      setProjects(body.projects);
      setTeams(body.teams);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/projects")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "加载失败");
        if (active) {
          setProjects(body.projects);
          setTeams(body.teams);
        }
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  if (loading)
    return (
      <div className="grid min-h-72 place-items-center">
        <LoaderCircle className="animate-spin text-blue-600" size={28} />
      </div>
    );
  if (projectId) {
    const project = projects.find((item) => item.id === projectId);
    return project ? (
      <ProjectDetail
        project={project}
        section={
          (sections.some((item) => item.id === section)
            ? section
            : "overview") as Section
        }
      />
    ) : (
      <div className="card p-12 text-center">
        <h2 className="font-semibold">未找到项目</h2>
        <Link
          href="/projects"
          className="mt-3 inline-block text-sm text-blue-600"
        >
          返回项目列表
        </Link>
      </div>
    );
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">项目管理</h2>
          <p className="mt-1 text-sm text-slate-500">
            进入项目后统一管理需求、任务、Bug、版本与项目文件
          </p>
        </div>
        <button
          disabled={!teams.length}
          title={!teams.length ? "请先加入团队成为正式成员，访客不能新建项目" : undefined}
          onClick={() => setOpen(true)}
          className="primary-button disabled:opacity-50"
        >
          <Plus size={17} />
          新建项目
        </button>
      </div>
      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <article
            key={project.id}
            className="card group relative p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-start">
              <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <FolderKanban size={21} />
              </span>
              {(project.canManage || project.canDelete) && <div className="relative ml-auto">
                <button type="button" aria-label={`管理 ${project.name}`} aria-expanded={menuId === project.id} onClick={() => setMenuId((value) => value === project.id ? "" : project.id)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal size={19} /></button>
                {menuId === project.id && <div className="absolute right-0 top-10 z-20 w-40 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                  {project.canManage && <button type="button" onClick={() => { setMenuId(""); setEditing(project); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50"><Pencil size={15}/>编辑基本信息</button>}
                  {project.canDelete && <button type="button" onClick={() => { setMenuId(""); setDeleting(project); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"><Trash2 size={15}/>删除项目</button>}
                </div>}
              </div>}
            </div>
            <Link href={`/projects/${project.id}`} className="block">
            <div className="mt-5 flex items-center gap-2">
              <h3 className="font-semibold group-hover:text-blue-700">
                {project.name}
              </h3>
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                {project.code}
              </span>
            </div>
            <p className="mt-1 text-xs text-blue-600">{project.team.name}</p>
            <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-500">
              {project.description || "暂无项目说明"}
            </p>
            <div className="mt-4 flex items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Users size={13} />
                {project.memberCount} 位成员
              </span>
              <span>{project.taskCount} 个任务</span>
              <ChevronRight
                className="ml-auto text-slate-300 group-hover:text-blue-500"
                size={17}
              />
            </div>
            </Link>
          </article>
        ))}
      </div>
      {!projects.length && (
        <div className="card p-12 text-center text-sm text-slate-500">
          还没有可访问的项目
        </div>
      )}
      {open && (
        <CreateProject
          teams={teams}
          onClose={() => setOpen(false)}
          onCreated={async () => {
            setOpen(false);
            await load();
          }}
        />
      )}
      {editing && <EditProject project={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
      {deleting && <DeleteProject project={deleting} onClose={() => setDeleting(null)} onDeleted={async () => { setDeleting(null); await load(); }} />}
    </div>
  );
}

function ProjectDetail({
  project,
  section,
}: {
  project: Project;
  section: Section;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center gap-2 text-xs text-slate-400">
          <Link href="/projects" className="hover:text-blue-600">
            项目管理
          </Link>
          <ChevronRight size={13} />
          <span>{project.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
          <span className="rounded bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
            {project.code}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {project.description || "暂无项目说明"} · {project.team.name}
        </p>
      </div>
      <nav
        className="scrollbar-none flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5"
        aria-label="项目功能"
      >
        {sections.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.id}
              href={`/projects/${project.id}/${item.id}`}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium ${section === item.id ? "bg-[#edf3ff] text-[#2458ce]" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
            >
              <Icon size={16} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <ProjectSection project={project} section={section} />
    </div>
  );
}

function ProjectSection({
  project,
  section,
}: {
  project: Project;
  section: Section;
}) {
  if (section === "files") return <FileManager lockedProjectId={project.id} />;
  if (section === "team") return <ProjectTeam project={project} />;
  if (section === "requirements" || section === "tasks" || section === "bugs" || section === "versions")
    return <ProjectWorkspace projectId={project.id} module={section} />;
  if (section === "overview")
    return <ProjectOverview projectId={project.id} />;
  const config = {
    requirements: {
      title: "需求管理",
      subtitle: "管理项目范围、验收条件和关联任务",
      action: "新建需求",
      icon: Target,
      items: ["统一成员权限模型", "任务提交与验收闭环", "项目文件引用机制"],
    },
    tasks: {
      title: "任务管理",
      subtitle: "拆分项目工作并跟踪负责人、依赖与交付",
      action: "新建任务",
      icon: ListChecks,
      items: [
        "完成项目成员权限矩阵",
        "梳理任务提交与验收流程",
        "整理首版演示数据",
      ],
    },
    bugs: {
      title: "Bug 管理",
      subtitle: "跟踪问题从提出、修复、验证到进入版本",
      action: "提交 Bug",
      icon: Bug,
      items: ["移动端侧边栏偶发遮挡", "任务筛选条件未保留", "版本进度统计偏差"],
    },
    versions: {
      title: "版本与发布",
      subtitle: "规划版本范围、发布清单和回滚说明",
      action: "新建版本",
      icon: Rocket,
      items: ["V0.9 协作内测版", "V0.8 基础框架", "V0.7 登录与权限"],
    },
    files: {
      title: "项目文件",
      subtitle: "归档项目资料并在工作项之间复用引用",
      action: "上传文件",
      icon: FileText,
      items: [
        "产品需求说明书.docx",
        "接口联调清单.xlsx",
        "V0.9 发布检查表.pdf",
      ],
    },
  }[section as "requirements" | "tasks" | "bugs" | "versions" | "files"];
  const Icon = config.icon;
  return (
    <div className="space-y-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h3 className="text-xl font-bold">{config.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{config.subtitle}</p>
        </div>
        <button className="primary-button">
          <Plus size={16} />
          {config.action}
        </button>
      </div>
      <section className="card divide-y divide-slate-100 overflow-hidden">
        {config.items.map((item, index) => (
          <div
            key={item}
            className="flex items-center gap-3 p-4 hover:bg-slate-50"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-blue-50 text-blue-600">
              <Icon size={17} />
            </span>
            <div>
              <p className="text-sm font-medium">{item}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {project.code}-{142 - index} ·{" "}
                {index === 0 ? "进行中" : "待处理"}
              </p>
            </div>
            <ChevronRight className="ml-auto text-slate-300" size={17} />
          </div>
        ))}
      </section>
    </div>
  );
}

type ProjectMemberRole = "OWNER" | "MANAGER" | "MEMBER" | "GUEST";
type ProjectTeamData = {
  project: { id:string; name:string; team:{id:string;name:string} };
  permissions: { canManage:boolean; canAssignManagers:boolean };
  members: Array<{id:string;userId:string;name:string;phone:string;avatarColor:string;role:ProjectMemberRole;roleLabel:string;responsibility:string|null}>;
  teamMembers: Array<{userId:string;name:string;phone:string;avatarColor:string;teamRole:string;teamRoleLabel:string;inProject:boolean}>;
};
const projectRoleClass:Record<ProjectMemberRole,string>={OWNER:"bg-orange-50 text-orange-700",MANAGER:"bg-violet-50 text-violet-700",MEMBER:"bg-emerald-50 text-emerald-700",GUEST:"bg-slate-100 text-slate-600"};

async function projectRequest<T>(url:string,init?:RequestInit):Promise<T>{
  const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...(init?.headers||{})}});
  const body=await response.json();
  if(!response.ok)throw new Error(body.error||"操作失败，请稍后重试");
  return body;
}

function ProjectTeam({project}:{project:Project}){
  const [data,setData]=useState<ProjectTeamData|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[open,setOpen]=useState(false),[busy,setBusy]=useState("");
  const load=useCallback(async()=>{try{const result=await projectRequest<ProjectTeamData>(`/api/projects/${project.id}/members`);setData(result);setError("");}catch(e){setError(e instanceof Error?e.message:"加载失败");}finally{setLoading(false);}},[project.id]);
  useEffect(()=>{let active=true;projectRequest<ProjectTeamData>(`/api/projects/${project.id}/members`).then(result=>{if(active){setData(result);setError("");}}).catch(e=>{if(active)setError(e instanceof Error?e.message:"加载失败");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[project.id]);
  async function update(member:ProjectTeamData["members"][number],patch:{role?:ProjectMemberRole;responsibility?:string|null}){setBusy(member.id);setError("");try{await projectRequest(`/api/projects/${project.id}/members/${member.id}`,{method:"PATCH",body:JSON.stringify({role:patch.role||member.role,responsibility:patch.responsibility===undefined?member.responsibility:patch.responsibility})});await load();}catch(e){setError(e instanceof Error?e.message:"修改失败");}finally{setBusy("");}}
  async function remove(member:ProjectTeamData["members"][number]){if(!window.confirm(`确认将“${member.name}”移出项目？该成员仍会保留在外部团队中。`))return;setBusy(member.id);setError("");try{await projectRequest(`/api/projects/${project.id}/members/${member.id}`,{method:"DELETE"});await load();}catch(e){setError(e instanceof Error?e.message:"移除失败");}finally{setBusy("");}}
  if(loading)return <div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-blue-600" size={28}/></div>;
  if(!data)return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error||"无法读取项目团队"}</div>;
  const available=data.teamMembers.filter(member=>!member.inProject);
  const managers=data.members.filter(member=>member.role==="OWNER"||member.role==="MANAGER").length;
  return <div className="space-y-5">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><h3 className="text-xl font-bold">项目团队管理</h3><p className="mt-1 text-sm text-slate-500">管理项目角色与职责，成员从“{data.project.team.name}”团队中拉入</p></div>{data.permissions.canManage&&<button onClick={()=>setOpen(true)} className="primary-button"><UserPlus size={16}/>从团队拉入成员</button>}</div>
    {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
    <div className="grid gap-4 sm:grid-cols-3">{[{label:"项目成员",value:data.members.length,note:"已获得项目访问权限",icon:Users},{label:"管理角色",value:managers,note:"所有者与项目经理",icon:CheckCircle2},{label:"可拉入成员",value:available.length,note:`来自 ${data.project.team.name}`,icon:UserPlus}].map(item=><div key={item.label} className="card flex items-center gap-4 p-5"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600"><item.icon size={20}/></span><span><b className="text-2xl">{item.value}</b><span className="mt-0.5 block text-sm font-medium">{item.label}</span><span className="mt-0.5 block text-xs text-slate-400">{item.note}</span></span></div>)}</div>
    <section className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h4 className="font-semibold">项目成员</h4><p className="mt-0.5 text-xs text-slate-400">外部团队身份不自动获得项目访问权；拉入项目后单独分配角色和工作职责</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="bg-slate-50/70 text-xs text-slate-400"><th className="px-5 py-3 font-medium">成员</th><th className="px-4 py-3 font-medium">项目角色</th><th className="px-4 py-3 font-medium">工作职责</th><th className="px-4 py-3 font-medium">来源团队</th><th className="px-5 py-3"></th></tr></thead><tbody>{data.members.map(member=>{const elevated=member.role==="OWNER"||member.role==="MANAGER";const editable=data.permissions.canManage&&(data.permissions.canAssignManagers||!elevated);return <tr key={member.id} className="border-t border-slate-100"><td className="px-5 py-3"><div className="flex items-center gap-3"><ProjectAvatar name={member.name} color={member.avatarColor}/><div><p className="text-sm font-medium">{member.name}</p><p className="text-xs text-slate-400">{member.phone}</p></div></div></td><td className="w-40 px-4 py-3">{editable?<SelectField disabled={busy===member.id} value={member.role} onChange={value=>void update(member,{role:value as ProjectMemberRole})} size="small" options={[{value:"MEMBER",label:"项目成员"},{value:"GUEST",label:"项目访客"},...(data.permissions.canAssignManagers?[{value:"MANAGER",label:"项目经理"},{value:"OWNER",label:"项目所有者"}]:[])]}/>:<span className={`rounded-full px-2.5 py-1 text-xs ${projectRoleClass[member.role]}`}>{member.roleLabel}</span>}</td><td className="px-4 py-3">{editable?<input key={`${member.id}-${member.responsibility}`} defaultValue={member.responsibility||""} onBlur={event=>{if(event.target.value.trim()!==(member.responsibility||""))void update(member,{responsibility:event.target.value.trim()||null});}} className="h-9 w-full min-w-52 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" placeholder="填写工作职责"/>:<span className="text-sm text-slate-500">{member.responsibility||"暂未设置"}</span>}</td><td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{data.project.team.name}</span></td><td className="px-5 py-3 text-right">{editable&&<button disabled={busy===member.id} onClick={()=>void remove(member)} title="移出项目" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16}/></button>}</td></tr>})}</tbody></table></div></section>
    {open&&<PullTeamMembers projectId={project.id} teamName={data.project.team.name} members={available} canAssignManagers={data.permissions.canAssignManagers} onClose={()=>setOpen(false)} onAdded={async()=>{setOpen(false);await load();}}/>}
  </div>;
}

function PullTeamMembers({projectId,teamName,members,canAssignManagers,onClose,onAdded}:{projectId:string;teamName:string;members:ProjectTeamData["teamMembers"];canAssignManagers:boolean;onClose:()=>void;onAdded:()=>Promise<void>}){
  const [selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(""),[role,setRole]=useState<ProjectMemberRole>("MEMBER"),[responsibility,setResponsibility]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const filtered=members.filter(member=>`${member.name}${member.phone}${member.teamRoleLabel}`.toLowerCase().includes(query.toLowerCase()));
  function toggle(userId:string){setSelected(value=>value.includes(userId)?value.filter(id=>id!==userId):[...value,userId]);}
  async function submit(){if(!selected.length)return setError("请至少选择一位团队成员");setLoading(true);setError("");try{await projectRequest(`/api/projects/${projectId}/members`,{method:"POST",body:JSON.stringify({userIds:selected,role,responsibility})});await onAdded();}catch(e){setError(e instanceof Error?e.message:"拉入失败");setLoading(false);}}
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><div role="dialog" aria-modal="true" aria-label="从团队拉入成员" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center"><div><h3 className="text-lg font-semibold">从团队拉入成员</h3><p className="mt-1 text-xs text-slate-400">成员来源：{teamName}</p></div><button onClick={onClose} aria-label="关闭" className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19}/></button></div><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} className="field pl-9" placeholder="搜索团队成员"/></div><div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-200"><div className="divide-y divide-slate-100">{filtered.map(member=><button type="button" key={member.userId} onClick={()=>toggle(member.userId)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"><span className={`grid size-5 shrink-0 place-items-center rounded border ${selected.includes(member.userId)?"border-blue-600 bg-blue-600 text-white":"border-slate-300 bg-white"}`}>{selected.includes(member.userId)&&<Check size={13}/>}</span><ProjectAvatar name={member.name} color={member.avatarColor}/><div><p className="text-sm font-medium">{member.name}</p><p className="text-xs text-slate-400">{member.phone}</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{member.teamRoleLabel}</span></button>)}{!filtered.length&&<div className="p-10 text-center text-sm text-slate-400">{members.length?"没有匹配的团队成员":"团队中的成员都已加入项目"}</div>}</div></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-medium">项目角色</span><SelectField value={role} onChange={value=>setRole(value as ProjectMemberRole)} options={[{value:"MEMBER",label:"项目成员"},{value:"GUEST",label:"项目访客"},...(canAssignManagers?[{value:"MANAGER",label:"项目经理"},{value:"OWNER",label:"项目所有者"}]:[])]}/></label><label><span className="mb-2 block text-sm font-medium">统一职责（可选）</span><input value={responsibility} onChange={event=>setResponsibility(event.target.value)} maxLength={120} className="field" placeholder="例如：前端开发"/></label></div>{error&&<div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<div className="mt-5 flex items-center justify-end gap-2"><span className="mr-auto text-sm text-slate-500">已选择 {selected.length} 人</span><button onClick={onClose} className="secondary-button">取消</button><button disabled={loading||!selected.length} onClick={()=>void submit()} className="primary-button disabled:opacity-50">{loading?<LoaderCircle className="animate-spin" size={16}/>:<UserPlus size={16}/>}拉入项目</button></div></div></div>;
}

function ProjectAvatar({name,color}:{name:string;color:string}){return <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ring-2 ring-white" style={{backgroundColor:color}}>{name.slice(-1)}</span>}

const projectDateInput = (value: string | null) => value ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : "";
const projectDateIso = (value: string) => value ? new Date(`${value}T00:00:00+08:00`).toISOString() : null;

function EditProject({ project, onClose, onSaved }: { project: Project; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(project.name), [description, setDescription] = useState(project.description), [status, setStatus] = useState(project.status), [startDate, setStartDate] = useState(projectDateInput(project.startDate)), [endDate, setEndDate] = useState(projectDateInput(project.endDate)), [saving, setSaving] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try { await projectRequest(`/api/projects/${project.id}`, { method: "PATCH", body: JSON.stringify({ name, description, status, startDate: projectDateIso(startDate), endDate: projectDateIso(endDate) }) }); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); setSaving(false); }
  }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form onSubmit={submit} className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start"><div><h3 className="text-lg font-semibold">编辑项目基本信息</h3><p className="mt-1 text-sm text-slate-500">项目标识和所属团队创建后不可修改</p></div><button type="button" onClick={onClose} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="sm:col-span-2"><span className="mb-2 block text-sm font-medium">项目名称</span><input required minLength={2} maxLength={60} className="field" value={name} onChange={(event) => setName(event.target.value)}/></label><label><span className="mb-2 block text-sm font-medium">项目标识</span><input disabled className="field bg-slate-50 text-slate-400" value={project.code}/></label><label><span className="mb-2 block text-sm font-medium">所属团队</span><input disabled className="field bg-slate-50 text-slate-400" value={project.team.name}/></label><label><span className="mb-2 block text-sm font-medium">项目状态</span><SelectField value={status} onChange={setStatus} options={[{value:"ACTIVE",label:"进行中"},{value:"PAUSED",label:"已暂停"},{value:"COMPLETED",label:"已完成"},{value:"ARCHIVED",label:"已归档"}]}/></label><div/><label><span className="mb-2 block text-sm font-medium">开始日期</span><input type="date" className="field" value={startDate} onChange={(event) => setStartDate(event.target.value)}/></label><label><span className="mb-2 block text-sm font-medium">结束日期</span><input type="date" className="field" value={endDate} onChange={(event) => setEndDate(event.target.value)}/></label><label className="sm:col-span-2"><span className="mb-2 block text-sm font-medium">项目说明</span><textarea maxLength={300} className="field min-h-24 resize-y" value={description} onChange={(event) => setDescription(event.target.value)}/><span className="mt-1 block text-right text-xs text-slate-400">{description.length}/300</span></label></div>{error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="secondary-button">取消</button><button disabled={saving} className="primary-button">{saving && <LoaderCircle className="animate-spin" size={16}/>}保存修改</button></div></form></div>;
}

function DeleteProject({ project, onClose, onDeleted }: { project: Project; onClose: () => void; onDeleted: () => void }) {
  const [confirmation, setConfirmation] = useState(""), [deleting, setDeleting] = useState(false), [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setDeleting(true); setError("");
    try { await projectRequest(`/api/projects/${project.id}`, { method: "DELETE", body: JSON.stringify({ confirmName: confirmation }) }); onDeleted(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "删除失败"); setDeleting(false); }
  }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><form onSubmit={submit} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle size={21}/></span><div><h3 className="text-lg font-semibold">删除项目</h3><p className="mt-1 text-sm leading-6 text-slate-500">此操作会永久删除项目中的需求、任务、Bug、版本、成员关系和项目文件，无法恢复。</p></div><button type="button" onClick={onClose} className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={18}/></button></div><div className="mt-5 rounded-xl border border-rose-100 bg-rose-50/60 p-4 text-sm text-slate-600">请输入项目名称 <b className="text-slate-900">{project.name}</b> 确认删除。</div><label className="mt-4 block"><span className="mb-2 block text-sm font-medium">项目名称</span><input autoFocus className="field" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={project.name}/></label>{error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<div className="mt-6 flex justify-end gap-2"><button type="button" onClick={onClose} className="secondary-button">取消</button><button disabled={deleting || confirmation !== project.name} className="inline-flex h-10 items-center gap-2 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{deleting && <LoaderCircle className="animate-spin" size={16}/>}永久删除</button></div></form></div>;
}

function CreateProject({
  teams,
  onClose,
  onCreated,
}: {
  teams: Team[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [teamId, setTeamId] = useState(teams[0]?.id || ""),
    [name, setName] = useState(""),
    [code, setCode] = useState(""),
    [description, setDescription] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, name, code, description }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "创建失败");
      onCreated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
      setLoading(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-center">
          <h3 className="text-lg font-semibold">新建项目</h3>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto p-2 text-slate-400"
          >
            <X size={19} />
          </button>
        </div>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-medium">所属团队</span>
            <SelectField
              value={teamId}
              onChange={setTeamId}
              options={teams.map((team) => ({ value: team.id, label: team.name }))}
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">项目名称</span>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：移动端重构"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">项目标识</span>
            <input
              className="field uppercase"
              value={code}
              onChange={(e) =>
                setCode(
                  e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 12),
                )
              }
              placeholder="例如：MOBILE"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-sm font-medium">
              项目说明（可选）
            </span>
            <textarea
              className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          {error && (
            <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="secondary-button"
            >
              取消
            </button>
            <button disabled={loading} className="primary-button">
              {loading ? (
                <LoaderCircle className="animate-spin" size={17} />
              ) : (
                <Plus size={17} />
              )}
              创建项目
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
