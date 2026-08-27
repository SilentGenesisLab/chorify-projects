"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthPage } from "@/components/auth-page";
import { InvitePage } from "@/components/invite-page";
import { ProjectsPage } from "@/components/projects-page";
import { TeamManagement } from "@/components/team-management";
import { ApiKeyPage } from "@/components/api-key-page";
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
  已完成: "bg-emerald-50 text-emerald-700",
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
}: {
  name: string;
  color?: string;
}) {
  return (
    <span
      className={`inline-grid size-8 shrink-0 place-items-center rounded-full ${color} text-xs font-semibold text-white ring-2 ring-white`}
    >
      {name.slice(-1)}
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
  user?: { name: string; role: string };
}) {
  const router = useRouter();
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
        <div className="border-t border-[#edf1f6] p-4">
          <div className="flex items-center gap-3">
            <Avatar name={user?.name || "用户"} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {user?.name || "当前用户"}
              </p>
              <p className="truncate text-xs text-slate-400">
                {user?.role || "项目成员"}
              </p>
            </div>
            <button
              aria-label="退出登录"
              title="退出登录"
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                router.replace("/login");
                router.refresh();
              }}
              className="text-slate-400 hover:text-rose-500"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

function Header({ route, onMenu }: { route: string; onMenu: () => void }) {
  const rootRoute = route.split("/")[0];
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
      <button
        aria-label="通知"
        className="relative ml-3 grid size-10 place-items-center rounded-xl border border-[#e3e9f2] bg-white text-slate-500"
      >
        <Bell size={18} />
        <i className="absolute right-2 top-2 size-1.5 rounded-full bg-rose-500" />
      </button>
    </header>
  );
}

const tasks = [
  {
    id: "CP-142",
    name: "完成项目成员权限矩阵",
    project: "Chorify Projects",
    owner: "陈默",
    priority: "高",
    status: "进行中",
    date: "今天",
  },
  {
    id: "CP-138",
    name: "梳理任务提交与验收流程",
    project: "Chorify Projects",
    owner: "林舟",
    priority: "中",
    status: "待验收",
    date: "8月28日",
  },
  {
    id: "WEB-48",
    name: "移动端导航适配",
    project: "官网重构",
    owner: "周青",
    priority: "中",
    status: "进行中",
    date: "8月30日",
  },
  {
    id: "CP-129",
    name: "整理首版演示数据",
    project: "Chorify Projects",
    owner: "苏禾",
    priority: "低",
    status: "待处理",
    date: "9月1日",
  },
];

function Dashboard() {
  return (
    <div className="space-y-6">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-sm text-slate-500">2026年8月27日 · 星期四</p>
          <h2 className="text-2xl font-bold tracking-tight text-[#17223b]">
            下午好，陈默
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            3 个项目正在推进，今天有 4 项工作需要关注。
          </p>
        </div>
        <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#376ce7] px-4 text-sm font-semibold text-white shadow-sm shadow-blue-200">
          <Plus size={17} />
          新建项目
        </button>
      </section>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            l: "进行中的项目",
            v: "3",
            s: "本月新增 1 个",
            i: Layers3,
            c: "text-blue-600 bg-blue-50",
          },
          {
            l: "我的待办",
            v: "12",
            s: "4 项今天到期",
            i: ListChecks,
            c: "text-violet-600 bg-violet-50",
          },
          {
            l: "待验收",
            v: "5",
            s: "较昨日增加 2 项",
            i: ClipboardCheck,
            c: "text-amber-600 bg-amber-50",
          },
          {
            l: "延期风险",
            v: "2",
            s: "需要尽快处理",
            i: AlertTriangle,
            c: "text-rose-600 bg-rose-50",
          },
        ].map((x) => (
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
          <TaskTable compact />
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">项目状态</h3>
              <p className="mt-0.5 text-xs text-slate-400">当前活跃项目</p>
            </div>
            <MoreHorizontal size={18} className="text-slate-400" />
          </div>
          <div className="mt-5 space-y-5">
            {[
              { n: "Chorify Projects", p: 68, s: "正常", c: "bg-blue-500" },
              { n: "官网重构", p: 42, s: "有风险", c: "bg-amber-500" },
              { n: "数据工作台", p: 86, s: "正常", c: "bg-emerald-500" },
            ].map((x) => (
              <div key={x.n}>
                <div className="mb-2 flex items-center">
                  <span className="text-sm font-medium">{x.n}</span>
                  <span className="ml-auto text-xs text-slate-400">{x.p}%</span>
                  <span className="ml-2">
                    <Status>{x.s}</Status>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${x.c}`}
                    style={{ width: `${x.p}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="card p-5">
          <h3 className="font-semibold">版本进度</h3>
          <div className="mt-4 flex items-center gap-4 rounded-xl bg-[#f7f9fc] p-4">
            <div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Rocket size={21} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex justify-between">
                <p className="font-medium">V0.9 协作内测版</p>
                <span className="text-sm font-semibold text-blue-600">72%</span>
              </div>
              <p className="mt-1 text-xs text-slate-400">
                18 / 25 项已完成 · 计划 9月5日发布
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-slate-200">
                <div className="h-full w-[72%] rounded-full bg-blue-500" />
              </div>
            </div>
          </div>
        </div>
        <div className="card p-5">
          <h3 className="font-semibold">最近动态</h3>
          <div className="mt-4 space-y-4">
            {[
              "林舟提交了任务 CP-138 等待验收",
              "苏禾将 Bug CP-27 关联至 V0.9",
              "陈默更新了项目成员权限",
            ].map((x, i) => (
              <div key={x} className="flex gap-3">
                <div
                  className={`mt-1 size-2 rounded-full ${i === 0 ? "bg-blue-500" : i === 1 ? "bg-rose-400" : "bg-emerald-500"}`}
                />
                <div>
                  <p className="text-sm text-slate-600">{x}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {i + 1} 小时前
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function TaskTable({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left">
        <thead>
          <tr className="border-b border-[#edf1f5] bg-[#fafbfd] text-[11px] uppercase tracking-wide text-slate-400">
            <th className="px-5 py-3 font-medium">任务</th>
            <th className="px-4 py-3 font-medium">负责人</th>
            <th className="px-4 py-3 font-medium">优先级</th>
            <th className="px-4 py-3 font-medium">状态</th>
            <th className="px-5 py-3 font-medium">截止</th>
          </tr>
        </thead>
        <tbody>
          {tasks.slice(0, compact ? 4 : undefined).map((x) => (
            <tr
              key={x.id}
              className="border-b border-[#f0f3f7] last:border-0 hover:bg-slate-50/70"
            >
              <td className="px-5 py-3.5">
                <p className="text-sm font-medium">{x.name}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {x.id} · {x.project}
                </p>
              </td>
              <td className="px-4 py-3.5">
                <div className="flex items-center gap-2">
                  <Avatar name={x.owner} />
                  <span className="text-sm text-slate-600">{x.owner}</span>
                </div>
              </td>
              <td className="px-4 py-3.5">
                <Status>{x.priority}</Status>
              </td>
              <td className="px-4 py-3.5">
                <Status>{x.status}</Status>
              </td>
              <td className="px-5 py-3.5 text-sm text-slate-500">{x.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  if (route === "my-tasks" || route === "tasks")
    return (
      <div className="space-y-5">
        <PageTitle title="我的任务" subtitle={c.subtitle} action={c.action} />
        <Filters />
        <div className="card overflow-hidden">
          <TaskTable />
        </div>
      </div>
    );
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
  user?: { name: string; role: string };
  nextPath?: string;
}) {
  const [open, setOpen] = useState(false);
  if (route === "login" || route === "register")
    return <AuthPage page={route} nextPath={nextPath} />;
  if (route.startsWith("invite/")) return <InvitePage token={route.slice(7)} />;
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
          ) : (
            <GenericPage route={rootRoute} />
          )}
        </main>
      </div>
    </div>
  );
}
