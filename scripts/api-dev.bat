@echo off
setlocal

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%\api" >nul

set "APP_ENV=development"
set "RELOAD=1"
if "%HOST%"=="" set "HOST=0.0.0.0"
if "%PORT%"=="" set "PORT=8000"

uv sync
uv run python run.py

popd >nul
endlocal

