import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { teamAccess } from "@/lib/team-api";
import { isTeamManager } from "@/lib/team-permissions";

const include = { owner: { select: { id: true, name: true, avatarColor: true } }, keyResults: { include: { owner: { select: { id: true, name: true, avatarColor: true } }, alignments: { include: { user: { select: { id: true, name: true, avatarColor: true } } } }, checkIns: { orderBy: { createdAt: "desc" as const }, take: 10, include: { author: { select: { name: true } } } } } } };
export async function GET(request: NextRequest, { params }: { params: Promise<{teamId:string}> }) {
  const {teamId}=await params; const access=await teamAccess(request,teamId); if("error" in access)return access.error;
  if(access.membership.role==="GUEST")return NextResponse.json({error:"访客不能查看成员 OKR"},{status:403});
  const url=new URL(request.url), now=new Date(), memberId=url.searchParams.get("memberId")||"";
  const members=await prisma.teamMember.findMany({where:{teamId,role:{not:"GUEST"}},include:{user:{select:{id:true,name:true,avatarColor:true}}},orderBy:{user:{name:"asc"}}});
  if(memberId&&!members.some(x=>x.userId===memberId))return NextResponse.json({error:"成员不属于当前团队"},{status:400});
  const allObjectives=await prisma.teamObjective.findMany({where:{teamId,...(url.searchParams.get("all")==="1"?{}:{startsAt:{lte:now},endsAt:{gte:now}})},orderBy:{startsAt:"desc"},include});
  const involved=(objective:typeof allObjectives[number],userId:string)=>objective.ownerId===userId||objective.keyResults.some(kr=>kr.ownerId===userId||kr.alignments.some(x=>x.userId===userId));
  const objectives=memberId?allObjectives.filter(objective=>involved(objective,memberId)):allObjectives;
  const memberSummaries=members.map(member=>{
    const related=allObjectives.filter(objective=>involved(objective,member.userId));
    const keyResults=allObjectives.flatMap(objective=>objective.keyResults).filter(kr=>kr.ownerId===member.userId||kr.alignments.some(x=>x.userId===member.userId));
    const avgProgress=keyResults.length?Math.round(keyResults.reduce((sum,kr)=>sum+Math.min(100,kr.targetValue>0?kr.currentValue/kr.targetValue*100:0),0)/keyResults.length):0;
    return {userId:member.userId,name:member.user.name,avatarColor:member.user.avatarColor,objectiveCount:related.length,keyResultCount:keyResults.length,avgProgress,atRisk:related.filter(x=>x.status==="AT_RISK").length};
  });
  return NextResponse.json({objectives,members:memberSummaries,viewerId:access.userId,canManage:isTeamManager(access.membership.role)});
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
