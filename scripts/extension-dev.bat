@echo off
setlocal

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%\extension" >nul

npm run dev

popd >nul
endlocal

