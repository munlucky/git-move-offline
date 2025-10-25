# Git Move Offline

인터넷이 연결되지 않은 사내망으로 Git 저장소를 히스토리와 함께 안전하게 이동 및 동기화하는 도구입니다.

## 주요 기능

- ✅ 전체 Git 히스토리 보존
- ✅ 기존 사내 저장소와 병합(merge) 지원
- ✅ 크로스 플랫폼 지원 (Windows, Mac)
- ✅ 정기적인 동기화 작업 지원
- ✅ 모든 브랜치 및 태그 포함
- ✅ 인터랙티브 브랜치 선택

## 사용 시나리오

외부 인터넷망에서 개발한 코드를 사내망으로 정기적으로 동기화해야 할 때, Git 히스토리를 포함하여 안전하게 병합할 수 있습니다.

## 설치

### npm 전역 설치 (추천)

**공개 npm registry 사용 (인터넷 연결 필요):**
```bash
npm install -g git-move-offline
```

**오프라인 설치 (사내망 환경):**
```bash
# 1. 외부 PC에서 패키지 생성
npm pack
# → git-move-offline-1.0.0.tgz 생성

# 2. .tgz 파일을 USB로 사내망 PC에 복사

# 3. 사내망 PC에서 설치
npm install -g ./git-move-offline-1.0.0.tgz
```

**자동 설치 스크립트 사용:**
```bash
# Linux/Mac
./scripts/install-local.sh

# Windows
scripts\install-local.bat
```

자세한 설치 방법은 [INSTALL.md](./INSTALL.md)를 참고하세요.

### 개발 모드 설치

이 저장소를 직접 사용하려면:
```bash
git clone <repository-url>
cd git-move-offline
npm install
```

## 사용 방법

> **참고**: 전역 설치 후 `gitmv` 명령어를 사용하거나, 개발 모드에서는 `node export.js` / `node import.js`를 직접 실행할 수 있습니다.

### 1. Export (외부 PC에서)

```bash
# 전역 설치 후
gitmv export

# 또는 개발 모드
npm run export
node export.js
```

**생성되는 파일**: `git-export-YYYYMMDD-HHMMSS.zip`

이 파일에는 다음이 포함됩니다:
- 전체 Git 히스토리 (bundle 파일)
- 브랜치 정보 및 최신 커밋 메타데이터
- 태그 정보

### 2. 파일 이동

생성된 ZIP 파일을 USB, 이동식 저장장치 등으로 사내망 PC에 복사합니다.

### 3. Import (사내망 PC에서)

#### 최초 사용 (빈 저장소)

```bash
# 새 저장소 생성
git init
git remote add origin https://internal-git.company.com/project.git

# Import 실행 (자동으로 초기 모드 감지)
gitmv import git-export-20251025.zip

# 또는 개발 모드
node import.js git-export-20251025.zip
```

스크립트가 자동으로 빈 저장소를 감지하고 최적의 방식(초기 모드)을 제안합니다.

#### 정기적 동기화 (기존 저장소)

```bash
# 기존 프로젝트 디렉토리에서
cd /path/to/existing-project

# 전역 설치 후
gitmv import git-export-20251025.zip

# 또는 개발 모드
node import.js git-export-20251025.zip
```

자동으로 동기화 모드로 실행되어 외부 변경사항을 병합합니다.

#### Import 동작 과정

1. ZIP 파일 압축 해제
2. Bundle을 임시 remote로 추가
3. 외부 커밋들을 fetch
4. 브랜치별로 merge 여부 선택 (인터랙티브 모드)
5. 사용자 확인 후 사내 Git 서버로 push

#### Import 옵션

```bash
# 초기 모드 강제 사용 (자동 감지 무시)
gitmv import git-export-20251025.zip --init

# 자동 모드 (설정 파일 기반)
gitmv import git-export-20251025.zip --auto

# Dry-run (실제 변경 없이 시뮬레이션)
gitmv import git-export-20251025.zip --dry-run

# 특정 브랜치만 처리
gitmv import git-export-20251025.zip --branch main,develop

# 도움말
gitmv --help
gitmv import --help
```

## 설정 파일 (선택사항)

`config.json` 파일을 생성하여 자동화 설정:

```json
{
  "autoMergeBranches": ["main", "develop"],
  "skipBranches": ["experimental"],
  "autoPush": false,
  "conflictStrategy": "manual"
}
```

## 작동 원리

### Export 과정
1. `git bundle create --all` 명령으로 모든 브랜치/태그 패키징
2. 브랜치별 최신 커밋 해시 및 메타데이터 JSON 생성
3. 날짜/시간이 포함된 ZIP 파일로 압축

### Import 과정

**초기 모드 (빈 저장소):**
1. ZIP 압축 해제 및 메타데이터 검증
2. Bundle을 임시 remote로 추가
3. `git fetch` 로 모든 커밋 가져오기
4. Bundle에서 직접 브랜치 체크아웃 (merge 불필요)
5. Origin으로 push
6. 임시 파일 정리

**동기화 모드 (기존 저장소):**
1. ZIP 압축 해제 및 메타데이터 검증
2. Bundle을 임시 remote로 추가
3. `git fetch` 로 외부 커밋 가져오기
4. 각 브랜치별로 `git merge` 실행 (양쪽 히스토리 보존)
5. Merge 결과 확인 후 origin으로 push
6. 임시 파일 및 remote 정리

## Merge 충돌 처리

충돌이 발생한 경우:
1. 스크립트가 충돌 파일 목록 표시
2. 수동으로 충돌 해결
3. `git add <해결된파일>` 실행
4. Import 스크립트 재실행 시 자동으로 merge 완료

## 요구사항

- Node.js 14 이상
- Git 2.0 이상

## 예시 워크플로우

```bash
# 외부 PC (인터넷망)
cd /path/to/project
gitmv export
# → git-export-20251025-143020.zip 생성

# USB로 파일 이동

# 사내망 PC
cd /path/to/internal-project
gitmv import /path/to/git-export-20251025-143020.zip
# → 인터랙티브 프롬프트에서 브랜치 선택
# → merge 완료 후 push
```

## 라이선스

MIT
