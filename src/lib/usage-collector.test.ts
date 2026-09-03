import { describe, expect, it } from "vitest";
import { createCollectorSecret, hashCollectorSecret, safeHashEqual } from "@/lib/usage-collector";

describe("usage collector credentials", () => {
  it("creates purpose-specific opaque secrets", () => {
    expect(createCollectorSecret("chur")).toMatch(/^chur_[A-Za-z0-9_-]{32}$/);
    expect(createCollectorSecret("chud")).toMatch(/^chud_[A-Za-z0-9_-]{32}$/);
  });

  it("compares hashes without accepting a different secret", () => {
    const first = hashCollectorSecret("collector-secret-a");
    const second = hashCollectorSecret("collector-secret-b");
    expect(safeHashEqual(first, first)).toBe(true);
    expect(safeHashEqual(first, second)).toBe(false);
  });
});
