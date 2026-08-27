import { describe, expect, it } from "vitest";
import { folderMoveCreatesCycle, MAX_FILE_SIZE, STORAGE_UPLOAD_STOP, uploadFitsQuota } from "./file-rules";

describe("file platform limits", () => {
  it("accepts a file inside size and quota limits", () => expect(uploadFitsQuota(BigInt(0), MAX_FILE_SIZE)).toBe(true));
  it("rejects files over 2GB and uploads crossing the protection line", () => { expect(uploadFitsQuota(BigInt(0), MAX_FILE_SIZE + BigInt(1))).toBe(false); expect(uploadFitsQuota(STORAGE_UPLOAD_STOP - BigInt(10), BigInt(11))).toBe(false); });
  it("detects moving a folder into itself or a descendant", () => { expect(folderMoveCreatesCycle("a", "/产品", { id: "a", path: "/产品" })).toBe(true); expect(folderMoveCreatesCycle("a", "/产品", { id: "b", path: "/产品/设计/图标" })).toBe(true); expect(folderMoveCreatesCycle("a", "/产品", { id: "c", path: "/交付" })).toBe(false); });
});
