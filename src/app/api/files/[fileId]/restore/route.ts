import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fileUser, projectFileAccess } from "@/lib/file-auth";

export async function POST(request: Request, { params }: { params: Promise<{ fileId: string }> }) { const user=await fileUser(request);if(!user)return NextResponse.json({error:"请先登录"},{status:401});const {fileId}=await params,file=await prisma.fileAsset.findUnique({where:{id:fileId},include:{folder:true}});if(!file||!file.deletedAt)return NextResponse.json({error:"回收站中没有该文件"},{status:404});if(!(await projectFileAccess(user.id,file.projectId)).canWrite)return NextResponse.json({error:"没有恢复权限"},{status:403});const folderId=file.folder?.deletedAt?null:file.folderId;await prisma.fileAsset.update({where:{id:file.id},data:{deletedAt:null,folderId}});return NextResponse.json({ok:true}); }
