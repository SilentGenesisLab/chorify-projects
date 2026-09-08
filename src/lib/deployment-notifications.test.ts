import { describe, expect, it } from "vitest";
import { feishuSignature, validFeishuWebhook } from "./deployment-notifications";

describe("deployment notifications", () => {
  it("accepts only official Feishu bot webhook hosts", () => {
    expect(validFeishuWebhook("https://open.feishu.cn/open-apis/bot/v2/hook/abc")).toBe(true);
    expect(validFeishuWebhook("https://open.larksuite.com/open-apis/bot/v2/hook/abc")).toBe(true);
    expect(validFeishuWebhook("https://open.feishu.cn.evil.test/open-apis/bot/v2/hook/abc")).toBe(false);
    expect(validFeishuWebhook("http://open.feishu.cn/open-apis/bot/v2/hook/abc")).toBe(false);
  });

  it("creates a stable timestamp signature", () => {
    expect(feishuSignature(1700000000, "secret")).toBe(feishuSignature(1700000000, "secret"));
    expect(feishuSignature(1700000000, "secret")).not.toBe(feishuSignature(1700000001, "secret"));
  });
});
