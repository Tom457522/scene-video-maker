@echo off
rem シーン式 解説動画メーカーを起動する(ダブルクリックで実行)
rem start.bat --check とすると、起動の手前まで確かめて終わる(CI 用)
chcp 65001 > nul
cd /d "%~dp0"

where node > nul 2> nul
if errorlevel 1 (
  echo Node.js が見つかりません。https://nodejs.org/ から LTS 版を入れてから、もう一度実行してください。
  pause
  exit /b 1
)

if not exist node_modules (
  echo 初回の準備をしています(npm install)。数分かかります…
  call npm install
  if errorlevel 1 (
    echo npm install に失敗しました。上のメッセージを確認してください。
    pause
    exit /b 1
  )
)

if "%~1"=="--check" (
  echo start.bat の確認: OK
  exit /b 0
)

echo エディタを起動します。ブラウザが開かなければ http://127.0.0.1:5173 を開いてください。
echo 終わるときはこの画面で Ctrl+C を押すか、画面を閉じてください。
call npm run dev
pause
