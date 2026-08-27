"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";

type Props = { page: "login" | "register"; nextPath?: string };

export function AuthPage({ page, nextPath = "" }: Props) {
  const registering = page === "register";
  const [loginMode, setLoginMode] = useState<"password" | "code">("password");
  const [phone, setPhone] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [agreed, setAgreed] = useState(false);
  useEffect(() => {
    if (!countdown) return;
    const timer = window.setInterval(() => setCountdown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  async function sendCode() {
    setError("");
    if (!/^1\d{10}$/.test(phone)) return setError("请输入正确的 11 位手机号");
    setSending(true);
    try {
      const response = await fetch("/api/auth/sms/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "验证码发送失败");
      setCountdown(60);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "验证码发送失败"); }
    finally { setSending(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!agreed) return setError("请先阅读并同意用户协议和隐私政策");
    if (!/^1\d{10}$/.test(phone)) return setError("请输入正确的 11 位手机号");
    if (registering && username.trim().length < 2) return setError("请输入至少 2 个字符的账户名");
    if ((registering || loginMode === "password") && password.length < 8) return setError("密码至少需要 8 位");
    if (registering && !/[A-Za-z]/.test(password)) return setError("密码必须包含字母");
    if (registering && !/\d/.test(password)) return setError("密码必须包含数字");
    if (registering && password !== confirmPassword) return setError("两次输入的密码不一致");
    if ((registering || loginMode === "code") && !/^\d{6}$/.test(code)) return setError("请输入 6 位验证码");
    setLoading(true);
    try {
      const url = registering ? "/api/auth/register" : loginMode === "password" ? "/api/auth/login" : "/api/auth/sms/verify";
      const body = registering ? { username: username.trim(), phone, code, password } : loginMode === "password" ? { phone, password } : { phone, code };
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || (registering ? "注册失败" : "登录失败"));
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") ? next : "/");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "操作失败，请稍后重试"); }
    finally { setLoading(false); }
  }

  const needsCode = registering || loginMode === "code";
  const authLink = `${registering?"/login":"/register"}${nextPath?`?next=${encodeURIComponent(nextPath)}`:""}`;
  return <main className="grid min-h-screen bg-[#f4f7fb] lg:grid-cols-[1.05fr_.95fr]">
    <section className="relative hidden overflow-hidden bg-[#071b4a] p-12 text-white lg:flex lg:flex-col">
      <Image src="/auth-protocol-bg.png" alt="Agent 协作协议网络" fill priority className="object-cover object-center" sizes="55vw"/>
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,18,52,.96)_0%,rgba(5,18,52,.82)_48%,rgba(5,18,52,.24)_100%)]"/>
      <div className="relative z-10 flex items-center gap-3"><Image src="/chorify-logo.png" alt="AI Native 团队协同开发系统" width={40} height={40} className="size-10 object-contain"/><div className="font-bold">AI Native 团队协同开发系统</div></div>
      <div className="relative z-10 my-auto max-w-xl"><p className="mb-5 text-sm font-semibold tracking-[.18em] text-blue-200">UNIFIED AGENT PROTOCOL</p><h1 className="text-4xl font-bold leading-tight">统一团队 Agent 协作协议，<br/>构建更高效的项目管理系统。</h1><p className="mt-5 max-w-lg leading-7 text-blue-100/80">在人的指挥与授权下，让不同 Agent 共享项目上下文、任务标准与交付记录，减少协作损耗，让每一次提交都可追踪、可验收。</p><div className="mt-9 space-y-3 text-sm text-blue-100/85">{["统一项目上下文与协作接口","任务提交与验收完整留痕","个人 API Key 权限受控"].map((item) => <div key={item} className="flex items-center gap-2"><CheckCircle2 size={16}/>{item}</div>)}</div></div>
      <p className="text-xs text-blue-200/60">© 2026 AI Native 团队协同开发系统</p>
    </section>
    <section className="flex items-center justify-center p-6 py-10"><div className="w-full max-w-[420px]">
      <div className="mb-8 flex items-center gap-2 lg:hidden"><Image src="/chorify-logo.png" alt="AI Native 团队协同开发系统" width={36} height={36} className="size-9 object-contain"/><b>AI Native 团队协同开发系统</b></div>
      <p className="text-sm font-medium text-blue-600">{registering ? "创建账户" : "欢迎回来"}</p><h2 className="mt-2 text-3xl font-bold">{registering ? "注册工作空间" : "登录工作空间"}</h2><p className="mt-2 text-sm text-slate-500">{registering ? "验证手机号并设置你的登录密码" : "使用手机号继续访问你的项目"}</p>
      {!registering && <div className="mt-7 flex rounded-xl bg-slate-100 p-1">{([["password","账户密码"],["code","手机验证码"]] as const).map(([key,label]) => <button type="button" key={key} onClick={() => { setLoginMode(key); setError(""); }} className={`h-10 flex-1 rounded-lg text-sm font-medium ${loginMode===key?"bg-white text-slate-900 shadow-sm":"text-slate-500"}`}>{label}</button>)}</div>}
      <form onSubmit={submit} className="mt-6 space-y-4">
        {registering && <Field label="账户名"><input value={username} onChange={(event)=>setUsername(event.target.value)} autoComplete="username" className="field" placeholder="请输入账户名"/></Field>}
        <Field label="手机号"><input value={phone} onChange={(event)=>setPhone(event.target.value.replace(/\D/g,"").slice(0,11))} inputMode="numeric" autoComplete="tel" className="field" placeholder="请输入 11 位手机号"/></Field>
        {needsCode && <Field label="验证码"><div className="relative"><input value={code} onChange={(event)=>setCode(event.target.value.replace(/\D/g,"").slice(0,6))} inputMode="numeric" autoComplete="one-time-code" className="field pr-28" placeholder="请输入 6 位验证码"/><button type="button" disabled={sending || countdown>0} onClick={sendCode} className="absolute right-3 top-3 text-sm font-medium text-blue-600 disabled:text-slate-400">{sending?"发送中...":countdown?`${countdown} 秒后重试`:"获取验证码"}</button></div></Field>}
        {(registering || loginMode === "password") && <Field label="密码"><div className="relative"><input value={password} onChange={(event)=>setPassword(event.target.value)} type={showPassword?"text":"password"} autoComplete={registering?"new-password":"current-password"} className="field pr-12" placeholder={registering?"至少 8 位，包含字母和数字":"请输入密码"}/><button type="button" aria-label="显示或隐藏密码" onClick={()=>setShowPassword(!showPassword)} className="absolute right-3 top-3 text-slate-400">{showPassword?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></Field>}
        {registering && <Field label="确认密码"><input value={confirmPassword} onChange={(event)=>setConfirmPassword(event.target.value)} type={showPassword?"text":"password"} autoComplete="new-password" className="field" placeholder="再次输入密码"/></Field>}
        <label className="flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-slate-500">
          <input type="checkbox" checked={agreed} onChange={(event)=>setAgreed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-[#376ce7]"/>
          <span>我已阅读并同意<Link href="https://protocol2.sligenai.cn/silgene-protocolsv2/protocols/slientgene/ProductUserAgreement.html" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">《洞墟产品用户协议》</Link>和<Link href="https://protocol2.sligenai.cn/silgene-protocolsv2/protocols/slientgene/ProductPrivacyPolicy.html" target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">《洞墟产品隐私政策》</Link></span>
        </label>
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        <button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#376ce7] font-semibold text-white shadow-sm shadow-blue-200 disabled:opacity-60">{loading?<LoaderCircle className="animate-spin" size={18}/>:<>{registering?"注册并登录":"登录"}<ArrowRight size={17}/></>}</button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500">{registering?"已经有账户？":"还没有账户？"} <Link href={authLink} className="font-semibold text-blue-600">{registering?"直接登录":"立即注册"}</Link></p>
      <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400"><ShieldCheck size={14}/>登录信息经过加密传输和安全存储</div>
    </div></section>
  </main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="mb-2 block text-sm font-medium">{label}</span>{children}</label>; }
