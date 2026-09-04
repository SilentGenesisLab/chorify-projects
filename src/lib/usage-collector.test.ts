import { describe, expect, it } from "vitest";
import { GET as getCollectorScript } from "@/app/token-usage/collector.ps1/route";
import { GET as getInstallerScript } from "@/app/token-usage/install.ps1/route";
import { COLLECTOR_VERSION, createCollectorSecret, hashCollectorSecret, safeHashEqual } from "@/lib/usage-collector";

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

  it("adds a UTF-8 BOM only to the collector file executed by Windows PowerShell 5.1", async () => {
    const collectorResponse = await getCollectorScript();
    const installerResponse = await getInstallerScript();
    const collectorBytes = new Uint8Array(await collectorResponse.clone().arrayBuffer());
    const installerBytes = new Uint8Array(await installerResponse.clone().arrayBuffer());
    const collector = await collectorResponse.text();

    expect([...collectorBytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect([...installerBytes.slice(0, 3)]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(collector).toContain(`$collectorVersion = "${COLLECTOR_VERSION}"`);
  });

  it("makes reinstall reuse a healthy registered device and writes the collector with a BOM", async () => {
    const installer = await (await getInstallerScript()).text();

    expect(installer).toContain("System.Text.UTF8Encoding($true)");
    expect(installer).toContain(".TrimStart([char]0xFEFF)");
    expect(installer).toContain("$reuseExisting = $true");
    expect(installer).toContain('status="HEALTHY"');
    expect(installer).toContain("if ($statusCode -ne 401) { throw }");
  });

  it("does not use Measure-Object properties on usage hashtables in Windows PowerShell 5.1", async () => {
    const collector = await (await getCollectorScript()).text();

    expect(collector).not.toContain("Measure-Object -Property activeSeconds");
    expect(collector).not.toContain("Measure-Object -Property sessions");
    expect(collector).toContain("foreach($event in $events)");
  });
});
