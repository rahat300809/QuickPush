const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor() {
    // Determine the data directory and file path
    this.dirPath = app.getPath('userData');
    this.filePath = path.join(this.dirPath, 'folder-history.json');
    this.data = {};
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        this.data = JSON.parse(content || '{}');
      } else {
        this.data = {};
      }
    } catch (error) {
      console.error('Failed to load folder history:', error);
      this.data = {};
    }
  }

  save() {
    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save folder history:', error);
    }
  }

  normalizePath(folderPath) {
    if (!folderPath) return '';
    return path.resolve(folderPath).toLowerCase();
  }

  getSavedUrl(folderPath) {
    const key = this.normalizePath(folderPath);
    return this.data[key] || '';
  }

  saveUrl(folderPath, repoUrl) {
    const key = this.normalizePath(folderPath);
    if (!key) return;
    this.data[key] = repoUrl;
    this.save();
  }
}

module.exports = new Store();
