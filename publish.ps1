Write-Host "=== Eco-AR GitHub Publisher ===" -ForegroundColor Green

# 1. Check if git is installed
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git is not installed on this system." -ForegroundColor Yellow
    Write-Host "Attempting to install Git automatically via Windows Package Manager (winget)..." -ForegroundColor Cyan
    
    # Run winget installer
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    
    # Refresh PATH environment variables
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
    
    if (!(Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Host "Failed to install Git automatically. Please install it manually from https://git-scm.com/ and then rerun this script." -ForegroundColor Red
        Read-Host "Press Enter to exit"
        exit
    }
}

Write-Host "Git is installed and ready!" -ForegroundColor Green

# 2. Initialize Git if not already done
if (!(Test-Path .git)) {
    git init
    git branch -M main
}

# 3. Add and commit all files
git add .
git config user.email "student@eco-ar.bma"
git config user.name "BKK Student"
git commit -m "Initial commit of Eco-AR Bangkok Trash Scanner & Game"

# 4. Set pre-filled GitHub Repository URL
$repoUrl = "https://github.com/pitchayadanava-beep/EcoTrash-AR.git"
Write-Host "Setting remote repository target to: $repoUrl" -ForegroundColor Cyan

# Configure remote origin
git remote remove origin 2>$null
git remote add origin $repoUrl

# 5. Push to GitHub
Write-Host "Pushing files to GitHub..." -ForegroundColor Cyan
git push -u origin main --force

Write-Host "=== Upload Complete! ===" -ForegroundColor Green
Read-Host "Press Enter to exit"
