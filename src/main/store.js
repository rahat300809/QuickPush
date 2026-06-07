const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class Store {
  constructor() {
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

  removeUrl(folderPath) {
    const key = this.normalizePath(folderPath);
    if (!key) return;
    if (this.data[key]) {
      delete this.data[key];
      this.save();
    }
  }
}

class HistoryStore {
  constructor() {
    this.dirPath = app.getPath('userData');
    this.filePath = path.join(this.dirPath, 'sync-history.json');
    this.logs = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf8');
        this.logs = JSON.parse(content || '[]');
      } else {
        this.logs = [];
      }
    } catch (error) {
      console.error('Failed to load sync history:', error);
      this.logs = [];
    }
  }

  save() {
    try {
      if (!fs.existsSync(this.dirPath)) {
        fs.mkdirSync(this.dirPath, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.logs, null, 2), 'utf8');
    } catch (error) {
      console.error('Failed to save sync history:', error);
    }
  }

  addLog(entry) {
    this.logs.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      ...entry
    });
    // Keep last 100 entries to prevent files getting too large
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
    this.save();
  }

  getLogs() {
    return this.logs;
  }

  clearLogs() {
    this.logs = [];
    this.save();
  }
}

module.exports = {
  store: new Store(),
  historyStore: new HistoryStore()
};
