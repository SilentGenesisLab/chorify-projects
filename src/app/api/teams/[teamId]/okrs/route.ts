import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { teamAccess } from "@/lib/team-api";

const include = { owner: { select: { id: true, name: true, avatarColor: true } }, keyResults: { include: { owner: { select: { id: true, name: true } }, alignments: { include: { user: { select: { id: true, name: true } } } }, checkIns: { orderBy: { createdAt: "desc" as const }, take: 10, include: { author: { select: { name: true } } } } } } };
export async function GET(request: NextRequest, { params }: { params: Promise<{teamId:string}> }) {
  const {teamId}=await params; const access=await teamAccess(request,teamId); if("error" in access)return access.error;
  const url=new URL(request.url), now=new Date();
  const objectives=await prisma.teamObjective.findMany({where:{teamId,...(url.searchParams.get("all")==="1"?{}:{startsAt:{lte:now},endsAt:{gte:now}})},orderBy:{startsAt:"desc"},include});
  return NextResponse.json({objectives});
}
export async function POST(request: NextRequest,{params}:{params:Promise<{teamId:string}>}){
  const {teamId}=await params; const access=await teamAccess(request,teamId,true); if("error" in access)return access.error;
  const parsed=z.object({title:z.string().trim().min(2).max(200),description:z.string().trim().max(2000).default(""),periodType:z.enum(["MONTHLY","QUARTERLY","YEARLY"]),periodLabel:z.string().trim().min(2).max(50),startsAt:z.coerce.date(),endsAt:z.coerce.date(),ownerId:z.string(),status:z.enum(["DRAFT","ACTIVE","AT_RISK","COMPLETED","ARCHIVED"]).default("ACTIVE"),keyResults:z.array(z.object({title:z.string().trim().min(2).max(200),targetValue:z.number().positive(),currentValue:z.number().min(0).default(0),unit:z.string().trim().min(1).max(20),confidence:z.number().int().min(0).max(100),ownerId:z.string(),alignedUserIds:z.array(z.string()).default([])})).min(1)}).safeParse(await request.json());
  if(!parsed.success||parsed.data.endsAt<=parsed.data.startsAt)return NextResponse.json({error:"请检查 OKR 信息"},{status:400});
  const memberIds=new Set((await prisma.teamMember.findMany({where:{teamId,role:{not:"GUEST"}},select:{userId:true}})).map(x=>x.userId));
  if(!memberIds.has(parsed.data.ownerId)||parsed.data.keyResults.some(k=>!memberIds.has(k.ownerId)||k.alignedUserIds.some(id=>!memberIds.has(id))))return NextResponse.json({error:"负责人和对齐人必须是正式团队成员"},{status:400});
  const {keyResults,...data}=parsed.data;
  const objective=await prisma.$transaction(async tx=>{const created=await tx.teamObjective.create({data:{...data,teamId,keyResults:{create:keyResults.map(({alignedUserIds,...kr})=>({...kr,alignments:{create:alignedUserIds.map(userId=>({userId}))}}))}},include});await tx.auditLog.create({data:{userId:access.userId,actorType:"USER",action:"CREATE_TEAM_OKR",resource:"TEAM_OBJECTIVE",resourceId:created.id,channel:"WEB",metadata:{teamId,keyResultCount:keyResults.length}}});return created;});
  return NextResponse.json({objective},{status:201});
}
