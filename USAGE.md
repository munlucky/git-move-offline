# 사용 가이드

## 시나리오별 사용법

### 1. 최초 1회 전체 이동

외부에서 개발한 프로젝트를 처음으로 사내망으로 가져오는 경우:

```bash
# 외부 PC
cd /path/to/project
npm install
node export.js

# 사내망 PC (빈 저장소 준비)
git init
git remote add origin https://internal-git.company.com/project.git
node import.js git-export-20251025.zip --auto
```

### 2. 정기적 동기화

이미 사내망에 프로젝트가 있고, 외부 변경사항을 주기적으로 반영하는 경우:

```bash
# 외부 PC (최신 커밋 반영 후)
node export.js

# 사내망 PC (기존 프로젝트 디렉토리)
cd /path/to/existing-project
node import.js git-export-20251025.zip
# → 인터랙티브 모드에서 merge할 브랜치 선택
```

### 3. 특정 브랜치만 동기화

```bash
# main과 develop 브랜치만 가져오기
node import.js git-export-20251025.zip --branch main,develop
```

### 4. Dry-Run으로 사전 확인

```bash
# 실제 변경 없이 시뮬레이션
node import.js git-export-20251025.zip --dry-run
```

## Merge 충돌 해결

충돌이 발생한 경우:

```bash
# 1. Import 중 충돌 발생 시 스크립트가 중단되고 충돌 파일 표시됨
# 2. 수동으로 충돌 해결
code src/conflicted-file.js  # 파일 편집

# 3. 해결된 파일 스테이징
git add src/conflicted-file.js

# 4. Merge 커밋 완료
git commit

# 5. 나머지 브랜치가 있다면 import 재실행
node import.js git-export-20251025.zip
```

## 자동화 설정

`config.json` 파일 생성:

```json
{
  "autoMergeBranches": ["main", "develop"],
  "skipBranches": ["experimental"],
  "autoPush": false
}
```

자동 모드 실행:

```bash
node import.js git-export-20251025.zip --auto
```

## 주의사항

### Export 시
- 미커밋된 변경사항은 포함되지 않음
- 모든 브랜치와 태그가 포함됨
- Bundle 검증이 자동으로 수행됨

### Import 시
- 기존 작업 디렉토리가 깨끗해야 함 (커밋되지 않은 변경사항 없음)
- 기존 히스토리와 병합되므로 양쪽 히스토리 모두 보존됨
- Merge 전 항상 확인 프롬프트 제공 (auto 모드 제외)

## 트러블슈팅

### "Not a Git repository" 에러
```bash
# Git 저장소가 아닌 디렉토리에서 실행한 경우
git init
git remote add origin <url>
```

### Bundle 검증 실패
- ZIP 파일이 손상되었을 가능성
- 다시 export 후 재시도

### Remote origin이 없음
```bash
# Origin remote 추가
git remote add origin https://internal-git.company.com/project.git
```

### Push 권한 없음
- 사내 Git 서버 접근 권한 확인
- 수동으로 push: `git push origin <branch-name>`

## 작업 흐름 예시

### 주간 동기화 프로세스

**매주 금요일 (외부 PC):**
```bash
cd /project
git pull origin main
git pull origin develop
node export.js
# → USB에 zip 파일 복사
```

**매주 월요일 (사내망 PC):**
```bash
cd /internal-project
# USB에서 zip 파일 복사
node import.js git-export-20251025.zip
# → main, develop 선택
# → 확인 후 push
```

## 파일 구조

Export된 ZIP 파일 내용:
```
git-export-20251025-143020.zip
├── repository.bundle      # 전체 Git 히스토리
└── metadata.json         # 브랜치/태그 정보
```

## Git Bundle이란?

Git Bundle은 Git의 공식 기능으로, 전체 저장소를 단일 파일로 패키징합니다:
- 모든 커밋, 브랜치, 태그 포함
- Git의 무결성 검증 기능 활용
- 네트워크 없이 저장소 복제 가능
- `git clone` 대신 bundle 파일 사용 가능

## 보안 고려사항

- ZIP 파일에는 전체 소스코드와 히스토리가 포함됨
- 이동 중 파일 암호화 권장
- 민감한 정보 (.env 등) 제외 확인
- USB 이동 시 분실 주의

## 성능 팁

- 대용량 저장소는 bundle 생성에 시간 소요
- 불필요한 브랜치 정리 후 export 권장
- Git LFS 파일은 별도 처리 필요할 수 있음
