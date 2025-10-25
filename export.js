#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const GitUtils = require('./lib/git-utils');
const ZipUtils = require('./lib/zip-utils');
const Interactive = require('./lib/interactive');
const { getMessage } = require('./lib/i18n');

async function exportRepository() {
  console.log(getMessage('exportTitle'));

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
    Interactive.warning(getMessage('uncommittedChanges'));
    const shouldContinue = await Interactive.confirm(getMessage('continueAnyway'));
    if (!shouldContinue) {
      console.log(getMessage('exportCancelled'));
      process.exit(0);
    }
  }

  // 3. Collect metadata
  Interactive.showProgress(getMessage('collectingMeta'));
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

  // 4. Display metadata
  console.log(getMessage('repoInfo'));
  console.log(getMessage('currentBranch', currentBranch));
  console.log(getMessage('totalBranches', branches.length));
  console.log(getMessage('totalTags', tags.length));

  if (branches.length > 0) {
    console.log(getMessage('branches'));
    branches.forEach(branch => {
      const info = branchMetadata[branch];
      const marker = branch === currentBranch ? '* ' : '  ';
      console.log(`${marker}${branch} (${info.hash.substring(0, 7)})`);
    });
  }

  const shouldProceed = await Interactive.confirm(getMessage('proceedWithExport'), true);
  if (!shouldProceed) {
    console.log(getMessage('exportCancelled'));
    process.exit(0);
  }

  // 5. Create temporary directory
  const tempDir = path.join(repoPath, '.git-export-temp');
  ZipUtils.ensureDir(tempDir);

  try {
    // 6. Create bundle
    Interactive.showProgress(getMessage('creatingBundle'));
    const bundlePath = path.join(tempDir, 'repository.bundle');
    git.createBundle(bundlePath, '--all');
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

    // 7. Create metadata file
    const metadataPath = path.join(tempDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

    // 8. Create ZIP archive
    const timestamp = ZipUtils.getTimestamp();
    const zipFileName = `git-export-${timestamp}.zip`;
    const zipPath = path.join(repoPath, zipFileName);

    Interactive.showProgress(getMessage('creatingZip'));
    await ZipUtils.createZip([
      { path: bundlePath, name: 'repository.bundle' },
      { path: metadataPath, name: 'metadata.json' }
    ], zipPath);
    Interactive.completeProgress(true);

    const zipSize = ZipUtils.getFileSize(zipPath);
    console.log(getMessage('zipSize', ZipUtils.formatBytes(zipSize)));

    // 9. Cleanup
    Interactive.showProgress(getMessage('cleaningUp'));
    ZipUtils.deletePath(tempDir);
    Interactive.completeProgress(true);

    // 10. Complete
    Interactive.printBox(getMessage('exportComplete'), [
      getMessage('file', zipFileName),
      getMessage('size', ZipUtils.formatBytes(zipSize)),
      getMessage('location', zipPath),
      '',
      getMessage('nextSteps'),
      getMessage('copyZip'),
      getMessage('runImport')
    ], 70);

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
  exportRepository().catch(error => {
    Interactive.error(error.message);
    console.error(error.stack);
    process.exit(1);
  });
}

module.exports = exportRepository;