# Git Move Offline

인터넷이 연결되지 않은 폐쇄망(오프라인) 환경으로 Git 저장소를 히스토리와 함께 안전하게 이동 및 동기화하는 CLI 도구입니다.

## 주요 특징

- **전체 히스토리 보존**: 모든 커밋, 브랜치, 태그를 그대로 이전합니다.
- **안전한 병합**: 외부 변경사항을 기존 내부 저장소에 안전하게 병합(merge)합니다.
- **간편한 사용**: 간단한 `export`, `import` 명령어로 모든 작업을 수행합니다.
- **플랫폼 호환성**: Windows, macOS, Linux를 모두 지원합니다.
- **인터랙티브 모드**: 동기화할 브랜치를 직접 선택하고 제어할 수 있습니다.
- **다국어 지원**: 한국어와 영어를 지원합니다.

## 기본 워크플로우

```
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│  PC A (외부망)      │       │   USB 등           │       │  PC B (내부망)      │
│  Internet: Yes      │──────>│   (이동 매체)       │──────>│  Internet: No       │
│                     │       │                     │       │                     │
│  1. gitmv export    │       │  2. 파일 복사       │       │  3. gitmv import    │
│  (zip 파일 생성)    │       │  (zip 파일 이동)    │       │  (저장소에 반영)    │
└─────────────────────┘       └─────────────────────┘       └─────────────────────┘
```

**단계별 설명:**
1. **외부망 PC**: `gitmv export` 명령으로 Git 저장소를 zip 파일로 생성
2. **이동 매체**: USB, 외장 하드 등을 통해 zip 파일을 내부망으로 복사
3. **내부망 PC**: `gitmv import` 명령으로 zip 파일의 내용을 로컬 저장소에 병합

## 빠른 시작

### 1. 설치

> **요구사항**: Node.js 14+, Git 2.0+

```bash
npm install -g git-move-offline
```

오프라인 환경에서의 설치 방법은 [INSTALL.md](./INSTALL.md)를 참고하세요.

### 2. 사용법

**외부망 PC에서 (Export):**
```bash
# 프로젝트 폴더로 이동
cd /path/to/my-project

# export 명령어 실행
gitmv export
# → git-export-YYYYMMDD-HHMMSS.zip 파일이 생성됩니다.
```

**내부망 PC에서 (Import):**
```bash
# 내부망 프로젝트 폴더로 이동
cd /path/to/internal-project

# USB 등으로 복사해온 zip 파일로 import 실행
gitmv import /path/to/git-export-YYYYMMDD-HHMMSS.zip
```

## 주요 명령어

### Export
```bash
gitmv export [옵션]
```

**옵션:**
- `--branch <name>`: 특정 브랜치만 export
- `--all`: 모든 브랜치와 태그 포함 (기본값)
- `--auto`: 설정 파일에 따라 자동 실행

**예시:**
```bash
gitmv export                    # 모든 브랜치 export
gitmv export --branch main      # main 브랜치만 export
```

### Import
```bash
gitmv import <file.zip> [옵션]
```

**옵션:**
- `--init`: 초기 모드로 강제 실행 (빈 저장소에 복제)
- `--branch <names>`: 특정 브랜치만 import (쉼표로 구분)
- `--auto`: 설정 파일에 따라 자동으로 merge/push
- `--dry-run`: 실제 변경 없이 시뮬레이션만 실행

**예시:**
```bash
gitmv import git-export-20251025.zip
gitmv import git-export-20251025.zip --init
gitmv import git-export-20251025.zip --branch main,develop
gitmv import git-export-20251025.zip --dry-run
```

### 기타 옵션
```bash
gitmv --help                    # 도움말 표시
gitmv --version                 # 버전 정보 표시
gitmv --lang ko                 # 언어 설정 (ko/en)
```

## 상세 정보

- **자세한 사용법 및 모든 명령어 옵션**: [USAGE.md](./USAGE.md)
- **오프라인 설치 등 다양한 설치 방법**: [INSTALL.md](./INSTALL.md)

## 작동 원리

`git-move-offline`는 Git의 내장 기능인 `git bundle`을 사용합니다. `git bundle`은 Git 저장소의 모든 객체(커밋, 브랜치, 태그 등)를 하나의 바이너리 파일로 묶어주는 기능으로, 네트워크 없이도 `git clone`, `fetch`가 가능하게 해줍니다.

- **Export**: `git bundle create` 명령으로 `.bundle` 파일을 생성하고, 메타데이터와 함께 압축합니다.
- **Import**: `.bundle` 파일을 임시 remote로 추가한 뒤, `git fetch`와 `git merge`를 실행하여 현재 저장소에 변경사항을 적용합니다.

## 라이선스

[MIT](./LICENSE)