"use client";
import Image from "next/image";
import { useState } from "react";
import { Download, FileText, LoaderCircle, ShieldCheck } from "lucide-react";

export function FileSharePage({ token }: { token: string }) {
  const [code, setCode] = useState(""), [loading, setLoading] = useState(false), [error, setError] = useState("");
  async function download() { setLoading(true); setError(""); try { const response = await fetch(`/api/shares/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || "无法下载文件"); window.location.assign(body.url); } catch (cause) { setError(cause instanceof Error ? cause.message : "无法下载文件"); } finally { setLoading(false); } }
  return <main className="grid min-h-screen place-items-center bg-[#f4f7fb] p-5"><section className="w-full max-w-md rounded-2xl border bg-white p-7 text-center shadow-lg"><Image src="/chorify-logo.png" alt="AI Native" width={46} height={46} className="mx-auto size-12 object-contain"/><h1 className="mt-4 text-xl font-bold">AI Native 文件分享</h1><p className="mt-2 text-sm text-slate-500">该文件由项目成员通过受控链接分享</p><div className="my-6 rounded-xl bg-slate-50 p-5"><FileText className="mx-auto text-blue-600" size={30}/><p className="mt-2 text-sm font-medium">输入提取码后获取文件</p></div><input value={code} onChange={event=>setCode(event.target.value)} className="field text-center tracking-[.25em]" placeholder="提取码（如未设置可留空）"/>{error&&<div className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}<button disabled={loading} onClick={()=>void download()} className="primary-button mt-4 w-full justify-center">{loading?<LoaderCircle className="animate-spin" size={17}/>:<Download size={17}/>}获取文件</button><p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400"><ShieldCheck size={13}/>链接具有有效期与下载次数限制</p></section></main>;
}
