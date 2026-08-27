import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket = process.env.S3_BUCKET || "aipmf-files";

function client(publicUrl = false) {
  const endpoint = publicUrl ? process.env.S3_PUBLIC_ENDPOINT || process.env.S3_ENDPOINT : process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("文件存储尚未配置");
  return new S3Client({
    endpoint,
    region: process.env.S3_REGION || "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function startMultipart(objectKey: string, contentType: string) {
  const result = await client().send(new CreateMultipartUploadCommand({ Bucket: bucket, Key: objectKey, ContentType: contentType }));
  if (!result.UploadId) throw new Error("无法创建上传会话");
  return result.UploadId;
}

export function signPart(objectKey: string, uploadId: string, partNumber: number) {
  return getSignedUrl(client(true), new UploadPartCommand({ Bucket: bucket, Key: objectKey, UploadId: uploadId, PartNumber: partNumber }), { expiresIn: 900 });
}

export async function finishMultipart(objectKey: string, uploadId: string, parts: Array<{ partNumber: number; etag: string }>) {
  await client().send(new CompleteMultipartUploadCommand({ Bucket: bucket, Key: objectKey, UploadId: uploadId, MultipartUpload: { Parts: parts.map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })) } }));
}

export async function abortMultipart(objectKey: string, uploadId: string) {
  await client().send(new AbortMultipartUploadCommand({ Bucket: bucket, Key: objectKey, UploadId: uploadId }));
}

export function signDownload(objectKey: string, downloadName: string, contentType: string) {
  return getSignedUrl(client(true), new GetObjectCommand({ Bucket: bucket, Key: objectKey, ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`, ResponseContentType: contentType }), { expiresIn: 900 });
}

export async function deleteObject(objectKey: string) {
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}
