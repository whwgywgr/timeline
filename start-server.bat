@echo off
cd /d "%~dp0"
echo ============================================
echo   My Timeline server
echo   http://localhost:8123
echo   (leave this window open while using the app)
echo ============================================
start "" http://localhost:8123/
python -m http.server 8123
