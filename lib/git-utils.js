const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

class GitUtils {
  constructor(repoPath = process.cwd()) {
    this.repoPath = repoPath;
  }

  execGit(command, options = {}) {
    try {
      const result = execSync(`git ${command}`, {
        cwd: this.repoPath,
        encoding: 'utf8',
        stdio: options.silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
        ...options,
      });
      return result.trim();
    } catch (error) {
      if (options.allowError) {
        return null;
      }
      throw new Error(`Git command failed: ${command}\n${error.message}`);
    }
  }

  isGitRepo() {
    try {
      this.execGit('rev-parse --git-dir', { silent: true });
      return true;
    } catch {
      return false;
    }
  }

  hasAnyCommits() {
    try {
      this.execGit('rev-parse HEAD', { silent: true });
      return true;
    } catch {
      return false;
    }
  }

  isEmptyRepo() {
    return this.isGitRepo() && !this.hasAnyCommits();
  }

  getCommitCount() {
    try {
      const count = this.execGit('rev-list --count HEAD', {
        silent: true,
        allowError: true,
      });
      return count ? parseInt(count) : 0;
    } catch {
      return 0;
    }
  }

  getCurrentBranch() {
    return this.execGit('rev-parse --abbrev-ref HEAD');
  }

  getAllBranches() {
    const output = this.execGit('branch -a --format="%(refname:short)"');
    return output.split('\n').filter((b) => b && !b.includes('HEAD'));
  }

  getLocalBranches() {
    const output = this.execGit('branch --format="%(refname:short)"', {
      allowError: true,
    });
    if (!output) return [];
    return output.split('\n').filter((b) => b);
  }

  getRemoteBranches(remote = 'origin') {
    const output = this.execGit(`branch -r --format="%(refname:short)"`, {
      allowError: true,
    });
    if (!output) return [];
    return output
      .split('\n')
      .filter((b) => b && b.startsWith(`${remote}/`))
      .map((b) => b.replace(`${remote}/`, ''));
  }

  getAllTags() {
    const output = this.execGit('tag', { allowError: true });
    return output ? output.split('\n').filter((t) => t) : [];
  }

  getCommitHash(ref = 'HEAD') {
    return this.execGit(`rev-parse ${ref}`);
  }

  getCommitInfo(ref = 'HEAD') {
    const hash = this.execGit(`rev-parse ${ref}`);
    const message = this.execGit(`log -1 --format="%s" ${ref}`);
    const author = this.execGit(`log -1 --format="%an <%ae>" ${ref}`);
    const date = this.execGit(`log -1 --format="%ai" ${ref}`);

    return { hash, message, author, date };
  }

  createBundle(outputPath, refs = '--all') {
    this.execGit(`bundle create "${outputPath}" ${refs}`);
    return outputPath;
  }

  verifyBundle(bundlePath) {
    try {
      this.execGit(`bundle verify "${bundlePath}"`);
      return true;
    } catch {
      return false;
    }
  }

  addRemote(name, url) {
    this.execGit(`remote add ${name} "${url}"`);
  }

  removeRemote(name) {
    this.execGit(`remote remove ${name}`, { allowError: true });
  }

  fetchFromRemote(remote, branch = null) {
    const branchSpec = branch ? ` ${branch}` : '';
    this.execGit(`fetch ${remote}${branchSpec}`);
  }

  mergeBranch(branch, options = {}) {
    const noFf = options.noFastForward ? '--no-ff' : '';
    const message = options.message ? `-m "${options.message}"` : '';

    try {
      this.execGit(`merge ${noFf} ${message} ${branch}`.trim());
      return { success: true, conflicts: [] };
    } catch (error) {
      const conflicts = this.getConflicts();
      return { success: false, conflicts, error: error.message };
    }
  }

  getConflicts() {
    try {
      const output = this.execGit('diff --name-only --diff-filter=U', {
        silent: true,
      });
      return output ? output.split('\n').filter((f) => f) : [];
    } catch {
      return [];
    }
  }

  isClean() {
    const output = this.execGit('status --porcelain');
    return output.length === 0;
  }

  hasUncommittedChanges() {
    return !this.isClean();
  }

  push(remote = 'origin', branch = null, options = {}) {
    const branchSpec = branch || this.getCurrentBranch();
    const force = options.force ? '--force' : '';
    const setUpstream = options.setUpstream ? '-u' : '';

    this.execGit(`push ${force} ${setUpstream} ${remote} ${branchSpec}`.trim());
  }

  getRemotes() {
    const output = this.execGit('remote', { allowError: true });
    return output ? output.split('\n').filter((r) => r) : [];
  }

  getRemoteUrl(remote = 'origin') {
    return this.execGit(`remote get-url ${remote}`, { allowError: true });
  }

  getBranchMetadata(branches = null) {
    const branchesToProcess = branches || this.getLocalBranches();
    const metadata = {};

    for (const branch of branchesToProcess) {
      try {
        metadata[branch] = this.getCommitInfo(branch);
      } catch (error) {
        console.warn(`Warning: Could not get info for branch ${branch}`);
      }
    }

    return metadata;
  }

  getTagMetadata() {
    const tags = this.getAllTags();
    const metadata = {};

    for (const tag of tags) {
      try {
        metadata[tag] = this.getCommitInfo(tag);
      } catch (error) {
        console.warn(`Warning: Could not get info for tag ${tag}`);
      }
    }

    return metadata;
  }
}

module.exports = GitUtils;
