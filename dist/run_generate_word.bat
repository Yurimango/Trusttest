@echo off
chcp 65001 >nul
title 诚信核查截图 Word 生成工具

echo ================================================
echo  诚信核查截图 Word 生成工具
echo ================================================
echo.

cd /d "%~dp0"

echo 当前项目目录：
echo %cd%
echo.

echo 正在启动 Word 生成脚本...
echo.

if exist "dist\诚信核查截图Word导出工具.exe" (
  dist\诚信核查截图Word导出工具.exe
) else (
  python word_exporter\generate_word.py
)

echo.
echo ================================================
echo  程序运行结束
echo ================================================
echo.

pause
