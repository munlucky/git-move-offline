@echo off
REM Git Move Offline - 로컬 설치 스크립트 (Windows)
REM 사내망 환경에서 npm registry 없이 설치하는 방법

echo === Git Move Offline 로컬 설치 ===
echo.

REM 1. 패키지 빌드
echo 1. 패키지 생성 중...
call npm pack

REM 2. 생성된 .tgz 파일 찾기
for /f "delims=" %%i in ('dir /b /od git-move-offline-*.tgz 2^>nul') do set TGZ_FILE=%%i

if not defined TGZ_FILE (
  echo ❌ 패키지 파일을 찾을 수 없습니다.
  exit /b 1
)

echo    ✓ 생성됨: %TGZ_FILE%
echo.

REM 3. 설치 옵션 안내
echo 2. 설치 방법을 선택하세요:
echo.
echo    [1] 전역 설치 (추천)
echo        → 어디서든 'gmo' 명령어 사용 가능
echo        → 명령어: npm install -g ./%TGZ_FILE%
echo.
echo    [2] 로컬 프로젝트에 설치
echo        → 현재 프로젝트에서만 사용
echo        → 명령어: npm install ./%TGZ_FILE%
echo.
echo    [3] 파일만 생성 (수동 설치)
echo        → %TGZ_FILE% 파일을 다른 PC로 복사
echo        → 그곳에서: npm install -g ./%TGZ_FILE%
echo.

set /p choice="선택 (1/2/3): "

if "%choice%"=="1" goto install_global
if "%choice%"=="2" goto install_local
if "%choice%"=="3" goto pack_only
goto invalid_choice

:install_global
echo.
echo 전역 설치 중...
call npm install -g "./%TGZ_FILE%"
echo.
echo ✓ 설치 완료!
echo.
echo 사용법:
echo   gmo export
echo   gmo import ^<file.zip^>
echo.
echo 버전 확인:
call gmo --version
goto end

:install_local
echo.
echo 로컬 설치 중...
call npm install "./%TGZ_FILE%"
echo.
echo ✓ 설치 완료!
echo.
echo 사용법:
echo   npx gmo export
echo   npx gmo import ^<file.zip^>
goto end

:pack_only
echo.
echo ✓ 패키지 파일 생성 완료: %TGZ_FILE%
echo.
echo 다음 단계:
echo 1. %TGZ_FILE% 파일을 USB 등으로 복사
echo 2. 대상 PC에서 실행:
echo    npm install -g ./%TGZ_FILE%
goto end

:invalid_choice
echo.
echo ❌ 잘못된 선택입니다.
exit /b 1

:end
echo.
echo === 완료 ===
pause
