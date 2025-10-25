const readline = require('readline');

class Interactive {
  static createInterface() {
    return readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  static async question(prompt) {
    const rl = this.createInterface();
    return new Promise((resolve) => {
      rl.question(prompt, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  static async confirm(message, defaultYes = true) {
    const suffix = defaultYes ? ' [Y/n]' : ' [y/N]';
    const answer = await this.question(message + suffix + ': ');

    if (!answer) return defaultYes;

    return answer.toLowerCase().startsWith('y');
  }

  static async select(message, choices) {
    console.log(`\n${message}`);
    choices.forEach((choice, index) => {
      console.log(`  ${index + 1}. ${choice}`);
    });

    const answer = await this.question('\nSelect (number): ');
    const index = parseInt(answer) - 1;

    if (index >= 0 && index < choices.length) {
      return choices[index];
    }

    console.log('Invalid selection, please try again.');
    return this.select(message, choices);
  }

  static async multiSelect(message, choices, defaultSelected = []) {
    console.log(`\n${message}`);
    console.log('Enter numbers separated by comma (e.g., 1,3,5) or "all" for all choices:');
    choices.forEach((choice, index) => {
      const selected = defaultSelected.includes(choice) ? '✓' : ' ';
      console.log(`  [${selected}] ${index + 1}. ${choice}`);
    });

    const answer = await this.question('\nSelect: ');

    if (answer.toLowerCase() === 'all') {
      return choices;
    }

    if (!answer) {
      return defaultSelected;
    }

    const indices = answer.split(',').map(s => parseInt(s.trim()) - 1);
    const selected = indices
      .filter(i => i >= 0 && i < choices.length)
      .map(i => choices[i]);

    return selected;
  }

  static async selectBranchActions(branches, remoteName = 'external') {
    console.log('\n=== Branch Merge Selection ===');
    console.log(`Available branches from ${remoteName}:\n`);

    const actions = {};

    for (const branch of branches) {
      console.log(`\nBranch: ${branch}`);
      const action = await this.select(
        'What to do with this branch?',
        ['Merge into current branch', 'Skip', 'Checkout and merge']
      );

      if (action === 'Merge into current branch') {
        actions[branch] = 'merge';
      } else if (action === 'Checkout and merge') {
        actions[branch] = 'checkout-merge';
      } else {
        actions[branch] = 'skip';
      }
    }

    return actions;
  }

  static printBox(title, content, width = 60) {
    const line = '─'.repeat(width - 2);
    console.log(`\n┌${line}┐`);
    console.log(`│ ${title.padEnd(width - 4)} │`);
    console.log(`├${line}┤`);

    if (Array.isArray(content)) {
      content.forEach(item => {
        console.log(`│ ${item.padEnd(width - 4)} │`);
      });
    } else {
      console.log(`│ ${content.padEnd(width - 4)} │`);
    }

    console.log(`└${line}┘\n`);
  }

  static printTable(headers, rows) {
    const colWidths = headers.map((h, i) => {
      const maxContentWidth = Math.max(...rows.map(r => String(r[i] || '').length));
      return Math.max(h.length, maxContentWidth);
    });

    const line = colWidths.map(w => '─'.repeat(w + 2)).join('┼');

    console.log(`\n┌${line}┐`);
    console.log(`│ ${headers.map((h, i) => h.padEnd(colWidths[i])).join(' │ ')} │`);
    console.log(`├${line}┤`);

    rows.forEach(row => {
      console.log(`│ ${row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' │ ')} │`);
    });

    console.log(`└${line}┘\n`);
  }

  static showProgress(message) {
    process.stdout.write(`${message}...`);
  }

  static completeProgress(success = true) {
    console.log(success ? ' ✓' : ' ✗');
  }

  static error(message) {
    console.error(`\n❌ Error: ${message}\n`);
  }

  static success(message) {
    console.log(`\n✓ ${message}\n`);
  }

  static warning(message) {
    console.warn(`\n⚠ Warning: ${message}\n`);
  }

  static info(message) {
    console.log(`\nℹ ${message}\n`);
  }
}

module.exports = Interactive;
