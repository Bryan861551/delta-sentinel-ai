@echo off
rem Starts the API and the web interface in two windows, then opens the browser.
start "Delta Sentinel - API" cmd /k "cd /d %~dp0backend && python -m pip install -r requirements.txt && python -m uvicorn app.main:app --port 8000"
start "Delta Sentinel - Web" cmd /k "cd /d %~dp0frontend && npm install && npm run dev"
timeout /t 25 >nul
start http://localhost:5173
