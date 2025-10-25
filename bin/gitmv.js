#!/usr/bin/env node

const path = require('path');
const { getMessage, setLanguage } = require('../lib/i18n');
const { loadConfig, saveConfig } = require('../lib/config');
const inquirer = require('inquirer');

async function promptLanguage() {
  const answers = await inquirer.prompt([
    {
      type: 'list',
      name: 'language',
      message: getMessage('selectLanguage'),
      choices: [
        { name: '한국어', value: 'ko' },
        { name: 'English', value: 'en' },
      ],
    },
  ]);
  return answers.language;
}

function showHelp() {
  console.log(`
${getMessage('toolDescription')}

${getMessage('usageTitle')}
  gitmv export [options]          ${getMessage('exportCommand')}
  gitmv import <file.zip> [options] ${getMessage('importCommand')}

${getMessage('exportOptionsTitle')}
  --branch <name>          ${getMessage('exportBranchOption')}
  --all                    ${getMessage('exportAllOption')}
  --auto                   ${getMessage('autoOptionDesc')}

${getMessage('importOptionsTitle')}
  --branch <names>         ${getMessage('branchOption')}
  --init                   ${getMessage('initOption')}
  --auto                   ${getMessage('autoOptionDesc')}
  --dry-run                ${getMessage('dryRunOption')}

${getMessage('optionsTitle')}
  -h, --help               ${getMessage('helpOption')}
  -v, --version            ${getMessage('versionOption')}
  --lang <lang>            ${getMessage('langOption')}

${getMessage('examplesTitle')}
  gitmv export
  gitmv export --branch main
  gitmv import git-export-20251025.zip
  gitmv import git-export-20251025.zip --init
  gitmv import git-export-20251025.zip --branch main,develop
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
  let config = loadConfig();
  let lang = config.language;

  const langIndex = process.argv.indexOf('--lang');
  if (langIndex > -1 && process.argv[langIndex + 1]) {
    lang = process.argv[langIndex + 1];
    setLanguage(lang);
    process.argv.splice(langIndex, 2);
  } else if (lang) {
    setLanguage(lang);
  }

  if (!lang) {
    lang = await promptLanguage();
    setLanguage(lang);
    config.language = lang;
    saveConfig(config);
    console.log(getMessage('languageSet'));
  }

  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    showHelp();
    process.exit(0);
  }

  if (args[0] === '-v' || args[0] === '--version') {
    showVersion();
    process.exit(0);
  }

  const command = args[0];

  try {
    if (command === 'export') {
      process.argv.splice(2, 1);
      await runExport();
      return;
    }

    if (command === 'import') {
      process.argv.splice(2, 1);
      await runImport();
      return;
    }

    console.error(getMessage('unknownCommand', command));
    showHelp();
    process.exit(1);
  } catch (error) {
    console.error(getMessage('error'), error.message);
    process.exit(1);
  }
}

main();
