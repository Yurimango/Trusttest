@echo off
chcp 65001 >nul
title 构建 Word 导出 EXE

cd /d "%~dp0\.."

echo ================================================
echo  构建诚信核查截图 Word 导出工具 EXE
echo ================================================
echo.

echo 当前项目目录：
echo %cd%
echo.

echo 正在安装/检查打包依赖...
python -m pip install -r word_exporter\requirements-build.txt
if errorlevel 1 (
  echo.
  echo 依赖安装失败，请检查 Python、pip 或网络环境。
  pause
  exit /b 1
)

echo.
echo 正在打包 EXE...
python -m PyInstaller word_exporter\word_exporter.spec --noconfirm --clean
if errorlevel 1 (
  echo.
  echo EXE 打包失败。
  pause
  exit /b 1
)

echo.
echo ================================================
echo  打包完成
echo ================================================
echo.
echo 输出文件：
echo %cd%\dist\诚信核查截图Word导出工具.exe
echo.

pause
