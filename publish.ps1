# EcoTrash-AR Auto GitHub Publisher Script
Param(
    [string]$CommitMessage = "Update EcoTrash-AR application",
    [string]$GitHubToken = ""
)

Write-Host "=============================================" -ForegroundColor Green
Write-Host "EcoTrash-AR GitHub Auto Sync Publisher" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# Refresh PATH to pick up Git (system or portable MinGit)
$env:Path = "C:\Program Files\Git\cmd;C:\Users\Student\.gemini\antigravity\scratch\git\cmd;" + [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git command is not found in PATH." -ForegroundColor Red
    exit 1
}

# Ensure git repo is initialized
if (!(Test-Path .git)) {
    git init
    git branch -M main
}

git config user.email "pitchayadanava@gmail.com"
git config user.name "pitchayadanava-beep"

Write-Host "Staging changes..." -ForegroundColor Cyan
git add .

Write-Host "Creating commit..." -ForegroundColor Cyan
$dateStr = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "$CommitMessage - $dateStr"

if ($GitHubToken) {
    $repoUrl = "https://${GitHubToken}@github.com/pitchayadanava-beep/EcoTrash-AR.git"
} else {
    $repoUrl = "https://github.com/pitchayadanava-beep/EcoTrash-AR.git"
}
Write-Host "Setting target GitHub repository: https://github.com/pitchayadanava-beep/EcoTrash-AR.git" -ForegroundColor Cyan

git remote remove origin 2>$null
git remote add origin $repoUrl

Write-Host "Pushing changes to GitHub main branch..." -ForegroundColor Cyan
git push -u origin main --force

if ($LASTEXITCODE -eq 0) {
    Write-Host "=============================================" -ForegroundColor Green
    Write-Host "Successfully updated GitHub repository!" -ForegroundColor Green
    Write-Host "https://github.com/pitchayadanava-beep/EcoTrash-AR" -ForegroundColor Green
    Write-Host "=============================================" -ForegroundColor Green
} else {
    Write-Host "Push failed. Please verify GitHub credentials." -ForegroundColor Red
}
