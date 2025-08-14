#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
	nohup python3 -m http.server 8080 >/dev/null 2>&1 &
	sleep 1
	if command -v xdg-open >/dev/null 2>&1; then
		xdg-open "http://localhost:8080/" >/dev/null 2>&1 || true
	fi
	echo "서버 실행 중 (포트 8080). 브라우저가 열리지 않으면 http://localhost:8080/ 로 접속하세요."
else
	echo "Python 3가 필요합니다. 설치 후 다시 실행하세요."
	exit 1
fi