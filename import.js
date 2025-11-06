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
    console.log(
      `  --allow-unrelated-histories  ${getMessage('allowUnrelatedOption')}`
    );
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
  const allowUnrelatedHistories = args.includes('--allow-unrelated-histories');
  const branchIndex = args.indexOf('--branch');
  const specificBranches =
    branchIndex !== -1 && args[branchIndex + 1]
      ? args[branchIndex + 1].split(',').map((b) => b.trim())
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

  // 5. Create temporary directory and prepare cleanup
  const tempDir = path.join(repoPath, '.git-import-temp');

  // Clean up any leftover resources from previous failed imports BEFORE checking uncommitted changes
  if (fs.existsSync(tempDir)) {
    Interactive.showProgress(getMessage('cleaningPreviousImport'));
    ZipUtils.deletePath(tempDir);
    Interactive.completeProgress(true);
  }
  git.removeRemote(REMOTE_NAME);

  // Check working directory status (only when not in init mode)
  if (!useInitMode && git.hasUncommittedChanges()) {
    Interactive.error(getMessage('uncommittedChangesImport'));
    process.exit(1);
  }

  const currentBranch = git.hasAnyCommits() ? git.getCurrentBranch() : null;
  if (currentBranch) {
    console.log(getMessage('currentBranchImport', currentBranch));
  }
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
    console.log(
      getMessage('exportDate', new Date(metadata.exportDate).toLocaleString())
    );
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
      branchesToMerge = branchesToMerge.filter((b) =>
        specificBranches.includes(b)
      );
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

    // 9.5. Ask if user wants to map branches to different targets (Sync Mode only)
    let branchMapping = null;
    if (!useInitMode && !autoMode && branchesToMerge.length > 0) {
      const useMapping = await Interactive.confirm(
        getMessage('useBranchMapping'),
        false
      );

      if (useMapping) {
        Interactive.info(getMessage('branchMappingMode'));
        branchMapping = {};

        for (const branch of branchesToMerge) {
          const localBranches = git.getLocalBranches();
          const choices = [
            getMessage('sameNameBranch', branch),
            ...localBranches.filter((b) => b !== branch),
            getMessage('enterNewBranchName'),
            getMessage('skip'),
          ];

          const selected = await Interactive.select(
            getMessage('selectTargetBranch', branch),
            choices
          );

          if (selected === getMessage('skip')) {
            continue; // Skip this branch
          } else if (selected === getMessage('enterNewBranchName')) {
            const newName = await Interactive.question(
              getMessage('newBranchNamePrompt')
            );
            if (newName.trim()) {
              branchMapping[branch] = newName.trim();
            }
          } else if (selected === getMessage('sameNameBranch', branch)) {
            branchMapping[branch] = branch;
          } else {
            branchMapping[branch] = selected;
          }
        }

        // Show mapping summary
        console.log(getMessage('branchMappingSummary'));
        Object.entries(branchMapping).forEach(([source, target]) => {
          console.log(getMessage('mapping', source, target));
        });

        // Update branchesToMerge to only include mapped branches
        branchesToMerge = Object.keys(branchMapping);

        if (branchesToMerge.length === 0) {
          Interactive.warning(getMessage('noBranchesSelected'));
          cleanup();
          process.exit(0);
        }
      }
    }

    // 10. Process branches (behavior differs by mode)
    const mergeResults = [];

    if (useInitMode) {
      // ===== Initial Import Mode: Direct checkout =====
      for (const branch of branchesToMerge) {
        console.log(getMessage('processingBranch', branch));

        const remoteBranch = `${REMOTE_NAME}/${branch}`;
        const branchInfo = metadata.branchMetadata[branch];

        if (branchInfo) {
          console.log(
            getMessage('latestCommit', branchInfo.hash.substring(0, 7))
          );
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
          console.log(
            getMessage('latestCommit', branchInfo.hash.substring(0, 7))
          );
          console.log(getMessage('message', branchInfo.message));
          console.log(getMessage('author', branchInfo.author));
        }

        // Determine target branch (use mapping if available)
        const targetBranch = branchMapping ? branchMapping[branch] : branch;

        // Check if target branch exists locally
        const hasLocalBranch = localBranches.includes(targetBranch);

        if (!hasLocalBranch) {
          // Create new branch if doesn't exist locally
          if (branchMapping) {
            // In mapping mode, create target branch automatically
            Interactive.info(getMessage('targetBranchNotExist', targetBranch));
          }

          const action = await Interactive.select(
            getMessage('branchExists', targetBranch),
            [getMessage('createAndCheckout'), getMessage('skip')]
          );

          if (action === getMessage('skip')) {
            console.log(getMessage('skipped', targetBranch));
            continue;
          }

          if (!dryRun) {
            git.execGit(`checkout -b ${targetBranch} ${remoteBranch}`);
            console.log(getMessage('createdAndCheckedOut', targetBranch));
          } else {
            console.log(getMessage('wouldCreateAndCheckout', targetBranch));
          }

          mergeResults.push({
            branch: targetBranch,
            status: 'created',
            conflicts: [],
          });
          continue;
        }

        // Confirm before merge
        if (!autoMode && !dryRun) {
          const shouldMerge = await Interactive.confirm(
            getMessage('confirmMerge', remoteBranch, targetBranch),
            true
          );
          if (!shouldMerge) {
            console.log(getMessage('skipped', targetBranch));
            continue;
          }
        }

        // Show mapping info if applicable
        if (branchMapping && branch !== targetBranch) {
          console.log(getMessage('mergingInto', branch, targetBranch));
        }

        // Checkout to target branch (if not current)
        const currentActiveBranch = git.hasAnyCommits()
          ? git.getCurrentBranch()
          : null;
        if (currentActiveBranch && currentActiveBranch !== targetBranch) {
          if (!dryRun) {
            git.execGit(`checkout ${targetBranch}`);
          } else {
            console.log(getMessage('wouldCheckout', targetBranch));
          }
        }

        // Execute merge
        if (!dryRun) {
          let result = git.mergeBranch(remoteBranch, {
            message: `Merge external changes from ${branch}`,
            noFastForward: true,
            allowUnrelatedHistories: allowUnrelatedHistories,
          });

          // Check if merge failed due to unrelated histories (support English and Korean)
          if (
            !result.success &&
            result.error &&
            (result.error.includes('unrelated histories') ||
              result.error.includes('관계 없는 커밋 내역'))
          ) {
            const allowMerge = await Interactive.confirm(
              getMessage('allowUnrelatedHistories'),
              true
            );

            if (allowMerge) {
              Interactive.info(getMessage('unrelatedHistoriesNote'));
              result = git.mergeBranch(remoteBranch, {
                message: `Merge external changes from ${branch}`,
                noFastForward: true,
                allowUnrelatedHistories: true,
              });
            }
          }

          if (result.success) {
            console.log(getMessage('mergedSuccessfully'));
            mergeResults.push({
              branch: targetBranch,
              status: 'merged',
              conflicts: [],
            });
          } else {
            Interactive.warning(getMessage('mergeConflict', targetBranch));
            console.log(getMessage('conflictedFiles'));
            result.conflicts.forEach((file) => console.log(`    - ${file}`));

            mergeResults.push({
              branch: targetBranch,
              status: 'conflict',
              conflicts: result.conflicts,
            });

            Interactive.info(getMessage('resolveConflicts'));
            console.log(getMessage('resolveStep1'));
            console.log(getMessage('resolveStep2'));
            console.log(getMessage('resolveStep3'));
            console.log(getMessage('resolveStep4'));
            Interactive.info(getMessage('conflictKeepResources'));

            // Stop on conflict (do NOT cleanup - keep resources for conflict resolution)
            process.exit(1);
          }
        } else {
          console.log(getMessage('wouldMerge', remoteBranch, targetBranch));
          mergeResults.push({
            branch: targetBranch,
            status: 'simulated',
            conflicts: [],
          });
        }
      }
    }

    // 11. Summary results
    console.log(getMessage('mergeSummary'));
    Interactive.printTable(
      [
        getMessage('branchColumn'),
        getMessage('statusColumn'),
        getMessage('conflictsColumn'),
      ],
      mergeResults.map((r) => [
        r.branch,
        r.status.toUpperCase(),
        r.conflicts.length > 0 ? r.conflicts.length.toString() : '-',
      ])
    );

    // 12. Confirm push
    if (
      !dryRun &&
      mergeResults.some((r) => r.status === 'merged' || r.status === 'created')
    ) {
      const remoteUrl = git.getRemoteUrl('origin');
      if (remoteUrl) {
        console.log(getMessage('remoteUrl', remoteUrl));
        const shouldPush = await Interactive.confirm(
          getMessage('confirmPush'),
          false
        );

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
        getMessage('reviewActions'),
      ]);
    } else {
      Interactive.printBox(getMessage('importComplete'), [
        getMessage(
          'mergedBranches',
          mergeResults.filter((r) => r.status === 'merged').length
        ),
        getMessage(
          'createdBranches',
          mergeResults.filter((r) => r.status === 'created').length
        ),
        '',
        getMessage('repoUpdated'),
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
  importRepository().catch((error) => {
    Interactive.error(error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = importRepository;
