# 상세 사용 가이드 (USAGE)

이 문서는 `git-move-offline`의 모든 기능과 옵션에 대해 자세히 설명합니다.

## 목차

- [명령어](#명령어)
  - [`gitmv export`](#gitmv-export)
  - [`gitmv import`](#gitmv-import)
- [Import 모드](#import-모드)
  - [초기 모드 (Initial Mode)](#초기-모드)
  - [동기화 모드 (Sync Mode)](#동기화-모드)
- [설정 파일 (`config.json`)](#설정-파일)
- [상황별 가이드](#상황별-가이드)
  - [최초로 저장소 전체 이동하기](#최초로-저장소-전체-이동하기)
  - [주기적으로 변경사항 동기화하기](#주기적으로-변경사항-동기화하기)
  - [Merge 충돌 해결하기](#merge-충돌-해결하기)
- [문제 해결 (Troubleshooting)](#문제-해결)
- [작동 원리](#작동-원리)

---

## 명령어

### `gitmv export`

외부망 PC의 Git 저장소를 `.zip` 파일로 패키징합니다.

```bash
gitmv export [options]
```

**동작:**

1.  현재 저장소의 모든 브랜치, 태그, 커밋 히스토리를 `repository.bundle` 파일로 만듭니다.
2.  브랜치, 태그 등의 메타데이터를 `metadata.json` 파일로 저장합니다.
3.  두 파일을 `git-export-YYYYMMDD-HHMMSS.zip` 형태로 압축합니다.

**주요 옵션:**

- `--branch <name>`: 특정 브랜치 하나만 지정하여 export 합니다.
- `--all` (기본값): 모든 브랜치와 태그를 포함합니다.

---

### `gitmv import <file.zip>`

`export`로 생성된 `.zip` 파일을 내부망 PC의 Git 저장소에 적용합니다.

```bash
gitmv import <file.zip> [options]
```

**동작:**

1.  `.zip` 파일의 압축을 해제하고 유효성을 검사합니다.
2.  현재 저장소의 상태(빈 저장소 여부)를 확인하여 '초기 모드' 또는 '동기화 모드'를 제안합니다.
3.  선택된 모드에 따라 외부 변경사항을 현재 저장소에 적용합니다.

**주요 옵션:**

- `--init`: '초기 모드'를 강제로 사용합니다. 빈 저장소가 아닐 경우 위험할 수 있습니다.
- `--branch <names>`: 쉼표로 구분하여 특정 브랜치들만 import 합니다. (예: `--branch main,develop`)
- `--auto`: `config.json` 설정에 따라 사용자 확인 없이 자동으로 merge와 push를 진행합니다.
- `--dry-run`: 실제 변경을 적용하지 않고, 어떤 작업이 수행될지 시뮬레이션 결과만 보여줍니다.

---

## Import 모드

### 초기 모드 (Initial Mode)

**언제 사용되나?**

- 비어있는 Git 저장소에 처음으로 외부 프로젝트를 복제할 때 사용됩니다.
- `git init`만 실행된 커밋 없는 저장소에서 `import`를 실행하면 자동으로 제안됩니다.

**특징:**

- Merge 과정 없이 원본 브랜치와 태그를 그대로 생성하므로 매우 빠릅니다.
- 충돌이 발생할 가능성이 없습니다.

### 동기화 모드 (Sync Mode)

**언제 사용되나?**

- 이미 코드가 들어있는 저장소에 외부의 추가 변경사항을 반영(동기화)할 때 사용됩니다. (기본 동작)

**특징:**

- 내부 저장소의 브랜치와 외부 저장소의 브랜치를 `git merge` 합니다.
- 양쪽의 히스토리가 모두 보존됩니다.
- 만약 같은 부분을 다르게 수정했다면 Merge 충돌이 발생할 수 있습니다.

---

## 설정 파일 (`config.json`)

반복적인 작업을 자동화하기 위해 프로젝트 루트에 `config.json` 파일을 생성할 수 있습니다.

**예시:**

```json
{
  "autoMergeBranches": ["main", "develop"],
  "skipBranches": ["feature/.*", "hotfix"],
  "autoPush": true,
  "conflictStrategy": "manual"
}
```

- `autoMergeBranches`: `--auto` 모드에서 자동으로 merge를 시도할 브랜치 목록 (정규식 가능).
- `skipBranches`: `import` 과정에서 무시할 브랜치 목록 (정규식 가능).
- `autoPush`: `--auto` 모드에서 merge 성공 시 자동으로 `origin`에 push할지 여부.
- `conflictStrategy`: 충돌 시 정책. (현재는 `manual`만 지원)

---

## 상황별 가이드

### 최초로 저장소 전체 이동하기

1.  **외부망 PC**: `cd /project` -> `gitmv export`
2.  `git-export-....zip` 파일을 USB 등으로 내부망 PC에 복사합니다.
3.  **내부망 PC**:
    ```bash
    mkdir my-project && cd my-project
    git init
    git remote add origin <내부망 Git 서버 주소>
    gitmv import /path/to/git-export-....zip
    ```
4.  스크립트가 '초기 모드'를 제안하면 `Yes`를 선택합니다.

### 주기적으로 변경사항 동기화하기

1.  **외부망 PC**: `cd /project` -> (작업 및 커밋) -> `gitmv export`
2.  `.zip` 파일을 내부망 PC로 복사합니다.
3.  **내부망 PC**:
    ```bash
    cd /internal-project
    gitmv import /path/to/git-export-....zip
    ```
4.  스크립트가 동기화할 브랜치를 보여주면, 원하는 브랜치를 선택하고 진행합니다.

### Merge 충돌 해결하기

1.  `import` 중 충돌이 발생하면 스크립트가 멈추고 충돌된 파일 목록을 보여줍니다.
2.  VS Code 등 에디터에서 해당 파일들의 충돌 부분을 직접 수정합니다.
3.  수정이 완료되면, 터미널에서 `git add .`와 `git commit`으로 merge 커밋을 직접 완료합니다.
4.  `gitmv import ...` 명령어를 다시 실행하면, 스크립트가 해결된 상태를 감지하고 나머지 과정을 이어갑니다.

---

## 문제 해결 (Troubleshooting)

- **`command not found: gitmv`**: `npm install -g` 로 설치했는지, 터미널을 재시작했는지 확인하세요. 자세한 내용은 `INSTALL.md`를 참고하세요.
- **`Not a Git repository`**: Git 저장소 안에서 명령어를 실행해야 합니다. `git init`으로 저장소를 생성하세요.
- **`Working directory is not clean`**: 커밋하지 않은 변경사항이 남아있습니다. `git commit` 또는 `git stash`로 작업 내용을 정리한 후 다시 시도하세요.

---

## 작동 원리

`git-move-offline`은 Git의 내장 기능인 `git bundle`을 핵심적으로 사용합니다. `git bundle`은 Git 저장소의 모든 객체(커밋, 브랜치, 태그 등)를 하나의 바이너리 파일로 묶어주는 기능으로, 네트워크 없이도 `git clone`, `fetch`가 가능하게 해줍니다.

- **Export**: `git bundle create` 명령으로 `.bundle` 파일을 생성하고, 메타데이터와 함께 압축합니다.
- **Import**: `.bundle` 파일을 임시 remote로 추가한 뒤, `git fetch`와 `git merge`를 실행하여 현재 저장소에 변경사항을 적용합니다.
