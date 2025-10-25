const archiver = require('archiver');
const extract = require('extract-zip');
const fs = require('fs');
const path = require('path');

class ZipUtils {
  static async createZip(sourceFiles, outputPath, options = {}) {
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // 최대 압축
      });

      output.on('close', () => {
        console.log(`✓ ZIP created: ${outputPath} (${archive.pointer()} bytes)`);
        resolve(outputPath);
      });

      archive.on('error', (err) => {
        reject(err);
      });

      archive.on('warning', (err) => {
        if (err.code === 'ENOENT') {
          console.warn('Warning:', err.message);
        } else {
          reject(err);
        }
      });

      archive.pipe(output);

      // Add files
      if (Array.isArray(sourceFiles)) {
        for (const fileInfo of sourceFiles) {
          if (typeof fileInfo === 'string') {
            // Simple file path
            const fileName = path.basename(fileInfo);
            archive.file(fileInfo, { name: fileName });
          } else {
            // Object with { path, name }
            archive.file(fileInfo.path, { name: fileInfo.name || path.basename(fileInfo.path) });
          }
        }
      } else if (typeof sourceFiles === 'object') {
        // Object with key-value pairs (name: path)
        for (const [name, filePath] of Object.entries(sourceFiles)) {
          archive.file(filePath, { name });
        }
      }

      archive.finalize();
    });
  }

  static async extractZip(zipPath, outputDir, options = {}) {
    try {
      console.log(`Extracting ${zipPath} to ${outputDir}...`);
      await extract(zipPath, { dir: path.resolve(outputDir) });
      console.log('✓ Extraction complete');
      return outputDir;
    } catch (error) {
      throw new Error(`Failed to extract ZIP: ${error.message}`);
    }
  }

  static ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static deletePath(targetPath) {
    if (fs.existsSync(targetPath)) {
      if (fs.lstatSync(targetPath).isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
    }
  }

  static getTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
  }

  static formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  }

  static getFileSize(filePath) {
    const stats = fs.statSync(filePath);
    return stats.size;
  }
}

module.exports = ZipUtils;
