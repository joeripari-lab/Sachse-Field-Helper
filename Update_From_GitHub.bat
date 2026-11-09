@echo off
title Sachse Superintendent Field Assistant - GitHub Updater
cd /d "%~dp0"

echo ========================================================
echo  SACHSE CONSTRUCTION // SUPERINTENDENT FIELD ASSISTANT
echo  Pulling latest version from GitHub (origin/main)...
echo ========================================================
echo.

git pull origin main

echo.
echo ========================================================
echo  Update complete!
echo  If the Side Panel is currently open in Chrome or Edge,
echo  right-click inside the Side Panel and click "Reload".
echo ========================================================
pause

