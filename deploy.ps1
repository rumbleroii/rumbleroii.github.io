$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"

if (-not (Test-Path $gh)) {
  Write-Host "Installing GitHub CLI..."
  winget install --id GitHub.cli -e --accept-package-agreements --accept-source-agreements
}

& $gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Log in to GitHub (browser will open)..."
  & $gh auth login --hostname github.com --git-protocol https --web
}

$repo = "rumbleroii.github.io"
$owner = "rumbleroii"

if (-not (git remote get-url origin 2>$null)) {
  & $gh repo create $repo --public --source=. --remote=origin --push
} else {
  git push -u origin main
}

& $gh api --method POST "/repos/$owner/$repo/pages" -f "source[branch]=main" -f "source[path]=/" 2>$null

Write-Host ""
Write-Host "Done! Site will be live at:"
Write-Host "  https://$owner.github.io"
Write-Host ""
Write-Host "If Pages isn't enabled yet: repo Settings -> Pages -> main / (root)"
