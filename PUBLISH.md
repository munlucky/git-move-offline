# npm 배포 가이드

이 문서는 git-move-offline 패키지를 npm에 배포하는 방법을 안내합니다.

## 사전 준비

### 1. npm 계정 생성

```bash
# 웹사이트에서 가입
# https://www.npmjs.com/signup

# 또는 CLI로 가입
npm adduser
```

### 2. npm 로그인

```bash
npm login
# Username: your-username
# Password: ********
# Email: your@email.com
# OTP: (2FA 활성화 시)
```

### 3. 로그인 확인

```bash
npm whoami
# 출력: your-username
```

## 배포 전 준비

### 1. package.json 업데이트

**필수 수정 사항:**

```json
{
  "author": "Your Name <your@email.com>",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/YOUR-USERNAME/git-move-offline.git"
  },
  "bugs": {
    "url": "https://github.com/YOUR-USERNAME/git-move-offline/issues"
  },
  "homepage": "https://github.com/YOUR-USERNAME/git-move-offline#readme"
}
```

**선택 사항:**

- README.md에 배지 추가
- LICENSE 파일 확인
- CHANGELOG.md 작성

### 2. 패키지 이름 중복 확인

```bash
# 이름이 사용 가능한지 확인
npm search git-move-offline

# 또는 웹에서 확인
# https://www.npmjs.com/package/git-move-offline
```

**이름이 이미 사용중이라면:**

- 스코프 사용: `@yourusername/git-move-offline`
- 다른 이름 사용: `gmo-cli`, `git-offline-sync` 등

### 3. .npmignore 생성 (선택)

package.json의 `files` 필드로 이미 제어하고 있지만, 추가 제외가 필요하면:

```
# .npmignore
.git/
.github/
test/
*.log
.env
.DS_Store
```

## 배포 단계

### Step 1: 버전 확인

```bash
# 현재 버전 확인
npm version

# 버전 업데이트 (필요시)
npm version patch    # 1.0.0 → 1.0.1
npm version minor    # 1.0.0 → 1.1.0
npm version major    # 1.0.0 → 2.0.0
```

### Step 2: 로컬 테스트

```bash
# 패키지 내용 확인 (실제 생성 안 함)
npm pack --dry-run

# 패키지 생성
npm pack

# 로컬 설치 테스트
npm install -g ./git-move-offline-1.0.0.tgz

# 명령어 테스트
gitmv --version
gitmv --help

# 제거
npm uninstall -g git-move-offline
```

### Step 3: Git 태그 생성 (권장)

```bash
# 버전 태그 생성
git tag v1.0.0
git push origin v1.0.0
```

### Step 4: npm에 배포

```bash
# 공개 패키지로 배포
npm publish --access public

# 또는 (이미 public이면)
npm publish
```

**배포 중 확인 사항:**

- ✓ 패키지 크기
- ✓ 포함된 파일 목록
- ✓ 경고 메시지

### Step 5: 배포 확인

```bash
# npm 웹사이트에서 확인
# https://www.npmjs.com/package/git-move-offline

# 공개 설치 테스트
npm install -g git-move-offline

# 동작 확인
gitmv --version
```

## 업데이트 배포

### 1. 코드 수정 후

```bash
# 버전 업데이트
npm version patch  # 버그 수정
npm version minor  # 새 기능 추가
npm version major  # 호환성 깨지는 변경

# Git에 푸시
git push origin master
git push --tags

# npm에 재배포
npm publish
```

### 2. 패키지 상태 확인

```bash
# 배포된 버전 확인
npm view git-move-offline

# 모든 버전 확인
npm view git-move-offline versions

# 다운로드 통계
npm view git-move-offline
```

## 문제 해결

### "You do not have permission to publish"

**원인:** 패키지 이름이 이미 존재하거나 권한 없음

**해결:**

```bash
# 스코프 추가
# package.json의 name을 "@yourusername/git-move-offline"로 변경

# 재배포
npm publish --access public
```

### "Invalid package name"

**원인:** npm 패키지 이름 규칙 위반

**규칙:**

- 소문자만 사용
- URL-safe 문자만 사용 (하이픈, 언더스코어 가능)
- 214자 이하

### "402 Payment Required"

**원인:** 비공개 패키지를 무료 계정에서 배포

**해결:**

```bash
npm publish --access public
```

### "Need to provide OTP"

**원인:** 2FA 활성화됨

**해결:**

```bash
npm publish --otp=123456
# 또는 프롬프트에서 입력
```

## 패키지 삭제/철회

### 배포 취소 (24시간 이내)

```bash
# 특정 버전 삭제
npm unpublish git-move-offline@1.0.0

# 전체 패키지 삭제 (주의!)
npm unpublish git-move-offline --force
```

**주의:** 24시간 이후에는 삭제 불가, deprecate만 가능

### Deprecate (권장)

```bash
# 특정 버전 사용 중지 표시
npm deprecate git-move-offline@1.0.0 "보안 이슈 있음, 1.0.1 사용 권장"

# 모든 버전
npm deprecate git-move-offline "더 이상 유지보수 안 함"
```

## 체크리스트

배포 전 최종 확인:

- [ ] npm 계정 생성 및 로그인
- [ ] package.json의 author, repository 업데이트
- [ ] 패키지 이름 중복 확인
- [ ] README.md 작성 완료
- [ ] LICENSE 파일 존재
- [ ] `npm pack --dry-run` 결과 확인
- [ ] 로컬 설치 테스트 완료
- [ ] Git 커밋 및 태그 생성
- [ ] `npm publish` 실행
- [ ] npm 웹사이트에서 확인
- [ ] 공개 설치 테스트

## 참고 자료

- npm 공식 문서: https://docs.npmjs.com/
- 패키지 배포 가이드: https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry
- Semantic Versioning: https://semver.org/
