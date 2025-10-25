# Git Move Offline

인터넷이 연결되지 않은 폐쇄망(오프라인) 환경으로 Git 저장소를 히스토리와 함께 안전하게 이동 및 동기화하는 CLI 도구입니다.

## 주요 특징

- **전체 히스토리 보존**: 모든 커밋, 브랜치, 태그를 그대로 이전합니다.
- **안전한 병합**: 외부 변경사항을 기존 내부 저장소에 안전하게 병합(merge)합니다.
- **간편한 사용**: 간단한 `export`, `import` 명령어로 모든 작업을 수행합니다.
- **플랫폼 호환성**: Windows, macOS, Linux를 모두 지원합니다.
- **인터랙티브 모드**: 동기화할 브랜치를 직접 선택하고 제어할 수 있습니다.

## 기본 워크플로우

```
┌──────────────────┐      ┌──────────┐      ┌──────────────────┐
│   PC A (외부망)  │      │   USB 등 │      │   PC B (내부망)  │
│ (Internet-Yes)   │      │ (Movable)│      │ (Internet-No)    │
└──────────────────┘      └──────────┘      └──────────────────┘
        │                      │                      │
1. gitmv export        ───►   2. 파일 복사   ───►   3. gitmv import
   (zip 파일 생성)            (zip 파일 이동)         (저장소에 반영)
        │                      │                      │
```

## 빠른 시작

### 1. 설치

> **요구사항**: Node.js 14+, Git 2.0+

```bash
npm install -g git-move-offline
```

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

## 상세 정보

- **자세한 사용법 및 모든 명령어 옵션**: [**USAGE.md**](./USAGE.md)
- **오프라인 설치 등 다양한 설치 방법**: [**INSTALL.md**](./INSTALL.md)

## 라이선스

[MIT](./LICENSE)