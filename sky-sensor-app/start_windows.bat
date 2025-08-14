@echo off
setlocal

cd /d "%~dp0"

where py >nul 2>nul
if %ERRORLEVEL%==0 (
	set "PY_CMD=py"
) else (
	where python >nul 2>nul
	if %ERRORLEVEL%==0 (
		set "PY_CMD=python"
	) else (
		echo Python이 필요합니다. https://www.python.org/downloads/ 에서 설치 후 다시 실행하세요.
		pause
		exit /b 1
	)
)

start "SensorSky Server" cmd /k %PY_CMD% -m http.server 8080
>nul timeout /t 1 /nobreak
start "SensorSky" http://localhost:8080/

echo 서버 실행 중입니다. 브라우저가 자동으로 열리지 않으면 http://localhost:8080/ 로 접속하세요.
pause