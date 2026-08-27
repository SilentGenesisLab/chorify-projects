"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FolderKanban,
  LoaderCircle,
  ShieldCheck,
  Users,
} from "lucide-react";

type Invite = {
  valid: boolean;
  reason: string | null;
  team: {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    projectCount: number;
  };
  role: string;
  roleLabel: string;
  expiresAt: string;
  createdBy: string;
  authenticated: boolean;
  alreadyMember: boolean;
};

export function InvitePage({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<Invite | null>(null),
    [loading, setLoading] = useState(true),
    [joining, setJoining] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/invites/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "邀请链接无效");
        setInvite(body.invite);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "邀请链接无效"))
      .finally(() => setLoading(false));
  }, [token]);
  async function accept() {
    setJoining(true);
    setError("");
    try {
      const response = await fetch(
        `/api/invites/${encodeURIComponent(token)}`,
        { method: "POST" },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "加入团队失败");
      router.push(`/teams/${body.teamId}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "加入团队失败");
      setJoining(false);
    }
  }
  const next = `/invite/${encodeURIComponent(token)}`;
  return (
    <main className="min-h-screen bg-[#f4f7fb] p-5 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-center gap-3 py-8">
          <Image
            src="/chorify-logo.png"
          alt="AI Native 团队协同开发系统"
            width={40}
            height={40}
            className="size-10 object-contain"
          />
          <div>
          <b className="block text-lg">AI Native 团队协同开发系统</b>
            <span className="text-xs text-slate-400">团队协作邀请</span>
          </div>
        </div>
        <section className="card overflow-hidden">
          {loading ? (
            <div className="grid min-h-[420px] place-items-center">
              <LoaderCircle className="animate-spin text-blue-600" size={30} />
            </div>
          ) : error && !invite ? (
            <Invalid message={error} />
          ) : invite ? (
            <>
              <div className="border-b border-slate-100 bg-white p-7 text-center sm:p-9">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-600">
                  <Users size={27} />
                </span>
                <p className="mt-5 text-sm text-slate-500">
                  {invite.createdBy} 邀请你加入团队
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight">
                  {invite.team.name}
                </h1>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
                  {invite.team.description ||
                    "加入团队，与成员共同推进项目协作。"}
                </p>
              </div>
              <div className="space-y-5 p-6 sm:p-8">
                <div className="grid gap-3 sm:grid-cols-3">
                  <Info
                    icon={ShieldCheck}
                    label="加入角色"
                    value={invite.roleLabel}
                  />
                  <Info
                    icon={Users}
                    label="团队成员"
                    value={`${invite.team.memberCount} 人`}
                  />
                  <Info
                    icon={FolderKanban}
                    label="团队项目"
                    value={`${invite.team.projectCount} 个`}
                  />
                </div>
                <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                  <Clock3
                    className="mt-0.5 shrink-0 text-slate-400"
                    size={17}
                  />
                  <span>
                    邀请有效期至{" "}
                    {new Date(invite.expiresAt).toLocaleString("zh-CN")}
                    。加入团队不会自动获得项目访问权限。
                  </span>
                </div>
                {!invite.valid ? (
                  <InvalidInline message={invite.reason || "邀请不可用"} />
                ) : invite.alreadyMember ? (
                  <button
                    onClick={() => router.push(`/teams/${invite.team.id}`)}
                    className="primary-button w-full justify-center"
                  >
                    <CheckCircle2 size={18} />
                    你已在团队中，进入团队
                  </button>
                ) : invite.authenticated ? (
                  <>
                    <p className="text-center text-sm text-slate-500">
                      确认后，你将以“{invite.roleLabel}”身份加入该团队。
                    </p>
                    <button
                      disabled={joining}
                      onClick={() => void accept()}
                      className="primary-button w-full justify-center"
                    >
                      {joining ? (
                        <LoaderCircle className="animate-spin" size={18} />
                      ) : (
                        <ArrowRight size={18} />
                      )}
                      确认加入团队
                    </button>
                  </>
                ) : (
                  <div>
                    <p className="mb-4 text-center text-sm text-slate-500">
                      请先登录或注册，完成后将返回此页面确认加入。
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link
                        href={`/login?next=${encodeURIComponent(next)}`}
                        className="primary-button justify-center"
                      >
                        登录后加入
                        <ArrowRight size={17} />
                      </Link>
                      <Link
                        href={`/register?next=${encodeURIComponent(next)}`}
                        className="secondary-button justify-center"
                      >
                        注册新账户
                      </Link>
                    </div>
                  </div>
                )}
                {error && <InvalidInline message={error} />}
              </div>
            </>
          ) : null}
        </section>
        <p className="py-6 text-center text-xs text-slate-400">
          请仅接受来自可信成员的团队邀请
        </p>
      </div>
    </main>
  );
}

function Info({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-100 p-4 text-center">
      <Icon className="mx-auto text-blue-500" size={19} />
      <p className="mt-2 text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
function Invalid({ message }: { message: string }) {
  return (
    <div className="grid min-h-[420px] place-items-center p-8 text-center">
      <div>
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600">
          <AlertCircle size={26} />
        </span>
        <h1 className="mt-5 text-xl font-bold">无法使用此邀请</h1>
        <p className="mt-2 text-sm text-slate-500">{message}</p>
        <Link href="/" className="secondary-button mt-6 justify-center">
          返回首页
        </Link>
      </div>
    </div>
  );
}
function InvalidInline({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
    >
      <AlertCircle size={17} />
      {message}
    </div>
  );
}
