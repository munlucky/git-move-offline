#!/usr/bin/env node

const path = require('path');

function showHelp() {
  console.log(`
Git Move Offline (gitmv) - Git 저장소 오프라인 이동 도구

사용법:
  gitmv export                Export current repository to ZIP
  gitmv import <file.zip>     Import repository from ZIP

옵션:
  -h, --help               Show this help message
  -v, --version            Show version

예시:
  gitmv export
  gitmv import git-export-20251025.zip
  gitmv import git-export-20251025.zip --init
  gitmv import git-export-20251025.zip --branch main,develop

더 많은 정보:
  export 옵션:  gitmv export --help
  import 옵션:  gitmv import --help
  `);
}

function showVersion() {
  const packageJson = require('../package.json');
  console.log(`gitmv v${packageJson.version}`);
}

async function runExport() {
  const exportRepository = require('../export.js');
  await exportRepository();
}

async function runImport() {
  const importRepository = require('../import.js');
  await importRepository();
}

async function main() {
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

  try {
    // export 명령어
    if (command === 'export') {
      await runExport();
      return;
    }

    // import 명령어
    if (command === 'import') {
      await runImport();
      return;
    }

    // 알 수 없는 명령어
    console.error(`Unknown command: ${command}\n`);
    showHelp();
    process.exit(1);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main();
