import Dysmsapi20170525, * as $Dysmsapi from "@alicloud/dysmsapi20170525";
import * as $OpenApi from "@alicloud/openapi-client";

export async function sendSmsCode(phone: string, code: string) {
  const accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET;
  const signName = process.env.ALIYUN_SMS_SIGN_NAME;
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE;
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) throw new Error("阿里云短信环境变量未完整配置");
  const client = new Dysmsapi20170525(new $OpenApi.Config({ accessKeyId, accessKeySecret, endpoint: "dysmsapi.aliyuncs.com", regionId: process.env.ALIYUN_SMS_REGION_ID || "cn-hangzhou" }));
  const result = await client.sendSms(new $Dysmsapi.SendSmsRequest({ phoneNumbers: phone, signName, templateCode, templateParam: JSON.stringify({ code }) }));
  if (result.body?.code !== "OK") throw new Error(result.body?.message || "短信发送失败");
}
