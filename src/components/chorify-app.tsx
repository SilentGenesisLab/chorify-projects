"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AuthPage } from "@/components/auth-page";
import { InvitePage } from "@/components/invite-page";
import { ProjectsPage } from "@/components/projects-page";
import { TeamManagement } from "@/components/team-management";
import { ApiKeyPage } from "@/components/api-key-page";
import { AuditLogPage } from "@/components/audit-log-page";
import { MyTasksPage } from "@/components/my-tasks-page";
import { FileManager } from "@/components/file-manager";
import { FileSharePage } from "@/components/file-share-page";
import { SelectField } from "@/components/ui/select-field";
import {
  Activity,
  AlertTriangle,
  Bell,
  Bug,
  ChevronDown,
  ClipboardCheck,
  Folder,
  KeyRound,
  Layers3,
  LayoutDashboard,
  ListChecks,
  Menu,
  MoreHorizontal,
  Plus,
  Rocket,
  Search,
  LogOut,
  Moon,
  Sun,
  HelpCircle,
  Settings,
  Camera,
  ShieldCheck,
  Smartphone,
  LoaderCircle,
  ExternalLink,
  ChevronUp,
  Upload,
  CheckCircle2,
  Target,
  Users,
  X,
} from "lucide-react";

const navigation = [
  { label: "仪表盘", href: "/", icon: LayoutDashboard },
  { label: "团队管理", href: "/teams", icon: Users },
  { label: "项目管理", href: "/projects", icon: Layers3 },
  { label: "我的任务", href: "/my-tasks", icon: ListChecks },
  { label: "文件管理", href: "/files", icon: Folder },
];

const routeTitles: Record<string, string> = {
  dashboard: "仪表盘",
  projects: "项目管理",
  files: "文件管理",
  "my-tasks": "我的任务",
  tasks: "我的任务",
  requirements: "需求管理",
  bugs: "Bug 管理",
  versions: "版本与发布",
  teams: "团队管理",
  keys: "API Key",
  logs: "操作日志",
  login: "登录",
  register: "注册",
};

const statusStyle: Record<string, string> = {
  进行中: "bg-blue-50 text-blue-700",
  待处理: "bg-slate-100 text-slate-600",
  待验收: "bg-amber-50 text-amber-700",
  需修改: "bg-amber-50 text-amber-700",
  已完成: "bg-emerald-50 text-emerald-700",
  紧急: "bg-rose-50 text-rose-700",
  高: "bg-rose-50 text-rose-700",
  中: "bg-amber-50 text-amber-700",
  低: "bg-slate-100 text-slate-600",
  正常: "bg-emerald-50 text-emerald-700",
  有风险: "bg-rose-50 text-rose-700",
};

function Status({ children }: { children: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusStyle[children] || "bg-violet-50 text-violet-700"}`}
    >
      {children}
    </span>
  );
}

function Avatar({
  name,
  color = "bg-blue-600",
  src,
}: {
  name: string;
  color?: string;
  src?: string | null;
}) {
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() || "用";
  return (
    <span
      className={`inline-grid size-8 shrink-0 place-items-center rounded-full ${color} text-xs font-semibold text-white ring-2 ring-white`}
    >
      {src ? <Image src={src} alt="" width={32} height={32} unoptimized className="size-full rounded-full object-cover" /> : initial}
    </span>
  );
}

function Sidebar({
  route,
  open,
  onClose,
  user,
}: {
  route: string;
  open: boolean;
  onClose: () => void;
  user?: { name: string; role: string; avatarUrl?: string | null };
}) {
  const router = useRouter();
  const [accountOpen, setAccountOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  function setTheme(theme: "light" | "dark") {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("chorify-theme", theme);
    setAccountOpen(false);
  }
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <>
      {open && (
        <button
          aria-label="关闭导航"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-slate-950/20 lg:hidden"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#e1e8f2] bg-white transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-[72px] items-center gap-3 border-b border-[#edf1f6] px-5">
          <Image
            src="/chorify-logo.png"
            alt="AI Native 团队协同开发系统"
            width={36}
            height={36}
            className="size-9 object-contain"
          />
          <div>
            <div className="text-[17px] font-bold tracking-tight text-[#17223b]">
              AI Native
            </div>
            <div className="-mt-0.5 text-[10px] font-semibold tracking-[.08em] text-[#376ce7]">
              团队协同开发系统
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto text-slate-400 lg:hidden"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="scrollbar-none flex-1 overflow-y-auto px-3 py-5">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">
            工作空间
          </p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const itemRoute = item.href.slice(1);
            const active =
              route === itemRoute ||
              route.startsWith(`${itemRoute}/`) ||
              (route === "dashboard" && item.href === "/");
            return (
              <div key={item.label} className="mb-1">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium transition ${active ? "bg-[#edf3ff] text-[#2458ce]" : "text-[#5f6c83] hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
          <p className="mb-2 mt-6 px-3 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">
            系统管理
          </p>
          {[
            { label: "API Key", href: "/keys", icon: KeyRound },
            { label: "操作日志", href: "/logs", icon: Activity },
          ].map((item) => {
            const Icon = item.icon;
            const active =
              route === item.href.slice(1) ||
              route.startsWith(`${item.href.slice(1)}/`);
            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={onClose}
                className={`mb-1 flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] font-medium ${active ? "bg-[#edf3ff] text-[#2458ce]" : "text-[#5f6c83] hover:bg-slate-50"}`}
              >
                <Icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="relative border-t border-[#edf1f6] p-3">
          {accountOpen && <>
            <button aria-label="关闭账户菜单" onClick={()=>setAccountOpen(false)} className="fixed inset-0 z-40 cursor-default"/>
            <div className="absolute bottom-[76px] left-3 right-3 z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_55px_rgba(15,23,42,.18)]">
              <div className="mb-1 border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-semibold">{user?.name || "当前用户"}</p><p className="mt-0.5 text-xs text-slate-400">{user?.role || "项目成员"}</p></div>
              <div className="px-2 py-2"><p className="mb-2 text-[11px] font-medium text-slate-400">显示模式</p><div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"><button onClick={()=>setTheme("light")} className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-white text-xs font-medium text-slate-700 shadow-sm"><Sun size={14}/>浅色</button><button onClick={()=>setTheme("dark")} className="flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs font-medium text-slate-600"><Moon size={14}/>深色</button></div></div>
              <button onClick={()=>{setAccountOpen(false);setSettingsOpen(true)}} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50"><Settings size={17}/>个人设置</button>
              <button onClick={()=>{setAccountOpen(false);setFeedbackOpen(true)}} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50"><HelpCircle size={17}/>帮助与反馈</button>
              <a href="https://official.sligenai.cn/" target="_blank" rel="noopener noreferrer" onClick={()=>setAccountOpen(false)} className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-50"><ExternalLink size={17}/>洞墟官网<ExternalLink className="ml-auto text-slate-300" size={13}/></a>
              <button onClick={()=>void logout()} className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-rose-600 hover:bg-rose-50"><LogOut size={17}/>退出登录</button>
            </div>
          </>}
          <button onClick={()=>setAccountOpen((value)=>!value)} className="flex w-full items-center gap-3 rounded-xl p-1 text-left hover:bg-slate-50">
            <Avatar name={user?.name || "用户"} src={user?.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {user?.name || "当前用户"}
              </p>
              <p className="truncate text-xs text-slate-400">
                {user?.role || "项目成员"}
              </p>
            </div>
            <ChevronUp className={`text-slate-400 transition ${accountOpen?"rotate-180":""}`} size={17}/>
          </button>
        </div>
      </aside>
      {feedbackOpen && <FeedbackModal close={()=>setFeedbackOpen(false)}/>}
      {settingsOpen && <PersonalSettingsModal close={()=>setSettingsOpen(false)}/>}
    </>
  );
}

type AccountProfile = { name:string; phone:string; maskedPhone:string; avatarColor:string; avatarUrl:string|null };

function PersonalSettingsModal({close}:{close:()=>void}) {
  const router=useRouter();
  const [tab,setTab]=useState<"profile"|"security">("profile"),[profile,setProfile]=useState<AccountProfile|null>(null);
  const [name,setName]=useState(""),[avatarUrl,setAvatarUrl]=useState<string|null>(null),[error,setError]=useState(""),[notice,setNotice]=useState(""),[busy,setBusy]=useState(false);
  const [passwordCode,setPasswordCode]=useState(""),[password,setPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState("");
  const [newPhone,setNewPhone]=useState(""),[phoneCode,setPhoneCode]=useState(""),[countdown,setCountdown]=useState(0);
  useEffect(()=>{fetch("/api/me").then(async response=>{const data=await response.json();if(!response.ok)throw new Error(data.error||"加载失败");setProfile(data.user);setName(data.user.name);setAvatarUrl(data.user.avatarUrl)}).catch(cause=>setError(cause instanceof Error?cause.message:"加载失败"))},[]);
  useEffect(()=>{if(!countdown)return;const timer=window.setInterval(()=>setCountdown(value=>Math.max(0,value-1)),1000);return()=>window.clearInterval(timer)},[countdown]);
  async function request(url:string,body:unknown){setError("");setNotice("");setBusy(true);try{const response=await fetch(url,{method:url==="/api/me"?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const data=await response.json();if(!response.ok)throw new Error(data.error||"操作失败");return data}catch(cause){setError(cause instanceof Error?cause.message:"操作失败");throw cause}finally{setBusy(false)}}
  async function sendCode(phone:string){if(!/^1\d{10}$/.test(phone)){setError("请输入正确的手机号");return}try{await request("/api/auth/sms/send",{phone});setCountdown(60);setNotice("验证码已发送，请在 5 分钟内使用")}catch{}}
  async function saveProfile(event:FormEvent){event.preventDefault();try{const data=await request("/api/me",{name,avatarUrl});setProfile(data.user);setNotice("个人资料已保存");router.refresh()}catch{}}
  async function changePassword(event:FormEvent){event.preventDefault();if(password!==confirmPassword)return setError("两次输入的密码不一致");try{await request("/api/me/password",{code:passwordCode,password});setPasswordCode("");setPassword("");setConfirmPassword("");setNotice("密码修改成功")}catch{}}
  async function changePhone(event:FormEvent){event.preventDefault();try{const data=await request("/api/me/phone",{phone:newPhone,code:phoneCode});setProfile(value=>value?{...value,phone:newPhone,maskedPhone:data.maskedPhone}:value);setNewPhone("");setPhoneCode("");setNotice("手机号换绑成功")}catch{}}
  function pickAvatar(file?:File){if(!file)return;if(!["image/png","image/jpeg","image/webp"].includes(file.type))return setError("仅支持 PNG、JPEG 或 WebP 图片");if(file.size>512*1024)return setError("头像不能超过 512KB");const reader=new FileReader();reader.onload=()=>{setAvatarUrl(String(reader.result));setError("")};reader.readAsDataURL(file)}
  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm"><button aria-label="关闭个人设置" onClick={close} className="absolute inset-0"/><section role="dialog" aria-modal="true" aria-labelledby="personal-settings-title" className="relative my-4 max-h-[92vh] w-full max-w-[820px] overflow-y-auto rounded-3xl border border-white/70 bg-white shadow-2xl"><header className="flex items-center px-6 pb-4 pt-6 sm:px-8"><h2 id="personal-settings-title" className="text-xl font-bold">个人设置</h2><button onClick={close} aria-label="关闭" className="ml-auto rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X size={22}/></button></header><div className="mx-6 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-50 p-1.5 sm:mx-8"><button onClick={()=>{setTab("profile");setError("");setNotice("")}} className={`flex h-10 min-w-28 items-center justify-center gap-2 rounded-xl px-4 text-sm ${tab==="profile"?"bg-white font-semibold text-slate-900 shadow-sm":"text-slate-500"}`}><Settings size={16}/>资料</button><button onClick={()=>{setTab("security");setError("");setNotice("")}} className={`flex h-10 min-w-28 items-center justify-center gap-2 rounded-xl px-4 text-sm ${tab==="security"?"bg-white font-semibold text-slate-900 shadow-sm":"text-slate-500"}`}><ShieldCheck size={16}/>安全设置</button></div>{!profile?<div className="grid min-h-72 place-items-center"><LoaderCircle className="animate-spin text-blue-600"/></div>:<div className="p-6 sm:p-8">{notice&&<div role="status" className="mb-5 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}{error&&<div role="alert" className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}{tab==="profile"?<form onSubmit={saveProfile} className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-full bg-blue-600 text-2xl font-semibold text-white ring-4 ring-blue-50">{avatarUrl?<Image src={avatarUrl} alt="头像预览" width={80} height={80} unoptimized className="size-full object-cover"/>:Array.from(name)[0]||"用"}</span><div><label className="secondary-button cursor-pointer"><Camera size={16}/>上传头像<input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={event=>pickAvatar(event.target.files?.[0])}/></label>{avatarUrl&&<button type="button" onClick={()=>setAvatarUrl(null)} className="ml-2 text-sm text-slate-500 hover:text-rose-600">移除</button>}<p className="mt-2 text-xs text-slate-400">PNG、JPEG 或 WebP，不超过 512KB</p></div></div><label className="block"><span className="mb-2 block text-sm font-medium">账户名</span><input className="field" value={name} onChange={event=>setName(event.target.value)} minLength={2} maxLength={40} required/></label><div><p className="text-sm font-medium">当前手机号</p><p className="mt-2 text-sm text-slate-500">{profile.maskedPhone}</p></div><button disabled={busy} className="primary-button disabled:opacity-60">{busy?"保存中…":"保存资料"}</button></form>:<div className="space-y-8"><form onSubmit={changePassword} className="space-y-4"><div><h3 className="font-semibold">修改密码</h3><p className="mt-1 text-sm text-slate-500">验证码将发送到当前账户手机 {profile.maskedPhone}</p></div><CodeField code={passwordCode} setCode={setPasswordCode} onSend={()=>void sendCode(profile.phone)} countdown={countdown}/><label className="block"><span className="mb-2 block text-sm font-medium">新密码</span><input type="password" autoComplete="new-password" className="field" value={password} onChange={event=>setPassword(event.target.value)} placeholder="至少 8 位，需包含字母和数字" required/></label><label className="block"><span className="mb-2 block text-sm font-medium">确认新密码</span><input type="password" autoComplete="new-password" className="field" value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required/></label><button disabled={busy} className="primary-button disabled:opacity-60">修改密码</button></form><div className="border-t border-slate-100"/><form onSubmit={changePhone} className="space-y-4"><div><h3 className="flex items-center gap-2 font-semibold"><Smartphone size={18}/>换绑手机号</h3><p className="mt-1 text-sm text-slate-500">新手机号验证成功后立即生效</p></div><label className="block"><span className="mb-2 block text-sm font-medium">新手机号</span><input inputMode="tel" className="field" value={newPhone} onChange={event=>setNewPhone(event.target.value.replace(/\D/g,"").slice(0,11))} placeholder="请输入 11 位手机号" required/></label><CodeField code={phoneCode} setCode={setPhoneCode} onSend={()=>void sendCode(newPhone)} countdown={countdown}/><button disabled={busy} className="primary-button disabled:opacity-60">确认换绑</button></form></div>}</div>}</section></div>
}

function CodeField({code,setCode,onSend,countdown}:{code:string;setCode:(value:string)=>void;onSend:()=>void;countdown:number}) { return <label className="block"><span className="mb-2 block text-sm font-medium">验证码</span><span className="flex gap-2"><input inputMode="numeric" className="field" value={code} onChange={event=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} placeholder="6 位数字" required/><button type="button" onClick={onSend} disabled={countdown>0} className="secondary-button min-w-28 disabled:opacity-50">{countdown?`${countdown}s 后重试`:"获取验证码"}</button></span></label> }

function FeedbackModal({ close }: { close: () => void }) {
  const [type,setType]=useState("PRODUCT"), [content,setContent]=useState(""), [files,setFiles]=useState<File[]>([]);
  const [error,setError]=useState(""), [sending,setSending]=useState(false), [success,setSuccess]=useState(false);
  async function submit(event:FormEvent){event.preventDefault();setError("");if(content.trim().length<5)return setError("请至少输入 5 个字符的反馈内容");setSending(true);try{const body=new FormData();body.set("type",type);body.set("content",content.trim());files.forEach((file)=>body.append("files",file));const response=await fetch("/api/feedback",{method:"POST",body});const data=await response.json();if(!response.ok)throw new Error(data.error||"提交失败");setSuccess(true)}catch(cause){setError(cause instanceof Error?cause.message:"提交失败")}finally{setSending(false)}}
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/35 p-4 backdrop-blur-sm"><button aria-label="关闭反馈" onClick={close} className="absolute inset-0"/><section role="dialog" aria-modal="true" className="relative w-full max-w-[560px] overflow-hidden rounded-2xl border border-white/70 bg-white shadow-2xl"><header className="flex items-center border-b px-6 py-4"><div><h3 className="text-lg font-semibold">帮助与反馈</h3><p className="mt-0.5 text-xs text-slate-400">你的建议将帮助我们持续改善产品体验</p></div><button onClick={close} className="ml-auto text-slate-400"><X size={20}/></button></header>{success?<div className="px-6 py-14 text-center"><CheckCircle2 className="mx-auto text-emerald-500" size={42}/><h4 className="mt-4 font-semibold">反馈提交成功</h4><p className="mt-1 text-sm text-slate-500">感谢你的建议，我们会认真查看。</p><button onClick={close} className="primary-button mt-6">完成</button></div>:<form onSubmit={submit} className="space-y-5 p-6"><label className="block"><span className="mb-2 block text-sm font-medium">反馈类型</span><SelectField value={type} onChange={setType} options={[{value:"PRODUCT",label:"产品建议"},{value:"BUG",label:"问题反馈"},{value:"EXPERIENCE",label:"体验优化"},{value:"OTHER",label:"其他"}]}/></label><label className="block"><span className="mb-2 block text-sm font-medium">反馈内容</span><textarea value={content} onChange={(event)=>setContent(event.target.value.slice(0,2000))} rows={6} className="w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-blue-500 focus:ring-3 focus:ring-blue-100" placeholder="请描述你遇到的问题、建议或期望……"/><span className="mt-1 block text-right text-xs text-slate-400">{content.length}/2000</span></label><label className="block"><span className="mb-2 block text-sm font-medium">附件 <i className="font-normal not-italic text-slate-400">（最多 3 个，单个不超过 5MB）</i></span><span className="flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 hover:border-blue-400 hover:bg-blue-50/50"><Upload size={20} className="mb-1 text-blue-500"/>点击选择文件<input type="file" multiple className="hidden" onChange={(event)=>{const next=Array.from(event.target.files||[]).slice(0,3);setFiles(next);setError(next.some((file)=>file.size>5*1024*1024)?"单个附件不能超过 5MB":"")}}/></span>{files.length>0&&<div className="mt-2 space-y-1">{files.map((file)=><div key={`${file.name}-${file.size}`} className="flex items-center rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="truncate">{file.name}</span><span className="ml-auto text-slate-400">{(file.size/1024).toFixed(0)} KB</span></div>)}</div>}</label>{error&&<div role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}<div className="flex justify-end gap-2"><button type="button" onClick={close} className="secondary-button">取消</button><button disabled={sending} className="primary-button disabled:opacity-60">{sending?"提交中…":"提交反馈"}</button></div></form>}</section></div>
}

function Header({ route, onMenu }: { route: string; onMenu: () => void }) {
  const rootRoute = route.split("/")[0];
  const [unread,setUnread]=useState(0);
  useEffect(()=>{fetch("/api/notifications/summary").then(x=>x.ok?x.json():{unread:0}).then(x=>setUnread(x.unread||0)).catch(()=>{})},[route]);
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-[#e5eaf1] bg-[#f8faff]/90 px-5 backdrop-blur md:px-8">
      <button onClick={onMenu} className="mr-3 text-slate-500 lg:hidden">
        <Menu size={22} />
      </button>
      <div>
        <p className="text-xs text-slate-400">AI Native 团队协同开发系统</p>
        <h1 className="text-[18px] font-semibold tracking-tight">
          {routeTitles[rootRoute] || "项目工作台"}
        </h1>
      </div>
      <div className="ml-auto hidden w-[260px] items-center gap-2 rounded-xl border border-[#e3e9f2] bg-white px-3 py-2 text-sm text-slate-400 md:flex">
        <Search size={16} />
        <span>搜索任务、项目或文件</span>
        <kbd className="ml-auto rounded border px-1.5 py-0.5 text-[10px]">
          ⌘ K
        </kbd>
      </div>
      <Link href="/teams"
        aria-label="通知"
        className="relative ml-3 grid size-10 place-items-center rounded-xl border border-[#e3e9f2] bg-white text-slate-500"
      >
        <Bell size={18} />
        {unread>0&&<i className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold not-italic text-white">{unread>99?"99+":unread}</i>}
      </Link>
    </header>
  );
}

function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const body = await response.json();
      if (response.status === 401) {
        router.replace("/login?next=%2F");
        return;
      }
      if (!response.ok) throw new Error(body.error || "仪表盘加载失败");
      setData(body);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "仪表盘加载失败");
    } finally {
      setLoading(false);
    }
  }, [router]);
  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  if (loading)
    return <div className="grid min-h-[520px] place-items-center text-slate-400"><div className="text-center"><Activity className="mx-auto mb-3 animate-pulse text-blue-500"/><p className="text-sm">正在汇总当前工作情况…</p></div></div>;
  if (error || !data)
    return <div className="card grid min-h-80 place-items-center p-8 text-center"><div><AlertTriangle className="mx-auto mb-3 text-rose-500"/><h2 className="font-semibold">仪表盘暂时无法加载</h2><p className="mt-1 text-sm text-slate-500">{error || "请稍后重试"}</p><button onClick={() => void load()} className="primary-button mx-auto mt-4">重新加载</button></div></div>;

  const generatedAt = new Date(data.generatedAt);
  const hour = Number(new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", hour: "2-digit", hour12: false }).format(generatedAt));
  const greeting = hour < 6 ? "夜深了" : hour < 12 ? "上午好" : hour < 18 ? "下午好" : "晚上好";
  const dateText = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(generatedAt).replace("星期", " · 星期");
  const summaryCards = [
    { l: "进行中的项目", v: data.summary.activeProjects, s: `本月新增 ${data.summary.newProjectsThisMonth} 个`, i: Layers3, c: "text-blue-600 bg-blue-50" },
    { l: "我的待办", v: data.summary.myOpenTasks, s: `${data.summary.dueToday} 项今天到期`, i: ListChecks, c: "text-violet-600 bg-violet-50" },
    { l: "待验收", v: data.summary.pendingAcceptance, s: "等待我处理的验收", i: ClipboardCheck, c: "text-amber-600 bg-amber-50" },
    { l: "延期风险", v: data.summary.overdueTasks, s: data.summary.overdueTasks ? "需要尽快处理" : "当前没有逾期任务", i: AlertTriangle, c: "text-rose-600 bg-rose-50" },
  ];
  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm text-slate-500">{dateText}</p>
          <h2 className="text-2xl font-bold tracking-tight text-[#17223b]">
            {greeting}，{data.user.name}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data.summary.activeProjects} 个项目正在推进，当前有 {data.summary.attentionCount} 项工作需要关注。
          </p>
        </div>
        <Link href="/projects" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#376ce7] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-200">
          <Plus size={17} />
          新建项目
        </Link>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((x) => (
          <div className="card p-5" key={x.l}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{x.l}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight">{x.v}</p>
              </div>
              <div
                className={`grid size-10 place-items-center rounded-xl ${x.c}`}
              >
                <x.i size={20} />
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">{x.s}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#edf1f5] px-5 py-4">
            <div>
              <h3 className="font-semibold">我的任务</h3>
              <p className="mt-0.5 text-xs text-slate-400">按截止时间排序</p>
            </div>
            <Link
              href="/my-tasks"
              className="text-sm font-medium text-blue-600"
            >
              查看全部
            </Link>
          </div>
          <DashboardTaskTable tasks={data.tasks} generatedAt={generatedAt} />
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">项目状态</h3>
              <p className="mt-0.5 text-xs text-slate-400">当前活跃项目</p>
            </div>
            <Link href="/projects" aria-label="查看全部项目" className="rounded-lg p-1 text-slate-400 hover:bg-slate-50 hover:text-blue-600"><MoreHorizontal size={18} /></Link>
          </div>
          {data.projects.length ? <div className="mt-5 space-y-5">
            {data.projects.map((project) => (
              <Link href={`/projects/${project.id}/overview`} className="block" key={project.id}>
                <div className="mb-2 flex items-center">
                  <span className="truncate text-sm font-medium">{project.name}</span>
                  <span className="ml-auto text-xs text-slate-400">{project.progress}%</span>
                  <span className="ml-2">
                    <Status>{project.health === "RISK" ? "有风险" : "正常"}</Status>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${project.health === "RISK" ? "bg-amber-500" : "bg-blue-500"}`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </Link>
            ))}
          </div> : <DashboardEmpty icon={Layers3} text="暂无正在推进的项目" />}
        </div>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold">版本进度</h3>
          {data.currentVersion ? <Link href={`/projects/${data.currentVersion.project.id}/versions`} className="mt-4 flex items-center gap-4 rounded-xl bg-[#f7f9fc] p-4 hover:bg-slate-100/80">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Rocket size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between">
                <p className="truncate font-medium">{data.currentVersion.name} · {data.currentVersion.project.name}</p>
                <span className="text-sm font-semibold text-blue-600">{data.currentVersion.progress}%</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {data.currentVersion.completedScope} / {data.currentVersion.totalScope} 项已完成 · {data.currentVersion.plannedAt ? `计划 ${shortDate(data.currentVersion.plannedAt)} 发布` : "暂未设置发布日期"}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-blue-500" style={{ width: `${data.currentVersion.progress}%` }} />
              </div>
            </div>
          </Link> : <DashboardEmpty icon={Rocket} text="暂无正在推进的版本" />}
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">最近动态</h3>
          {data.activities.length ? <div className="mt-4 space-y-4">
            {data.activities.map((activity, index) => (
              <div key={activity.id} className="flex gap-3">
                <div
                  className={`mt-1 size-2 rounded-full ${index % 3 === 0 ? "bg-blue-500" : index % 3 === 1 ? "bg-rose-400" : "bg-emerald-500"}`}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-600">{activity.actor?.name || "系统"} {activity.actionLabel} · {activity.project.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {relativeTime(activity.createdAt, generatedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div> : <DashboardEmpty icon={Activity} text="暂无项目动态" />}
        </div>
      </section>
    </div>
  );
}

type DashboardTask = {
  id: string; code: string; title: string; priority: string; status: string; dueAt: string | null; overdue: boolean;
  project: { id: string; code: string; name: string };
  assignee: { id: string; name: string; avatarColor: string } | null;
};
type DashboardData = {
  user: { id: string; name: string }; generatedAt: string;
  summary: { activeProjects: number; newProjectsThisMonth: number; myOpenTasks: number; dueToday: number; pendingAcceptance: number; overdueTasks: number; attentionCount: number };
  tasks: DashboardTask[];
  projects: Array<{ id: string; code: string; name: string; progress: number; health: "NORMAL" | "RISK" }>;
  currentVersion: null | { id: string; name: string; plannedAt: string | null; progress: number; completedScope: number; totalScope: number; project: { id: string; name: string } };
  activities: Array<{ id: string; actor: { id: string; name: string } | null; actionLabel: string; project: { id: string; name: string }; createdAt: string }>;
};
const dashboardStatus: Record<string, string> = { TODO: "待处理", IN_PROGRESS: "进行中", PENDING_ACCEPTANCE: "待验收", NEEDS_CHANGES: "需修改", ACCEPTED: "已完成", DONE: "已完成" };
const dashboardPriority: Record<string, string> = { LOW: "低", MEDIUM: "中", HIGH: "高", URGENT: "紧急" };
const shortDate = (value: string) => new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric" }).format(new Date(value));
const shanghaiDate = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
function relativeTime(value: string, now: Date) {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "刚刚";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分钟前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小时前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天前`;
  return shortDate(value);
}
function DashboardEmpty({ icon: Icon, text }: { icon: typeof Activity; text: string }) {
  return <div className="grid min-h-32 place-items-center text-center text-sm text-slate-400"><div><Icon className="mx-auto mb-2" size={22}/><p>{text}</p></div></div>;
}
function DashboardTaskTable({ tasks, generatedAt }: { tasks: DashboardTask[]; generatedAt: Date }) {
  if (!tasks.length) return <DashboardEmpty icon={CheckCircle2} text="当前没有待处理任务" />;
  return <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="border-b border-[#edf1f5] bg-[#fafbfd] text-[11px] uppercase tracking-wide text-slate-400"><th className="px-5 py-3 font-medium">任务</th><th className="px-4 py-3 font-medium">负责人</th><th className="px-4 py-3 font-medium">优先级</th><th className="px-4 py-3 font-medium">状态</th><th className="px-5 py-3 font-medium">截止</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id} className="border-b border-[#f0f3f7] last:border-0 hover:bg-slate-50/70"><td className="px-5 py-3.5"><Link href={`/projects/${task.project.id}/tasks`}><p className="text-sm font-medium">{task.title}</p><p className="mt-0.5 text-xs text-slate-400">{task.code} · {task.project.name}</p></Link></td><td className="px-4 py-3.5"><div className="flex items-center gap-2"><Avatar name={task.assignee?.name || "未分配"}/><span className="text-sm text-slate-600">{task.assignee?.name || "未分配"}</span></div></td><td className="px-4 py-3.5"><Status>{dashboardPriority[task.priority] || task.priority}</Status></td><td className="px-4 py-3.5"><Status>{dashboardStatus[task.status] || task.status}</Status></td><td className={`px-5 py-3.5 text-sm ${task.overdue ? "font-medium text-rose-600" : "text-slate-500"}`}>{task.dueAt ? `${task.overdue ? "已逾期 · " : shanghaiDate(new Date(task.dueAt)) === shanghaiDate(generatedAt) ? "今天 · " : ""}${shortDate(task.dueAt)}` : "未设置"}</td></tr>)}</tbody></table></div>;
}

function GenericPage({ route }: { route: string }) {
  const config: Record<
    string,
    { subtitle: string; action: string; icon: typeof Folder }
  > = {
    projects: {
      subtitle: "集中查看项目进度、成员与交付计划",
      action: "新建项目",
      icon: Layers3,
    },
    files: {
      subtitle: "跨项目查找、归档和引用文件",
      action: "上传文件",
      icon: Folder,
    },
    "my-tasks": {
      subtitle: "查看分配给我的跨项目任务、待验收与逾期事项",
      action: "新建任务",
      icon: ListChecks,
    },
    tasks: {
      subtitle: "查看分配给我的跨项目任务、待验收与逾期事项",
      action: "新建任务",
      icon: ListChecks,
    },
    requirements: {
      subtitle: "从业务目标到任务交付保持完整关联",
      action: "新建需求",
      icon: Target,
    },
    bugs: {
      subtitle: "跟踪问题从提出、修复、验证到上线",
      action: "提交 Bug",
      icon: Bug,
    },
    versions: {
      subtitle: "规划项目版本范围并记录每次发布",
      action: "新建版本",
      icon: Rocket,
    },
    keys: {
      subtitle: "授权 Codex 以当前真人用户身份读取和提交工作",
      action: "创建 API Key",
      icon: KeyRound,
    },
    logs: {
      subtitle: "查看项目关键变更与 API 操作记录",
      action: "导出日志",
      icon: Activity,
    },
  };
  const c = config[route] || config.projects;
  const Icon = c.icon;
  if (route === "files") return <FileManager />;
  if (route === "my-tasks" || route === "tasks")
    return <MyTasksPage />;
  const cards =
    route === "projects"
      ? [
          {
            n: "Chorify Projects",
            m: "8 位成员 · V0.9 内测版",
            p: 68,
            s: "正常",
          },
          { n: "官网重构", m: "5 位成员 · V2.1", p: 42, s: "有风险" },
          { n: "数据工作台", m: "4 位成员 · V1.4", p: 86, s: "正常" },
        ]
      : route === "versions"
        ? [
            {
              n: "V0.9 协作内测版",
              m: "25 项范围 · 9月5日",
              p: 72,
              s: "进行中",
            },
            {
              n: "V0.8 基础框架",
              m: "18 项范围 · 8月10日",
              p: 100,
              s: "已完成",
            },
          ]
        : [
            {
              n: routeTitles[route] + "示例一",
              m: "Chorify Projects · 刚刚更新",
              p: 64,
              s: "进行中",
            },
            {
              n: routeTitles[route] + "示例二",
              m: "官网重构 · 昨天更新",
              p: 35,
              s: "待处理",
            },
          ];
  return (
    <div className="space-y-5">
      <PageTitle
        title={routeTitles[route]}
        subtitle={c.subtitle}
        action={c.action}
      />
      <Filters />
      {route === "keys" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <b>安全提示：</b>
          密钥只在创建时显示一次。系统仅保存哈希，撤销后立即失效。
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((x, i) => (
          <article
            key={x.n}
            className="card p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start">
              <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
                <Icon size={21} />
              </div>
              <button className="ml-auto text-slate-400">
                <MoreHorizontal size={19} />
              </button>
            </div>
            <h3 className="mt-5 font-semibold">{x.n}</h3>
            <p className="mt-1 text-xs text-slate-400">{x.m}</p>
            <div className="mt-5 flex items-center gap-3">
              <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-blue-500"
                  style={{ width: `${x.p}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-500">{x.p}%</span>
            </div>
            <div className="mt-4 flex items-center">
              <Status>{x.s}</Status>
              <div className="ml-auto flex -space-x-2">
                <Avatar name={i ? "林舟" : "陈默"} />
                <Avatar name={i ? "苏禾" : "周青"} color="bg-violet-500" />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action: string;
}) {
  return (
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#376ce7] px-4 text-sm font-semibold text-white">
        <Plus size={17} />
        {action}
      </button>
    </div>
  );
}
function Filters() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex h-10 min-w-[220px] items-center gap-2 rounded-xl border border-[#e3e9f2] bg-white px-3 text-sm text-slate-400">
        <Search size={16} />
        搜索当前列表
      </div>
      {["全部项目", "全部状态", "负责人"].map((x) => (
        <button
          key={x}
          className="flex h-10 items-center gap-2 rounded-xl border border-[#e3e9f2] bg-white px-3 text-sm text-slate-500"
        >
          {x}
          <ChevronDown size={14} />
        </button>
      ))}
    </div>
  );
}

export function ChorifyApp({
  route,
  user,
  nextPath = "",
}: {
  route: string;
  user?: { name: string; role: string; avatarUrl?: string | null };
  nextPath?: string;
}) {
  const [open, setOpen] = useState(false);
  if (route === "login" || route === "register")
    return <AuthPage page={route} nextPath={nextPath} />;
  if (route.startsWith("invite/")) return <InvitePage token={route.slice(7)} />;
  if (route.startsWith("share/")) return <FileSharePage token={route.slice(6)} />;
  const [rootRoute, detailId, projectSection] = route.split("/");
  return (
    <div className="min-h-screen bg-[#f4f7fb] text-[#17223b]">
      <Sidebar
        route={route}
        open={open}
        onClose={() => setOpen(false)}
        user={user}
      />
      <div className="lg:pl-[248px]">
        <Header route={route} onMenu={() => setOpen(true)} />
        <main className="mx-auto max-w-[1480px] p-5 md:p-8">
          {route === "dashboard" ? (
            <Dashboard />
          ) : rootRoute === "teams" ? (
            <TeamManagement teamId={detailId} />
          ) : rootRoute === "projects" ? (
            <ProjectsPage projectId={detailId} section={projectSection} />
          ) : rootRoute === "keys" ? (
            <ApiKeyPage />
          ) : rootRoute === "logs" ? (
            <AuditLogPage />
          ) : (
            <GenericPage route={rootRoute} />
          )}
        </main>
      </div>
    </div>
  );
}
