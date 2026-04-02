@echo off
setlocal

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%\api" >nul

uv sync
uv run arq app.workers.tasks.WorkerSettings

popd >nul
endlocal

