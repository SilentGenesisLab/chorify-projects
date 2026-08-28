import { describe, expect, it } from "vitest";
import { parseFolderUploadPath } from "./folder-upload";

describe("parseFolderUploadPath", () => {
  it("保留本地文件夹层级和文件名", () => {
    expect(parseFolderUploadPath("设计稿/首页/banner.png")).toEqual({
      folders: ["设计稿", "首页"],
      fileName: "banner.png",
    });
    expect(parseFolderUploadPath("a/b/c/d/e/readme.txt").folders).toHaveLength(5);
  });

  it("忽略空段与当前目录段", () => {
    expect(parseFolderUploadPath("资料//./产品/说明.md")).toEqual({
      folders: ["资料", "产品"],
      fileName: "说明.md",
    });
  });

  it("拒绝上级目录路径", () => {
    expect(() => parseFolderUploadPath("资料/../密码.txt")).toThrow(
      "文件夹路径不能包含上级目录",
    );
  });
});
