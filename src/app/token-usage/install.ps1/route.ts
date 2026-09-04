import { NextResponse } from "next/server";

const script = String.raw`param([Parameter(Mandatory=$true)][string]$BaseUrl,[Parameter(Mandatory=$true)][string]$RegistrationCode)
$ErrorActionPreference = "Stop"
$installDir = Join-Path $env:USERPROFILE ".chorify-usage"
$collectorPath = Join-Path $installDir "collector.ps1"
$configPath = Join-Path $installDir "config.json"
$statePath = Join-Path $installDir "state.json"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null

try {
  try { Add-Type -AssemblyName System.Security.Cryptography.ProtectedData -ErrorAction Stop } catch { Add-Type -AssemblyName System.Security -ErrorAction Stop }
  $null = [Security.Cryptography.ProtectedData]
  $null = [Security.Cryptography.DataProtectionScope]
} catch {
  throw "当前 PowerShell 无法加载 Windows DPAPI。请使用 Windows PowerShell 5.1 或 PowerShell 7 后重试；注册码尚未使用。"
}

Write-Host "下载 Chorify Token 采集器..."
Invoke-WebRequest -UseBasicParsing -Uri "$BaseUrl/token-usage/collector.ps1" -OutFile $collectorPath
$deviceId = if (Test-Path $configPath) { try { (Get-Content -Raw $configPath | ConvertFrom-Json).deviceId } catch { $null } } else { $null }
if (-not $deviceId) { $deviceId = [guid]::NewGuid().ToString() }
$body = @{ registrationCode=$RegistrationCode; deviceId=$deviceId; deviceName=$env:COMPUTERNAME; platform="windows"; clientVersion="0.1.0" } | ConvertTo-Json
$registered = Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/v1/usage-collectors/register" -ContentType "application/json" -Body $body
$secretBytes = [Text.Encoding]::UTF8.GetBytes([string]$registered.deviceSecret)
$encrypted = [Security.Cryptography.ProtectedData]::Protect($secretBytes,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
@{ baseUrl=$BaseUrl; deviceId=$deviceId; encryptedSecret=[Convert]::ToBase64String($encrypted); clientVersion="0.1.0"; statePath=$statePath } | ConvertTo-Json | Set-Content -Encoding UTF8 $configPath

$action = 'powershell.exe -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $collectorPath + '"'
schtasks /Create /TN ChorifyUsageCollector /TR $action /SC MINUTE /MO 30 /F | Out-Null
Write-Host "首次扫描并上报中..."
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $collectorPath
if ($LASTEXITCODE -ne 0) {
  $logPath = Join-Path $installDir "collector.log"
  if (Test-Path $logPath) { Write-Host (Get-Content -Raw $logPath) -ForegroundColor Red }
  throw "首次扫描失败，错误日志：$logPath"
}
Write-Host "已接入。ChorifyUsageCollector 将每 30 分钟静默上报 Codex 与 Claude Code Token 汇总。"
Write-Host "配置位置：$configPath"
`;

export async function GET() {
  return new NextResponse(script, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
