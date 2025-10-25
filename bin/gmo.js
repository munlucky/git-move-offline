#!/usr/bin/env node

const path = require('path');
const { spawn } = require('child_process');

const COMMANDS = {
  export: 'export.js',
  import: 'import.js'
};

function showHelp() {
  console.log(`
Git Move Offline (gmo) - Git 저장소 오프라인 이동 도구

사용법:
  gmo export                Export current repository to ZIP
  gmo import <file.zip>     Import repository from ZIP

옵션:
  -h, --help               Show this help message
  -v, --version            Show version

예시:
  gmo export
  gmo import git-export-20251025.zip
  gmo import git-export-20251025.zip --init
  gmo import git-export-20251025.zip --branch main,develop

더 많은 정보:
  export 옵션:  gmo export --help
  import 옵션:  gmo import --help
  `);
}

function showVersion() {
  const packageJson = require('../package.json');
  console.log(`gmo v${packageJson.version}`);
}

function runCommand(command, args) {
  const scriptPath = path.join(__dirname, '..', COMMANDS[command]);

  const child = spawn('node', [scriptPath, ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });

  child.on('exit', (code) => {
    process.exit(code || 0);
  });

  child.on('error', (err) => {
    console.error(`Failed to execute command: ${err.message}`);
    process.exit(1);
  });
}

function main() {
  const args = process.argv.slice(2);

  // 인자가 없거나 help
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  // 버전
  if (args[0] === '-v' || args[0] === '--version') {
    showVersion();
    process.exit(0);
  }

  const command = args[0];

  // export 명령어
  if (command === 'export') {
    runCommand('export', args.slice(1));
    return;
  }

  // import 명령어
  if (command === 'import') {
    runCommand('import', args.slice(1));
    return;
  }

  // 알 수 없는 명령어
  console.error(`Unknown command: ${command}\n`);
  showHelp();
  process.exit(1);
}

main();
