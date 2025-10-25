#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GitUtils = require('./lib/git-utils');
const ZipUtils = require('./lib/zip-utils');
const Interactive = require('./lib/interactive');
const { getMessage } = require('./lib/i18n');

async function exportRepository() {
  console.log(getMessage('exportTitle'));

  const args = process.argv.slice(2);
  const branchIndex = args.indexOf('--branch');
  const specificBranch =
    branchIndex !== -1 && args[branchIndex + 1] ? args[branchIndex + 1] : null;
  const allBranches = args.includes('--all');
  const autoMode = args.includes('--auto');

  const repoPath = process.cwd();
  const git = new GitUtils(repoPath);

  // 1. Check Git repository
  Interactive.showProgress(getMessage('checkGitRepo'));
  if (!git.isGitRepo()) {
    Interactive.completeProgress(false);
    Interactive.error(getMessage('notGitRepo'));
    process.exit(1);
  }
  Interactive.completeProgress(true);

  // 2. Check for uncommitted changes
  if (git.hasUncommittedChanges()) {
    if (!autoMode) {
      Interactive.warning(getMessage('uncommittedChanges'));
      const shouldContinue = await Interactive.confirm(
        getMessage('continueAnyway')
      );
      if (!shouldContinue) {
        console.log(getMessage('exportCancelled'));
        process.exit(0);
      }
    } else {
      Interactive.warning(getMessage('uncommittedChanges'));
    }
  }

  // 3. Select branches to export
  const localBranches = git.getLocalBranches();
  if (localBranches.length === 0) {
    Interactive.error(getMessage('noBranches'));
    process.exit(1);
  }

  let branchesToExport = [];
  let bundleArgs = '';

  if (specificBranch) {
    if (!localBranches.includes(specificBranch)) {
      Interactive.error(getMessage('branchNotFound', specificBranch));
      process.exit(1);
    }
    branchesToExport = [specificBranch];
    bundleArgs = specificBranch;
    console.log(getMessage('exportingBranch', specificBranch));
  } else if (allBranches) {
    branchesToExport = localBranches;
    bundleArgs = '--all';
    console.log(getMessage('exportingAllBranches', localBranches.length));
  } else if (autoMode) {
    // In auto mode without a specific branch, default to all
    branchesToExport = localBranches;
    bundleArgs = '--all';
    console.log(getMessage('exportingAllBranchesAuto', localBranches.length));
  } else {
    // Interactive mode
    const ALL_BRANCHES_OPTION = getMessage('allBranches');
    const choices = [
      `${ALL_BRANCHES_OPTION} (${localBranches.length})`,
      ...localBranches,
    ];

    const answer = await Interactive.select(
      getMessage('selectBranchToExport'),
      choices
    );

    if (answer.startsWith(ALL_BRANCHES_OPTION)) {
      branchesToExport = localBranches;
      bundleArgs = '--all';
    } else {
      branchesToExport = [answer];
      bundleArgs = answer;
    }
  }

  // 4. Collect metadata
  Interactive.showProgress(getMessage('collectingMeta'));
  const currentBranch = git.getCurrentBranch();
  const tags = git.getAllTags();
  const branchMetadata = git.getBranchMetadata(branchesToExport);
  const tagMetadata = git.getTagMetadata();

  const metadata = {
    exportDate: new Date().toISOString(),
    currentBranch: branchesToExport.includes(currentBranch)
      ? currentBranch
      : branchesToExport[0],
    branches: branchesToExport,
    tags,
    branchMetadata,
    tagMetadata,
    repositoryPath: repoPath,
  };
  Interactive.completeProgress(true);

  // 5. Display metadata
  console.log(getMessage('repoInfo'));
  console.log(getMessage('exportingNBranches', branchesToExport.length));
  console.log(getMessage('totalTags', tags.length));

  if (branchesToExport.length > 0) {
    console.log(getMessage('branches'));
    branchesToExport.forEach((branch) => {
      const info = branchMetadata[branch];
      const marker = branch === currentBranch ? '* ' : '  ';
      if (info) {
        console.log(`${marker}${branch} (${info.hash.substring(0, 7)})`);
      } else {
        console.log(`${marker}${branch} (no commit info)`);
      }
    });
  }

  if (!autoMode) {
    const shouldProceed = await Interactive.confirm(
      getMessage('proceedWithExport'),
      true
    );
    if (!shouldProceed) {
      console.log(getMessage('exportCancelled'));
      process.exit(0);
    }
  }

  // 6. Create temporary directory
  const tempDir = path.join(repoPath, '.git-export-temp');
  ZipUtils.ensureDir(tempDir);

  try {
    // 7. Create bundle
    Interactive.showProgress(getMessage('creatingBundle'));
    const bundlePath = path.join(tempDir, 'repository.bundle');
    git.createBundle(bundlePath, bundleArgs);
    Interactive.completeProgress(true);

    // Verify bundle
    Interactive.showProgress(getMessage('verifyingBundle'));
    const isValid = git.verifyBundle(bundlePath);
    if (!isValid) {
      throw new Error(getMessage('bundleFailed'));
    }
    Interactive.completeProgress(true);

    const bundleSize = ZipUtils.getFileSize(bundlePath);
    console.log(getMessage('bundleSize', ZipUtils.formatBytes(bundleSize)));

    // 8. Create metadata file
    const metadataPath = path.join(tempDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // 9. Create ZIP archive
    const timestamp = ZipUtils.getTimestamp();
    const zipFileName = `git-export-${timestamp}.zip`;
    const zipPath = path.join(repoPath, zipFileName);

    Interactive.showProgress(getMessage('creatingZip'));
    await ZipUtils.createZip(
      [
        { path: bundlePath, name: 'repository.bundle' },
        { path: metadataPath, name: 'metadata.json' },
      ],
      zipPath
    );
    Interactive.completeProgress(true);

    const zipSize = ZipUtils.getFileSize(zipPath);
    console.log(getMessage('zipSize', ZipUtils.formatBytes(zipSize)));

    // 10. Cleanup
    Interactive.showProgress(getMessage('cleaningUp'));
    ZipUtils.deletePath(tempDir);
    Interactive.completeProgress(true);

    // 11. Complete
    Interactive.printBox(
      getMessage('exportComplete'),
      [
        getMessage('file', zipFileName),
        getMessage('size', ZipUtils.formatBytes(zipSize)),
        getMessage('location', zipPath),
        '',
        getMessage('nextSteps'),
        getMessage('copyZip'),
        getMessage('runImport'),
      ],
      70
    );
  } catch (error) {
    // Cleanup on error
    Interactive.error(error.message);
    if (fs.existsSync(tempDir)) {
      ZipUtils.deletePath(tempDir);
    }
    process.exit(1);
  }
}

// Execute
if (require.main === module) {
  exportRepository().catch((error) => {
    Interactive.error(error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = exportRepository;
