@echo off
setlocal

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%\api" >nul

docker compose up -d db redis

popd >nul
endlocal

