#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GitUtils = require('./lib/git-utils');
const ZipUtils = require('./lib/zip-utils');
const Interactive = require('./lib/interactive');

async function exportRepository() {
  console.log('=== Git Export Tool ===\n');

  const repoPath = process.cwd();
  const git = new GitUtils(repoPath);

  // 1. Git 저장소 확인
  Interactive.showProgress('Checking Git repository');
  if (!git.isGitRepo()) {
    Interactive.completeProgress(false);
    Interactive.error('Not a Git repository. Please run this in a Git project directory.');
    process.exit(1);
  }
  Interactive.completeProgress(true);

  // 2. 변경사항 확인
  if (git.hasUncommittedChanges()) {
    Interactive.warning('You have uncommitted changes. These will not be included in the export.');
    const shouldContinue = await Interactive.confirm('Continue anyway?');
    if (!shouldContinue) {
      console.log('Export cancelled.');
      process.exit(0);
    }
  }

  // 3. 메타데이터 수집
  Interactive.showProgress('Collecting repository metadata');
  const currentBranch = git.getCurrentBranch();
  const branches = git.getLocalBranches();
  const tags = git.getAllTags();
  const branchMetadata = git.getBranchMetadata();
  const tagMetadata = git.getTagMetadata();

  const metadata = {
    exportDate: new Date().toISOString(),
    currentBranch,
    branches,
    tags,
    branchMetadata,
    tagMetadata,
    repositoryPath: repoPath
  };
  Interactive.completeProgress(true);

  // 4. 메타데이터 표시
  console.log('\nRepository Information:');
  console.log(`  Current Branch: ${currentBranch}`);
  console.log(`  Total Branches: ${branches.length}`);
  console.log(`  Total Tags: ${tags.length}`);

  if (branches.length > 0) {
    console.log('\nBranches:');
    branches.forEach(branch => {
      const info = branchMetadata[branch];
      const marker = branch === currentBranch ? '* ' : '  ';
      console.log(`${marker}${branch} (${info.hash.substring(0, 7)})`);
    });
  }

  const shouldProceed = await Interactive.confirm('\nProceed with export?', true);
  if (!shouldProceed) {
    console.log('Export cancelled.');
    process.exit(0);
  }

  // 5. 임시 디렉토리 생성
  const tempDir = path.join(repoPath, '.git-export-temp');
  ZipUtils.ensureDir(tempDir);

  try {
    // 6. Bundle 생성
    Interactive.showProgress('Creating Git bundle (this may take a while)');
    const bundlePath = path.join(tempDir, 'repository.bundle');
    git.createBundle(bundlePath, '--all');
    Interactive.completeProgress(true);

    // Bundle 검증
    Interactive.showProgress('Verifying bundle integrity');
    const isValid = git.verifyBundle(bundlePath);
    if (!isValid) {
      throw new Error('Bundle verification failed');
    }
    Interactive.completeProgress(true);

    const bundleSize = ZipUtils.getFileSize(bundlePath);
    console.log(`  Bundle size: ${ZipUtils.formatBytes(bundleSize)}`);

    // 7. 메타데이터 파일 생성
    const metadataPath = path.join(tempDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // 8. ZIP 압축
    const timestamp = ZipUtils.getTimestamp();
    const zipFileName = `git-export-${timestamp}.zip`;
    const zipPath = path.join(repoPath, zipFileName);

    Interactive.showProgress('Creating ZIP archive');
    await ZipUtils.createZip([
      { path: bundlePath, name: 'repository.bundle' },
      { path: metadataPath, name: 'metadata.json' }
    ], zipPath);
    Interactive.completeProgress(true);

    const zipSize = ZipUtils.getFileSize(zipPath);
    console.log(`  ZIP size: ${ZipUtils.formatBytes(zipSize)}`);

    // 9. 정리
    Interactive.showProgress('Cleaning up temporary files');
    ZipUtils.deletePath(tempDir);
    Interactive.completeProgress(true);

    // 10. 완료
    Interactive.printBox('Export Complete!', [
      `File: ${zipFileName}`,
      `Size: ${ZipUtils.formatBytes(zipSize)}`,
      `Location: ${zipPath}`,
      '',
      'Next steps:',
      '1. Copy this ZIP file to your offline environment',
      '2. Run: gitmv import <zip-file-path>'
    ], 70);

  } catch (error) {
    // 에러 발생 시 정리
    Interactive.error(error.message);
    if (fs.existsSync(tempDir)) {
      ZipUtils.deletePath(tempDir);
    }
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  exportRepository().catch(error => {
    Interactive.error(error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = exportRepository;
