"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  Bug,
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
          <Link
            href={`/projects/${project.id}`}
            key={project.id}
            className="card group p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className="flex items-start">
              <span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <FolderKanban size={21} />
              </span>
              <MoreHorizontal className="ml-auto text-slate-400" size={19} />
            </div>
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
  if (section === "team") return <ProjectTeam project={project} />;
  if (section === "overview")
    return (
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "需求", value: "18", note: "14 项已确认", icon: Target },
            {
              label: "任务",
              value: String(project.taskCount),
              note: "5 项进行中",
              icon: ListChecks,
            },
            {
              label: "未关闭 Bug",
              value: "7",
              note: "1 个严重问题",
              icon: Bug,
            },
            {
              label: "当前版本",
              value: "V0.9",
              note: "完成度 72%",
              icon: Rocket,
            },
          ].map((item) => (
            <div className="card p-5" key={item.label}>
              <div className="flex items-start">
                <span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-600">
                  <item.icon size={19} />
                </span>
                <span className="ml-auto text-2xl font-bold">{item.value}</span>
              </div>
              <p className="mt-4 text-sm font-medium">{item.label}</p>
              <p className="mt-1 text-xs text-slate-400">{item.note}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
          <section className="card p-5">
            <h3 className="font-semibold">项目进度</h3>
            <div className="mt-5 h-2 rounded-full bg-slate-100">
              <div className="h-full w-[68%] rounded-full bg-blue-500" />
            </div>
            <div className="mt-3 flex justify-between text-xs text-slate-500">
              <span>范围完成度</span>
              <b className="text-blue-600">68%</b>
            </div>
          </section>
          <section className="card p-5">
            <h3 className="font-semibold">需要关注</h3>
            <div className="mt-4 space-y-3">
              {[
                "2 项任务已超过截止时间",
                "1 个严重 Bug 等待验证",
                "V0.9 计划 9月5日发布",
              ].map((text, index) => (
                <div
                  key={text}
                  className="flex items-start gap-2 text-sm text-slate-600"
                >
                  {index < 2 ? (
                    <AlertTriangle
                      className="mt-0.5 shrink-0 text-amber-500"
                      size={16}
                    />
                  ) : (
                    <CheckCircle2
                      className="mt-0.5 shrink-0 text-emerald-500"
                      size={16}
                    />
                  )}
                  <span>{text}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    );
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
  }[section];
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
    <section className="card overflow-hidden"><div className="border-b border-slate-100 px-5 py-4"><h4 className="font-semibold">项目成员</h4><p className="mt-0.5 text-xs text-slate-400">外部团队身份不自动获得项目访问权；拉入项目后单独分配角色和工作职责</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead><tr className="bg-slate-50/70 text-xs text-slate-400"><th className="px-5 py-3 font-medium">成员</th><th className="px-4 py-3 font-medium">项目角色</th><th className="px-4 py-3 font-medium">工作职责</th><th className="px-4 py-3 font-medium">来源团队</th><th className="px-5 py-3"></th></tr></thead><tbody>{data.members.map(member=>{const elevated=member.role==="OWNER"||member.role==="MANAGER";const editable=data.permissions.canManage&&(data.permissions.canAssignManagers||!elevated);return <tr key={member.id} className="border-t border-slate-100"><td className="px-5 py-3"><div className="flex items-center gap-3"><ProjectAvatar name={member.name} color={member.avatarColor}/><div><p className="text-sm font-medium">{member.name}</p><p className="text-xs text-slate-400">{member.phone}</p></div></div></td><td className="px-4 py-3">{editable?<select disabled={busy===member.id} value={member.role} onChange={event=>void update(member,{role:event.target.value as ProjectMemberRole})} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs outline-none"><option value="MEMBER">项目成员</option><option value="GUEST">项目访客</option>{data.permissions.canAssignManagers&&<><option value="MANAGER">项目经理</option><option value="OWNER">项目所有者</option></>}</select>:<span className={`rounded-full px-2.5 py-1 text-xs ${projectRoleClass[member.role]}`}>{member.roleLabel}</span>}</td><td className="px-4 py-3">{editable?<input key={`${member.id}-${member.responsibility}`} defaultValue={member.responsibility||""} onBlur={event=>{if(event.target.value.trim()!==(member.responsibility||""))void update(member,{responsibility:event.target.value.trim()||null});}} className="h-9 w-full min-w-52 rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400" placeholder="填写工作职责"/>:<span className="text-sm text-slate-500">{member.responsibility||"暂未设置"}</span>}</td><td className="px-4 py-3"><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs text-blue-700">{data.project.team.name}</span></td><td className="px-5 py-3 text-right">{editable&&<button disabled={busy===member.id} onClick={()=>void remove(member)} title="移出项目" className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"><Trash2 size={16}/></button>}</td></tr>})}</tbody></table></div></section>
    {open&&<PullTeamMembers projectId={project.id} teamName={data.project.team.name} members={available} canAssignManagers={data.permissions.canAssignManagers} onClose={()=>setOpen(false)} onAdded={async()=>{setOpen(false);await load();}}/>}
  </div>;
}

function PullTeamMembers({projectId,teamName,members,canAssignManagers,onClose,onAdded}:{projectId:string;teamName:string;members:ProjectTeamData["teamMembers"];canAssignManagers:boolean;onClose:()=>void;onAdded:()=>Promise<void>}){
  const [selected,setSelected]=useState<string[]>([]),[query,setQuery]=useState(""),[role,setRole]=useState<ProjectMemberRole>("MEMBER"),[responsibility,setResponsibility]=useState(""),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const filtered=members.filter(member=>`${member.name}${member.phone}${member.teamRoleLabel}`.toLowerCase().includes(query.toLowerCase()));
  function toggle(userId:string){setSelected(value=>value.includes(userId)?value.filter(id=>id!==userId):[...value,userId]);}
  async function submit(){if(!selected.length)return setError("请至少选择一位团队成员");setLoading(true);setError("");try{await projectRequest(`/api/projects/${projectId}/members`,{method:"POST",body:JSON.stringify({userIds:selected,role,responsibility})});await onAdded();}catch(e){setError(e instanceof Error?e.message:"拉入失败");setLoading(false);}}
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 p-4" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><div role="dialog" aria-modal="true" aria-label="从团队拉入成员" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"><div className="mb-5 flex items-center"><div><h3 className="text-lg font-semibold">从团队拉入成员</h3><p className="mt-1 text-xs text-slate-400">成员来源：{teamName}</p></div><button onClick={onClose} aria-label="关闭" className="ml-auto rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X size={19}/></button></div><div className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16}/><input value={query} onChange={event=>setQuery(event.target.value)} className="field pl-9" placeholder="搜索团队成员"/></div><div className="mt-4 max-h-72 overflow-y-auto rounded-xl border border-slate-200"><div className="divide-y divide-slate-100">{filtered.map(member=><button type="button" key={member.userId} onClick={()=>toggle(member.userId)} className="flex w-full items-center gap-3 p-3 text-left hover:bg-slate-50"><span className={`grid size-5 shrink-0 place-items-center rounded border ${selected.includes(member.userId)?"border-blue-600 bg-blue-600 text-white":"border-slate-300 bg-white"}`}>{selected.includes(member.userId)&&<Check size={13}/>}</span><ProjectAvatar name={member.name} color={member.avatarColor}/><div><p className="text-sm font-medium">{member.name}</p><p className="text-xs text-slate-400">{member.phone}</p></div><span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-500">{member.teamRoleLabel}</span></button>)}{!filtered.length&&<div className="p-10 text-center text-sm text-slate-400">{members.length?"没有匹配的团队成员":"团队中的成员都已加入项目"}</div>}</div></div><div className="mt-4 grid gap-4 sm:grid-cols-2"><label><span className="mb-2 block text-sm font-medium">项目角色</span><select value={role} onChange={event=>setRole(event.target.value as ProjectMemberRole)} className="field"><option value="MEMBER">项目成员</option><option value="GUEST">项目访客</option>{canAssignManagers&&<><option value="MANAGER">项目经理</option><option value="OWNER">项目所有者</option></>}</select></label><label><span className="mb-2 block text-sm font-medium">统一职责（可选）</span><input value={responsibility} onChange={event=>setResponsibility(event.target.value)} maxLength={120} className="field" placeholder="例如：前端开发"/></label></div>{error&&<div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<div className="mt-5 flex items-center justify-end gap-2"><span className="mr-auto text-sm text-slate-500">已选择 {selected.length} 人</span><button onClick={onClose} className="secondary-button">取消</button><button disabled={loading||!selected.length} onClick={()=>void submit()} className="primary-button disabled:opacity-50">{loading?<LoaderCircle className="animate-spin" size={16}/>:<UserPlus size={16}/>}拉入项目</button></div></div></div>;
}

function ProjectAvatar({name,color}:{name:string;color:string}){return <span className="grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ring-2 ring-white" style={{backgroundColor:color}}>{name.slice(-1)}</span>}

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
            <select
              className="field"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
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
