#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GitUtils = require('./lib/git-utils');
const ZipUtils = require('./lib/zip-utils');
const Interactive = require('./lib/interactive');
const { getMessage } = require('./lib/i18n');

const REMOTE_NAME = 'git-import-temp';

async function importRepository() {
  console.log(getMessage('importTitle'));

  // 1. Parse arguments
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log(getMessage('importUsage'));
    console.log(`\n${getMessage('optionsTitle')}`);
    console.log(`  --init              ${getMessage('initOption')}`);
    console.log(`  --auto              ${getMessage('autoOption')}`);
    console.log(`  --dry-run           ${getMessage('dryRunOption')}`);
    console.log(`  --branch <names>    ${getMessage('branchOption')}`);
    console.log(`\n${getMessage('examplesTitle')}`);
    console.log(`  ${getMessage('importExample1')}`);
    console.log(`  ${getMessage('importExample2')}`);
    console.log(`  ${getMessage('importExample3')}`);
    process.exit(1);
  }

  const zipFilePath = path.resolve(args[0]);
  const initMode = args.includes('--init');
  const autoMode = args.includes('--auto');
  const dryRun = args.includes('--dry-run');
  const branchIndex = args.indexOf('--branch');
  const specificBranches = branchIndex !== -1 && args[branchIndex + 1]
    ? args[branchIndex + 1].split(',').map(b => b.trim())
    : null;

  if (dryRun) {
    Interactive.warning(getMessage('dryRunMode'));
  }

  // 2. Check ZIP file
  if (!fs.existsSync(zipFilePath)) {
    Interactive.error(getMessage('zipNotFound', zipFilePath));
    process.exit(1);
  }

  const repoPath = process.cwd();
  const git = new GitUtils(repoPath);

  // 3. Check Git repository
  Interactive.showProgress(getMessage('checkGitRepo'));
  if (!git.isGitRepo()) {
    Interactive.completeProgress(false);
    Interactive.error(getMessage('notGitRepoImport'));
    process.exit(1);
  }
  Interactive.completeProgress(true);

  // 4. Check repository status and auto-detect mode
  const isEmptyRepo = git.isEmptyRepo();
  const localBranches = git.getLocalBranches();
  const commitCount = git.getCommitCount();

  let useInitMode = initMode;

  // Auto-detect: If empty repository or no commits, suggest init mode
  if (!initMode && (isEmptyRepo || commitCount === 0)) {
    Interactive.info(getMessage('emptyRepo'));
    console.log(getMessage('noCommits'));

    if (!autoMode) {
      const useInit = await Interactive.confirm(
        getMessage('useInitMode'),
        true
      );
      useInitMode = useInit;
    } else {
      useInitMode = true;
      console.log(getMessage('autoInitMode'));
    }
  }

  if (useInitMode) {
    Interactive.info(getMessage('initModeInfo'));
  } else {
    Interactive.info(getMessage('syncModeInfo'));
  }

  // Check working directory status (only when not in init mode)
  if (!useInitMode && git.hasUncommittedChanges()) {
    Interactive.error(getMessage('uncommittedChangesImport'));
    process.exit(1);
  }

  const currentBranch = git.hasAnyCommits() ? git.getCurrentBranch() : null;
  if (currentBranch) {
    console.log(getMessage('currentBranchImport', currentBranch));
  }

  // 5. Create temporary directory and extract ZIP
  const tempDir = path.join(repoPath, '.git-import-temp');
  ZipUtils.ensureDir(tempDir);

  let cleanup = () => {
    if (fs.existsSync(tempDir)) {
      ZipUtils.deletePath(tempDir);
    }
    git.removeRemote(REMOTE_NAME);
  };

  try {
    Interactive.showProgress(getMessage('extractingZip'));
    await ZipUtils.extractZip(zipFilePath, tempDir);
    Interactive.completeProgress(true);

    // 6. Load metadata
    const metadataPath = path.join(tempDir, 'metadata.json');
    if (!fs.existsSync(metadataPath)) {
      throw new Error(getMessage('invalidExportFile'));
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    console.log(getMessage('exportedRepoInfo'));
    console.log(getMessage('exportDate', new Date(metadata.exportDate).toLocaleString()));
    console.log(getMessage('originalBranch', metadata.currentBranch));
    console.log(getMessage('totalBranches', metadata.branches.length));
    console.log(getMessage('totalTags', metadata.tags.length));

    // 7. Verify bundle
    const bundlePath = path.join(tempDir, 'repository.bundle');
    Interactive.showProgress(getMessage('verifyingBundleImport'));
    if (!git.verifyBundle(bundlePath)) {
      throw new Error(getMessage('bundleFailed'));
    }
    Interactive.completeProgress(true);

    // 8. Add remote and fetch
    Interactive.showProgress(getMessage('addingRemote', REMOTE_NAME));
    git.removeRemote(REMOTE_NAME); // Remove if exists
    git.addRemote(REMOTE_NAME, bundlePath);
    Interactive.completeProgress(true);

    Interactive.showProgress(getMessage('fetchingCommits'));
    if (!dryRun) {
      git.fetchFromRemote(REMOTE_NAME);
    }
    Interactive.completeProgress(true);

    // 9. Select branches
    let branchesToMerge = metadata.branches;

    if (specificBranches) {
      branchesToMerge = branchesToMerge.filter(b => specificBranches.includes(b));
      console.log(getMessage('filteredBranches', branchesToMerge.join(', ')));
    } else if (!autoMode) {
      // Interactive mode
      branchesToMerge = await Interactive.multiSelect(
        getMessage('selectBranches'),
        metadata.branches,
        [metadata.currentBranch]
      );
    }

    if (branchesToMerge.length === 0) {
      Interactive.warning(getMessage('noBranchesSelected'));
      cleanup();
      process.exit(0);
    }

    console.log(getMessage('branchesToMerge', branchesToMerge.join(', ')));

    // 10. Process branches (behavior differs by mode)
    const mergeResults = [];

    if (useInitMode) {
      // ===== Initial Import Mode: Direct checkout =====
      for (const branch of branchesToMerge) {
        console.log(getMessage('processingBranch', branch));

        const remoteBranch = `${REMOTE_NAME}/${branch}`;
        const branchInfo = metadata.branchMetadata[branch];

        if (branchInfo) {
          console.log(getMessage('latestCommit', branchInfo.hash.substring(0, 7)));
          console.log(getMessage('message', branchInfo.message));
          console.log(getMessage('author', branchInfo.author));
        }

        if (!dryRun) {
          // Direct checkout from bundle (no merge)
          git.execGit(`checkout -b ${branch} ${remoteBranch}`);
          console.log(getMessage('createdBranch', branch));
        } else {
          console.log(getMessage('wouldCreateBranch', branch));
        }

        mergeResults.push({ branch, status: 'created', conflicts: [] });
      }

    } else {
      // ===== Sync Mode: Merge approach =====
      for (const branch of branchesToMerge) {
        console.log(getMessage('processingBranch', branch));

        const remoteBranch = `${REMOTE_NAME}/${branch}`;
        const branchInfo = metadata.branchMetadata[branch];

        if (branchInfo) {
          console.log(getMessage('latestCommit', branchInfo.hash.substring(0, 7)));
          console.log(getMessage('message', branchInfo.message));
          console.log(getMessage('author', branchInfo.author));
        }

        // Check if local branch with same name exists
        const hasLocalBranch = localBranches.includes(branch);

        if (!hasLocalBranch) {
          // Create new branch if doesn't exist locally
          const action = await Interactive.select(
            getMessage('branchExists', branch),
            [getMessage('createAndCheckout'), getMessage('skip')]
          );

          if (action === getMessage('skip')) {
            console.log(getMessage('skipped', branch));
            continue;
          }

          if (!dryRun) {
            git.execGit(`checkout -b ${branch} ${remoteBranch}`);
            console.log(getMessage('createdAndCheckedOut', branch));
          } else {
            console.log(getMessage('wouldCreateAndCheckout', branch));
          }

          mergeResults.push({ branch, status: 'created', conflicts: [] });
          continue;
        }

        // Confirm before merge
        if (!autoMode && !dryRun) {
          const shouldMerge = await Interactive.confirm(getMessage('confirmMerge', remoteBranch, branch), true);
          if (!shouldMerge) {
            console.log(getMessage('skipped', branch));
            continue;
          }
        }

        // Checkout to target branch (if not current)
        const currentActiveBranch = git.hasAnyCommits() ? git.getCurrentBranch() : null;
        if (currentActiveBranch && currentActiveBranch !== branch) {
          if (!dryRun) {
            git.execGit(`checkout ${branch}`);
          } else {
            console.log(getMessage('wouldCheckout', branch));
          }
        }

        // Execute merge
        if (!dryRun) {
          const result = git.mergeBranch(remoteBranch, {
            message: `Merge external changes from ${branch}`,
            noFastForward: true
          });

          if (result.success) {
            console.log(getMessage('mergedSuccessfully'));
            mergeResults.push({ branch, status: 'merged', conflicts: [] });
          } else {
            Interactive.warning(getMessage('mergeConflict', branch));
            console.log(getMessage('conflictedFiles'));
            result.conflicts.forEach(file => console.log(`    - ${file}`));

            mergeResults.push({ branch, status: 'conflict', conflicts: result.conflicts });

            Interactive.info(getMessage('resolveConflicts'));
            console.log(getMessage('resolveStep1'));
            console.log(getMessage('resolveStep2'));
            console.log(getMessage('resolveStep3'));
            console.log(getMessage('resolveStep4'));

            // Stop on conflict
            cleanup();
            process.exit(1);
          }
        } else {
          console.log(getMessage('wouldMerge', remoteBranch, branch));
          mergeResults.push({ branch, status: 'simulated', conflicts: [] });
        }
      }
    }

    // 11. Summary results
    console.log(getMessage('mergeSummary'));
    Interactive.printTable(
      [getMessage('branchColumn'), getMessage('statusColumn'), getMessage('conflictsColumn')],
      mergeResults.map(r => [
        r.branch,
        r.status.toUpperCase(),
        r.conflicts.length > 0 ? r.conflicts.length.toString() : '-'
      ])
    );

    // 12. Confirm push
    if (!dryRun && mergeResults.some(r => r.status === 'merged' || r.status === 'created')) {
      const remoteUrl = git.getRemoteUrl('origin');
      if (remoteUrl) {
        console.log(getMessage('remoteUrl', remoteUrl));
        const shouldPush = await Interactive.confirm(getMessage('confirmPush'), false);

        if (shouldPush) {
          Interactive.showProgress(getMessage('pushing'));
          for (const result of mergeResults) {
            if (result.status === 'merged' || result.status === 'created') {
              git.push('origin', result.branch);
            }
          }
          Interactive.completeProgress(true);
          Interactive.success(getMessage('pushedSuccessfully'));
        } else {
          Interactive.info(getMessage('notPushed'));
        }
      } else {
        Interactive.warning(getMessage('noOrigin'));
      }
    }

    // 13. Cleanup
    Interactive.showProgress(getMessage('cleaningUpImport'));
    cleanup();
    Interactive.completeProgress(true);

    // 14. Complete
    if (dryRun) {
      Interactive.printBox(getMessage('dryRunComplete'), [
        getMessage('noChangesMade'),
        getMessage('reviewActions')
      ]);
    } else {
      Interactive.printBox(getMessage('importComplete'), [
        getMessage('mergedBranches', mergeResults.filter(r => r.status === 'merged').length),
        getMessage('createdBranches', mergeResults.filter(r => r.status === 'created').length),
        '',
        getMessage('repoUpdated')
      ]);
    }

  } catch (error) {
    Interactive.error(error.message);
    cleanup();
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  importRepository().catch(error => {
    Interactive.error(error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = importRepository;