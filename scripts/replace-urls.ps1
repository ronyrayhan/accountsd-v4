# Script to replace hardcoded localhost URLs with environment-based helper

$files = @(
    "frontend\src\pages\portal\OnboardingStepper.jsx",
    "frontend\src\pages\hr\OnboardingManagement.jsx",
    "frontend\src\pages\hr\EmployeeProfile.jsx"
)

$baseDir = "c:\Users\Amin\.gemini\antigravity\scratch\New folder\git\HR final sidebar fixed"

foreach ($file in $files) {
    $fullPath = Join-Path $baseDir $file
    if (Test-Path $fullPath) {
        $content = Get-Content $fullPath -Raw
        
        # Replace http://localhost:5000/${...} with ${getFileURL(...)}
        $content = $content -replace 'http://localhost:5000/\$\{([^}]+)\}', '${getFileURL($1)}'
        
        # Check if import already exists
        if ($content -notmatch 'import.*getFileURL.*from.*urlHelper') {
            # Add import after other imports
            $content = $content -replace '(import.*from.*[''"].*api/axios[''"];?\r?\n)', "`$1import { getFileURL } from '../../utils/urlHelper';`r`n"
        }
        
        Set-Content $fullPath $content -NoNewline
        Write-Host "Updated: $file" -ForegroundColor Green
    } else {
        Write-Host "File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`nAll hardcoded URLs have been replaced!" -ForegroundColor Cyan
