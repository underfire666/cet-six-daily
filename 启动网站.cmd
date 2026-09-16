@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200 -and $r.Content.Contains('/_next/')) { exit 0 } } catch {}; exit 1"
if not errorlevel 1 (
  start "" "http://127.0.0.1:3000"
  exit /b 0
)

echo Starting the local website...
echo Address: http://127.0.0.1:3000
echo Keep this window open while using the website.
echo Press Ctrl+C to stop the server.

start "" /b powershell.exe -NoProfile -Command "for ($attempt = 0; $attempt -lt 30; $attempt++) { try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:3000' -UseBasicParsing -TimeoutSec 2; if ($r.StatusCode -eq 200) { Start-Process 'http://127.0.0.1:3000'; exit } } catch {}; Start-Sleep -Seconds 1 }"
call npm run dev -- --port 3000
pause
