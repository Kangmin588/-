#!/bin/bash
set -e
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
	nohup python3 -m http.server 8080 >/dev/null 2>&1 &
	sleep 1
	open "http://localhost:8080/"
else
	osascript -e 'display alert "Python 3가 필요합니다. Homebrew로 설치(brew install python) 또는 python.org에서 설치하세요."'
	exit 1
fi