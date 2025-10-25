# 설치 가이드

Git Move Offline을 다양한 환경에서 설치하는 방법을 안내합니다.

## 설치 방법 선택

### 방법 1: 공개 npm Registry (외부 인터넷망만)

공개 npm에 패키지가 등록되어 있다면:

```bash
npm install -g git-move-offline
```

### 방법 2: 로컬 .tgz 파일 (오프라인 환경 추천)

사내망이나 인터넷이 없는 환경에서 권장하는 방법입니다.

#### 2-1. 패키지 파일 생성 (외부 PC)

```bash
# 이 프로젝트 디렉토리에서
npm pack
# → git-move-offline-1.0.0.tgz 생성
```

또는 자동 설치 스크립트 사용:

**Linux/Mac:**
```bash
chmod +x scripts/install-local.sh
./scripts/install-local.sh
```

**Windows:**
```cmd
scripts\install-local.bat
```

#### 2-2. 파일 이동

생성된 `.tgz` 파일을 USB나 이동식 저장장치로 사내망 PC에 복사합니다.

#### 2-3. 설치 (사내망 PC)

```bash
# 전역 설치 (추천)
npm install -g ./git-move-offline-1.0.0.tgz

# 또는 로컬 프로젝트에 설치
npm install ./git-move-offline-1.0.0.tgz
```

### 방법 3: 프라이빗 npm Registry

사내에 npm registry가 있다면:

```bash
# Registry 설정
npm config set registry https://internal-npm.company.com

# Publish (최초 1회)
npm publish

# 설치
npm install -g git-move-offline
```

## 설치 확인

```bash
# 버전 확인
gitmv --version

# 도움말
gitmv --help
```

## 제거

```bash
# 전역 설치 제거
npm uninstall -g git-move-offline

# 로컬 설치 제거
npm uninstall git-move-offline
```

## 문제 해결

### "command not found: gitmv"

**원인**: npm 전역 bin 경로가 PATH에 없음

**해결:**
```bash
# npm 전역 bin 경로 확인
npm config get prefix

# 해당 경로를 PATH에 추가
# Linux/Mac: ~/.bashrc 또는 ~/.zshrc에 추가
export PATH="$PATH:$(npm config get prefix)/bin"

# Windows: 시스템 환경 변수에 추가
# %APPDATA%\npm
```

### 권한 에러 (EACCES)

**Linux/Mac:**
```bash
# sudo 사용
sudo npm install -g ./git-move-offline-1.0.0.tgz

# 또는 npm prefix 변경
mkdir ~/.npm-global
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH
```

**Windows:**
관리자 권한으로 명령 프롬프트 실행

### Node.js 버전 확인

```bash
node --version
# v14.0.0 이상 필요
```

## 업데이트

새 버전 설치:

```bash
# 로컬 .tgz 파일 사용 시
npm install -g ./git-move-offline-2.0.0.tgz

# npm registry 사용 시
npm update -g git-move-offline
```

## 여러 PC에 동시 배포

### 스크립트로 일괄 설치

**deploy.sh** (Linux/Mac):
```bash
#!/bin/bash
for host in server1 server2 server3; do
  scp git-move-offline-1.0.0.tgz user@$host:/tmp/
  ssh user@$host "npm install -g /tmp/git-move-offline-1.0.0.tgz"
done
```

**deploy.bat** (Windows):
```cmd
@echo off
for %%h in (server1 server2 server3) do (
  copy git-move-offline-1.0.0.tgz \\%%h\c$\temp\
  psexec \\%%h npm install -g c:\temp\git-move-offline-1.0.0.tgz
)
```
