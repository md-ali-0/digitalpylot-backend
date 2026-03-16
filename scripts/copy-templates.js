const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'src', 'templates');
const targetDir = path.join(projectRoot, 'dist', 'templates');

function copyDirectory(source, target) {
  if (!fs.existsSync(source)) {
    return;
  }

  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    fs.copyFileSync(sourcePath, targetPath);
  }
}

copyDirectory(sourceDir, targetDir);
console.log(`Copied templates from ${sourceDir} to ${targetDir}`);
