$ollamaDir = Join-Path $env:LOCALAPPDATA "Programs\Ollama"
$ollamaExe = Join-Path $ollamaDir "ollama.exe"
if (-not (Test-Path $ollamaExe)) { Write-Error "Install Ollama from https://ollama.com/download/windows"; exit 1 }
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$ollamaDir*") {
    [Environment]::SetEnvironmentVariable("Path", "$(if ($userPath){"$userPath;"}else{""})$ollamaDir", "User")
}
$env:Path = "$ollamaDir;$env:Path"
& $ollamaExe --version
Write-Host "Restart terminal, then: ollama pull nomic-embed-text"
