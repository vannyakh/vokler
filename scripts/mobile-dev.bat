@echo off
setlocal

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%\mobile" >nul

npm run start

popd >nul
endlocal

