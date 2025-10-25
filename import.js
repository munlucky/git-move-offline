#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GitUtils = require('./lib/git-utils');
const ZipUtils = require('./lib/zip-utils');
const Interactive = require('./lib/interactive');

const REMOTE_NAME = 'git-import-temp';

async function importRepository() {
  console.log('=== Git Import Tool ===\n');

  // 1. 인자 파싱
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node import.js <zip-file-path> [options]');
    console.log('\nOptions:');
    console.log('  --auto              Auto mode using config.json');
    console.log('  --dry-run           Simulate without making changes');
    console.log('  --branch <names>    Only merge specified branches (comma-separated)');
    console.log('\nExample:');
    console.log('  node import.js git-export-20251025.zip');
    console.log('  node import.js git-export-20251025.zip --branch main,develop');
    process.exit(1);
  }

  const zipFilePath = path.resolve(args[0]);
  const autoMode = args.includes('--auto');
  const dryRun = args.includes('--dry-run');
  const branchIndex = args.indexOf('--branch');
  const specificBranches = branchIndex !== -1 && args[branchIndex + 1]
    ? args[branchIndex + 1].split(',').map(b => b.trim())
    : null;

  if (dryRun) {
    Interactive.warning('DRY-RUN MODE: No actual changes will be made');
  }

  // 2. ZIP 파일 확인
  if (!fs.existsSync(zipFilePath)) {
    Interactive.error(`ZIP file not found: ${zipFilePath}`);
    process.exit(1);
  }

  const repoPath = process.cwd();
  const git = new GitUtils(repoPath);

  // 3. Git 저장소 확인
  Interactive.showProgress('Checking Git repository');
  if (!git.isGitRepo()) {
    Interactive.completeProgress(false);
    Interactive.error('Not a Git repository. Please run this in your existing Git project directory.');
    process.exit(1);
  }
  Interactive.completeProgress(true);

  // 4. 작업 디렉토리 상태 확인
  if (git.hasUncommittedChanges()) {
    Interactive.error('You have uncommitted changes. Please commit or stash them before importing.');
    process.exit(1);
  }

  const currentBranch = git.getCurrentBranch();
  console.log(`Current branch: ${currentBranch}`);

  // 5. 임시 디렉토리 생성 및 압축 해제
  const tempDir = path.join(repoPath, '.git-import-temp');
  ZipUtils.ensureDir(tempDir);

  let cleanup = () => {
    if (fs.existsSync(tempDir)) {
      ZipUtils.deletePath(tempDir);
    }
    git.removeRemote(REMOTE_NAME);
  };

  try {
    Interactive.showProgress('Extracting ZIP archive');
    await ZipUtils.extractZip(zipFilePath, tempDir);
    Interactive.completeProgress(true);

    // 6. 메타데이터 로드
    const metadataPath = path.join(tempDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error('Invalid export file: metadata.json not found');
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log('\nExported Repository Information:');
    console.log(`  Export Date: ${new Date(metadata.exportDate).toLocaleString()}`);
    console.log(`  Original Branch: ${metadata.currentBranch}`);
    console.log(`  Total Branches: ${metadata.branches.length}`);
    console.log(`  Total Tags: ${metadata.tags.length}`);

    // 7. Bundle 검증
    const bundlePath = path.join(tempDir, 'repository.bundle');
    Interactive.showProgress('Verifying bundle');
    if (!git.verifyBundle(bundlePath)) {
      throw new Error('Bundle verification failed');
    }
    Interactive.completeProgress(true);

    // 8. Remote 추가 및 fetch
    Interactive.showProgress(`Adding temporary remote: ${REMOTE_NAME}`);
    git.removeRemote(REMOTE_NAME); // 기존에 있으면 제거
    git.addRemote(REMOTE_NAME, bundlePath);
    Interactive.completeProgress(true);

    Interactive.showProgress('Fetching commits from bundle');
    if (!dryRun) {
      git.fetchFromRemote(REMOTE_NAME);
    }
    Interactive.completeProgress(true);

    // 9. 브랜치 선택
    let branchesToMerge = metadata.branches;

    if (specificBranches) {
      branchesToMerge = branchesToMerge.filter(b => specificBranches.includes(b));
      console.log(`\nFiltered branches: ${branchesToMerge.join(', ')}`);
    } else if (!autoMode) {
      // 인터랙티브 모드
      branchesToMerge = await Interactive.multiSelect(
        '\nSelect branches to merge:',
        metadata.branches,
        [metadata.currentBranch]
      );
    }

    if (branchesToMerge.length === 0) {
      Interactive.warning('No branches selected for merge');
      cleanup();
      process.exit(0);
    }

    console.log(`\nBranches to merge: ${branchesToMerge.join(', ')}`);

    // 10. Merge 시뮬레이션 또는 실행
    const mergeResults = [];

    for (const branch of branchesToMerge) {
      console.log(`\n--- Processing branch: ${branch} ---`);

      const remoteBranch = `${REMOTE_NAME}/${branch}`;
      const branchInfo = metadata.branchMetadata[branch];

      if (branchInfo) {
        console.log(`  Latest commit: ${branchInfo.hash.substring(0, 7)}`);
        console.log(`  Message: ${branchInfo.message}`);
        console.log(`  Author: ${branchInfo.author}`);
      }

      // 로컬에 같은 이름의 브랜치가 있는지 확인
      const localBranches = git.getLocalBranches();
      const hasLocalBranch = localBranches.includes(branch);

      let action = 'merge';
      if (!hasLocalBranch) {
        // 로컬에 없으면 새로 생성
        action = await Interactive.select(
          `Branch '${branch}' does not exist locally. What to do?`,
          ['Create and checkout', 'Skip']
        );

        if (action === 'Skip') {
          console.log(`  Skipped: ${branch}`);
          continue;
        }

        if (!dryRun) {
          git.execGit(`checkout -b ${branch} ${remoteBranch}`);
          console.log(`  ✓ Created and checked out branch: ${branch}`);
        } else {
          console.log(`  [DRY-RUN] Would create and checkout branch: ${branch}`);
        }

        mergeResults.push({ branch, status: 'created', conflicts: [] });
        continue;
      }

      // Merge 전 확인
      if (!autoMode && !dryRun) {
        const shouldMerge = await Interactive.confirm(`Merge ${remoteBranch} into ${branch}?`, true);
        if (!shouldMerge) {
          console.log(`  Skipped: ${branch}`);
          continue;
        }
      }

      // 해당 브랜치로 체크아웃 (현재 브랜치가 아니면)
      if (git.getCurrentBranch() !== branch) {
        if (!dryRun) {
          git.execGit(`checkout ${branch}`);
        } else {
          console.log(`  [DRY-RUN] Would checkout: ${branch}`);
        }
      }

      // Merge 실행
      if (!dryRun) {
        const result = git.mergeBranch(remoteBranch, {
          message: `Merge external changes from ${branch}`,
          noFastForward: true
        });

        if (result.success) {
          console.log(`  ✓ Merged successfully`);
          mergeResults.push({ branch, status: 'merged', conflicts: [] });
        } else {
          Interactive.warning(`Merge conflicts detected in branch: ${branch}`);
          console.log('  Conflicted files:');
          result.conflicts.forEach(file => console.log(`    - ${file}`));

          mergeResults.push({ branch, status: 'conflict', conflicts: result.conflicts });

          Interactive.info('Please resolve conflicts manually:');
          console.log('  1. Edit conflicted files');
          console.log('  2. git add <resolved-files>');
          console.log('  3. git commit');
          console.log('  4. Re-run this import script\n');

          // 충돌 발생 시 중단
          cleanup();
          process.exit(1);
        }
      } else {
        console.log(`  [DRY-RUN] Would merge: ${remoteBranch} into ${branch}`);
        mergeResults.push({ branch, status: 'simulated', conflicts: [] });
      }
    }

    // 11. 결과 요약
    console.log('\n=== Merge Summary ===');
    Interactive.printTable(
      ['Branch', 'Status', 'Conflicts'],
      mergeResults.map(r => [
        r.branch,
        r.status.toUpperCase(),
        r.conflicts.length > 0 ? r.conflicts.length.toString() : '-'
      ])
    );

    // 12. Push 확인
    if (!dryRun && mergeResults.some(r => r.status === 'merged' || r.status === 'created')) {
      const remoteUrl = git.getRemoteUrl('origin');
      if (remoteUrl) {
        console.log(`\nRemote URL: ${remoteUrl}`);
        const shouldPush = await Interactive.confirm('Push changes to remote?', false);

        if (shouldPush) {
          Interactive.showProgress('Pushing to remote');
          for (const result of mergeResults) {
            if (result.status === 'merged' || result.status === 'created') {
              git.push('origin', result.branch);
            }
          }
          Interactive.completeProgress(true);
          Interactive.success('All changes pushed successfully!');
        } else {
          Interactive.info('Changes merged locally but not pushed. You can push manually later.');
        }
      } else {
        Interactive.warning('No remote "origin" configured. Changes merged locally only.');
      }
    }

    // 13. 정리
    Interactive.showProgress('Cleaning up');
    cleanup();
    Interactive.completeProgress(true);

    // 14. 완료
    if (dryRun) {
      Interactive.printBox('Dry-Run Complete!', [
        'No actual changes were made.',
        'Review the simulated actions above.'
      ]);
    } else {
      Interactive.printBox('Import Complete!', [
        `Merged ${mergeResults.filter(r => r.status === 'merged').length} branches`,
        `Created ${mergeResults.filter(r => r.status === 'created').length} branches`,
        '',
        'Your repository has been updated with external changes.'
      ]);
    }

  } catch (error) {
    Interactive.error(error.message);
    cleanup();
    process.exit(1);
  }
}

// 실행
if (require.main === module) {
  importRepository().catch(error => {
    Interactive.error(error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = importRepository;
