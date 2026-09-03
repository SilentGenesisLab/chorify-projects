import { NextResponse } from "next/server";

const script = String.raw`$ErrorActionPreference = "Stop"
$collectorVersion = "0.1.0"
$installDir = Join-Path $env:USERPROFILE ".chorify-usage"
$configPath = Join-Path $installDir "config.json"
$config = Get-Content -Raw $configPath | ConvertFrom-Json
$encrypted = [Convert]::FromBase64String([string]$config.encryptedSecret)
$secretBytes = [Security.Cryptography.ProtectedData]::Unprotect($encrypted,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
$deviceSecret = [Text.Encoding]::UTF8.GetString($secretBytes)
$headers = @{ Authorization = "Bearer $deviceSecret" }
$statePath = if ($config.statePath) { [string]$config.statePath } else { Join-Path $installDir "state.json" }
$fileState = @{}
if (Test-Path $statePath) {
  try {
    $savedState = Get-Content -Raw $statePath | ConvertFrom-Json
    if ($savedState.files) { $savedState.files.PSObject.Properties | ForEach-Object { $fileState[$_.Name] = [int]$_.Value } }
  } catch { }
}
$events = [Collections.Generic.List[object]]::new()
$nextLines = @{}

function Hash-Text([string]$value) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($value)))).Replace("-","").ToLowerInvariant() } finally { $sha.Dispose() }
}
function Number-Or-Zero($value) { if ($null -eq $value) { return 0 }; return [Math]::Max(0,[long]$value) }
function Add-Usage($hash,$date,$tool,$model,$input,$output,$cache,$reasoning,$sessions) {
  $events.Add(@{eventHash=$hash;date=$date;tool=$tool;model=if($model){[string]$model}else{"unknown"};inputTokens=Number-Or-Zero $input;outputTokens=Number-Or-Zero $output;cacheTokens=Number-Or-Zero $cache;reasoningTokens=Number-Or-Zero $reasoning;sessions=$sessions;estimatedCost=$null})
}
function Scan-File([IO.FileInfo]$file,[string]$tool) {
  $path = $file.FullName
  $skip = if ($fileState.ContainsKey($path)) { [int]$fileState[$path] } else { 0 }
  $lines = @(Get-Content -LiteralPath $path -ErrorAction SilentlyContinue)
  if ($skip -gt $lines.Count) { $skip = 0 }
  $firstDate = ([DateTimeOffset]$file.CreationTimeUtc).ToOffset([TimeSpan]::FromHours(8)).ToString("yyyy-MM-dd")
  Add-Usage (Hash-Text "session|$tool|$path") $firstDate $tool "session" 0 0 0 0 1
  for ($index=$skip; $index -lt $lines.Count; $index++) {
    try {
      $row = $lines[$index] | ConvertFrom-Json -ErrorAction Stop
      if ($tool -eq "CODEX" -and $row.type -eq "event_msg" -and $row.payload.type -eq "token_count" -and $row.payload.info.last_token_usage) {
        $u = $row.payload.info.last_token_usage
        $date = ([DateTimeOffset]::Parse([string]$row.timestamp)).ToOffset([TimeSpan]::FromHours(8)).ToString("yyyy-MM-dd")
        $hash = Hash-Text "codex|$path|$($row.ordinal)|$($row.timestamp)|$($u.total_tokens)"
        Add-Usage $hash $date "CODEX" "codex" $u.input_tokens $u.output_tokens ((Number-Or-Zero $u.cached_input_tokens)+(Number-Or-Zero $u.cache_write_input_tokens)) $u.reasoning_output_tokens 0
      }
      if ($tool -eq "CLAUDE" -and $row.type -eq "assistant" -and $row.message.usage) {
        $u = $row.message.usage
        $date = ([DateTimeOffset]::Parse([string]$row.timestamp)).ToOffset([TimeSpan]::FromHours(8)).ToString("yyyy-MM-dd")
        $hash = Hash-Text "claude|$($row.uuid)|$($row.message.id)"
        Add-Usage $hash $date "CLAUDE" $row.message.model $u.input_tokens $u.output_tokens ((Number-Or-Zero $u.cache_creation_input_tokens)+(Number-Or-Zero $u.cache_read_input_tokens)) 0 0
      }
    } catch { }
  }
  $nextLines[$path] = $lines.Count
}

try {
  $codexRoot = Join-Path $env:USERPROFILE ".codex\sessions"
  $claudeRoot = Join-Path $env:USERPROFILE ".claude\projects"
  if (Test-Path $codexRoot) { Get-ChildItem -LiteralPath $codexRoot -Recurse -File -Filter *.jsonl -ErrorAction SilentlyContinue | ForEach-Object { Scan-File $_ "CODEX" } }
  if (Test-Path $claudeRoot) { Get-ChildItem -LiteralPath $claudeRoot -Recurse -File -Filter *.jsonl -ErrorAction SilentlyContinue | ForEach-Object { Scan-File $_ "CLAUDE" } }
  for ($offset=0; $offset -lt $events.Count; $offset+=400) {
    $count = [Math]::Min(400,$events.Count-$offset)
    $chunk = $events.GetRange($offset,$count)
    $body = @{ events=$chunk; clientVersion=$collectorVersion } | ConvertTo-Json -Depth 6
    Invoke-RestMethod -Method Post -Uri "$($config.baseUrl)/api/v1/token-usage/batches" -Headers $headers -ContentType "application/json" -Body $body | Out-Null
  }
  foreach($key in $nextLines.Keys) { $fileState[$key] = $nextLines[$key] }
  @{ files=$fileState } | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 $statePath
  $heartbeat = @{clientVersion=$collectorVersion;status="HEALTHY";error=$null}|ConvertTo-Json
  Invoke-RestMethod -Method Post -Uri "$($config.baseUrl)/api/v1/usage-collectors/heartbeat" -Headers $headers -ContentType "application/json" -Body $heartbeat | Out-Null
  exit 0
} catch {
  try { $message=$_.Exception.Message;$heartbeat=@{clientVersion=$collectorVersion;status="ERROR";error=$message.Substring(0,[Math]::Min(500,$message.Length))}|ConvertTo-Json;Invoke-RestMethod -Method Post -Uri "$($config.baseUrl)/api/v1/usage-collectors/heartbeat" -Headers $headers -ContentType "application/json" -Body $heartbeat|Out-Null } catch { }
  exit 1
}
`;

export async function GET() {
  return new NextResponse(script, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=300" } });
}
