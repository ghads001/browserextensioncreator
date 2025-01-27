class ExtensionGenerator {
  constructor() {
    this.zip = new JSZip();
    this.icon = null;
    this.editor = null;
    this.customFiles = new Map();
    this.bindEvents();
    this.initializeTabs();
    this.setupConditionalFields();
    this.initializeMonacoEditor();
    this.initializeCodePreview();
    this.initializeAIGeneration();

    // Add tracking for generated state
    this.hasGenerated = false;
    this.currentConfig = null;
  }

  bindEvents() {
    document.getElementById('generateBtn').addEventListener('click', () => this.generateExtension());
    document.getElementById('downloadChrome').addEventListener('click', () => this.downloadExtension('chrome'));
    document.getElementById('downloadFirefox').addEventListener('click', () => this.downloadExtension('firefox'));
    document.getElementById('iconFile').addEventListener('change', (e) => this.handleIconUpload(e));
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.switchTab(e));
    });

    // Add regeneration handler
    document.getElementById('regenerateBtn')?.addEventListener('click', () => this.handleRegeneration());
  }

  initializeTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabName = e.target.dataset.tab;
        
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        
        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
          content.classList.remove('active');
          if (content.dataset.tab === tabName) {
            content.classList.add('active');
          }
        });
      });
    });
  }

  setupConditionalFields() {
    const contentScript = document.getElementById('contentScript');
    const contentMatchingSection = document.getElementById('contentMatchingSection');
    
    contentScript.addEventListener('change', (e) => {
      contentMatchingSection.style.display = e.target.checked ? 'block' : 'none';
    });
  }

  async handleIconUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const imageData = await this.readFileAsDataURL(file);
      this.icon = {
        data: imageData,
        type: file.type
      };
      
      const preview = document.getElementById('iconPreview');
      preview.innerHTML = `<img src="${imageData}" alt="Extension icon">`;
    } catch (error) {
      console.error('Error handling icon upload:', error);
      alert('Error uploading icon. Please try again.');
    }
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  getFormData() {
    const data = {
      name: document.getElementById('extensionName').value,
      description: document.getElementById('extensionDescription').value,
      version: document.getElementById('version').value,
      author: document.getElementById('author').value,
      homepage: document.getElementById('homepage').value,
      browsers: {
        chromium: document.getElementById('chromium').checked,
        firefox: document.getElementById('firefox').checked
      },
      permissions: {
        storage: document.getElementById('storage').checked,
        tabs: document.getElementById('tabs').checked,
        activeTab: document.getElementById('activeTab').checked,
        notifications: document.getElementById('notifications').checked,
        webRequest: document.getElementById('webRequest').checked,
        cookies: document.getElementById('cookies').checked,
        downloads: document.getElementById('downloads').checked,
        history: document.getElementById('history').checked,
        bookmarks: document.getElementById('bookmarks').checked,
        proxy: document.getElementById('proxy').checked
      },
      features: {
        popup: document.getElementById('popup').checked,
        options: document.getElementById('options').checked,
        background: document.getElementById('background').checked,
        contentScript: document.getElementById('contentScript').checked,
        devtools: document.getElementById('devtools').checked,
        contextMenu: document.getElementById('contextMenu').checked,
        commands: document.getElementById('commands').checked,
        omnibox: document.getElementById('omnibox').checked
      },
      contentScriptSettings: {
        urlPatterns: document.getElementById('urlPatterns').value.split('\n').filter(Boolean),
        matchAll: document.getElementById('matchAll').checked,
        runAtStart: document.getElementById('runAtStart').checked
      }
    };

    if (this.icon) {
      data.icon = this.icon;
    }

    return data;
  }

  validateForm(data) {
    if (!data.name || !data.description || !data.version) {
      alert('Please fill in all required fields');
      return false;
    }
    if (!data.browsers.chromium && !data.browsers.firefox) {
      alert('Please select at least one browser');
      return false;
    }
    return true;
  }

  generateManifest(data, browser) {
    const manifest = {
      manifest_version: browser === 'firefox' ? 2 : 3,
      name: data.name,
      description: data.description,
      version: data.version,
      permissions: [],
      author: data.author,
      homepage_url: data.homepage
    };

    // Add permissions
    Object.entries(data.permissions).forEach(([key, value]) => {
      if (value) {
        // Firefox specific permission adjustments
        if (browser === 'firefox') {
          if (key === 'storage') manifest.permissions.push('storage');
          if (key === 'tabs') manifest.permissions.push('tabs');
          if (key === 'activeTab') manifest.permissions.push('activeTab');
          if (key === 'notifications') manifest.permissions.push('notifications');
          if (key === 'webRequest') {
            manifest.permissions.push('webRequest');
            manifest.permissions.push('webRequestBlocking');
          }
          if (key === 'cookies') manifest.permissions.push('cookies');
          if (key === 'downloads') manifest.permissions.push('downloads');
          if (key === 'history') manifest.permissions.push('history');
          if (key === 'bookmarks') manifest.permissions.push('bookmarks');
          if (key === 'proxy') manifest.permissions.push('proxy');
        } else {
          manifest.permissions.push(key);
        }
      }
    });

    // Firefox specific host permissions
    if (browser === 'firefox' && data.features.contentScript) {
      manifest.permissions = manifest.permissions || [];
      if (data.contentScriptSettings.matchAll) {
        manifest.permissions.push('<all_urls>');
      } else {
        manifest.permissions.push(...data.contentScriptSettings.urlPatterns);
      }
    }

    // Add features
    if (data.features.popup) {
      if (browser === 'firefox') {
        manifest.browser_action = {
          default_popup: 'popup.html'
        };
      } else {
        manifest.action = {
          default_popup: 'popup.html'
        };
      }
    }

    if (data.features.options) {
      manifest.options_ui = {
        page: 'options.html',
        open_in_tab: true,
        ...(browser === 'firefox' ? { browser_style: true } : {})
      };
    }

    if (data.features.background) {
      if (browser === 'firefox') {
        manifest.background = {
          scripts: ['background.js']
        };
      } else {
        manifest.background = {
          service_worker: 'background.js',
          type: 'module'
        };
      }
    }

    if (data.features.contentScript) {
      manifest.content_scripts = [{
        matches: data.contentScriptSettings.matchAll ? ['<all_urls>'] : data.contentScriptSettings.urlPatterns,
        js: ['content.js'],
        run_at: data.contentScriptSettings.runAtStart ? 'document_start' : 'document_idle'
      }];
    }

    if (data.features.devtools) {
      manifest.devtools_page = 'devtools.html';
    }

    if (data.features.contextMenu) {
      if (browser === 'firefox') {
        manifest.permissions.push('menus');
      } else {
        manifest.permissions.push('contextMenus');
      }
    }

    if (data.features.commands) {
      manifest.commands = {
        _execute_action: {
          suggested_key: {
            default: "Ctrl+Shift+Y"
          },
          description: "Opens the extension popup"
        }
      };
    }

    if (data.features.omnibox) {
      manifest.omnibox = {
        keyword: data.name.toLowerCase().split(' ')[0]
      };
    }

    // Add browser-specific properties
    if (browser === 'firefox') {
      manifest.browser_specific_settings = {
        gecko: {
          id: `${data.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}@example.com`
        }
      };
    }

    return manifest;
  }

  generateFiles(data, browser) {
    const folder = this.zip.folder(data.name);
    
    // Add manifest
    const manifest = this.generateManifest(data, browser);
    folder.file('manifest.json', JSON.stringify(manifest, null, 2));

    // Add icon if provided
    if (data.icon) {
      folder.file('icon128.png', data.icon.data.split(',')[1], {base64: true});
      manifest.icons = {
        "128": "icon128.png"
      };
    }

    // Add feature files
    if (data.features.popup) {
      folder.file('popup.html', this.generatePopupHTML(data));
      folder.file('popup.css', this.generatePopupCSS());
      folder.file('popup.js', this.generatePopupJS());
    }

    if (data.features.options) {
      folder.file('options.html', this.generateOptionsHTML(data));
      folder.file('options.css', this.generateOptionsCSS());
      folder.file('options.js', this.generateOptionsJS());
    }

    if (data.features.background) {
      folder.file('background.js', this.generateBackgroundJS());
    }

    if (data.features.contentScript) {
      folder.file('content.js', this.generateContentJS());
      folder.file('content-styles.css', this.generateContentStyles());
    }

    // Add new feature files
    if (data.features.devtools) {
      folder.file('devtools.html', this.generateDevToolsHTML(data));
      folder.file('devtools.js', this.generateDevToolsJS());
    }

    if (data.features.contextMenu) {
      folder.file('contextMenu.js', this.generateContextMenuJS());
    }

    if (data.features.omnibox) {
      folder.file('omnibox.js', this.generateOmniboxJS());
    }

    // Add custom files if they exist
    if (this.customFiles) {
      this.customFiles.forEach((file, filename) => {
        folder.file(filename, file.content);
      });
    }
  }

  generatePopupHTML(data) {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${data.name} Popup</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <div class="popup-container">
    <header>
      <h1>${data.name}</h1>
      <button id="settingsBtn" title="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
        </svg>
      </button>
    </header>

    <div class="content">
      <div class="features-list">
        ${data.features.contextMenu ? `
        <div class="feature-item">
          <h3>Context Menu</h3>
          <label class="switch">
            <input type="checkbox" id="contextMenuToggle">
            <span class="slider"></span>
          </label>
        </div>
        ` : ''}

        ${data.permissions.notifications ? `
        <div class="feature-item">
          <h3>Notifications</h3>
          <label class="switch">
            <input type="checkbox" id="notificationsToggle">
            <span class="slider"></span>
          </label>
        </div>
        ` : ''}

        ${data.features.commands ? `
        <div class="feature-item">
          <h3>Keyboard Shortcuts</h3>
          <button id="shortcutsBtn" class="secondary-btn">Configure</button>
        </div>
        ` : ''}
      </div>

      ${data.permissions.tabs ? `
      <div class="tabs-section">
        <h3>Active Tabs</h3>
        <div id="tabsList" class="tabs-list">
          <!-- Tabs will be populated here -->
        </div>
      </div>
      ` : ''}

      ${data.permissions.history ? `
      <div class="recent-history">
        <h3>Recent History</h3>
        <div id="historyList" class="history-list">
          <!-- History will be populated here -->
        </div>
      </div>
      ` : ''}

      ${data.permissions.bookmarks ? `
      <div class="bookmarks-section">
        <h3>Quick Bookmarks</h3>
        <div id="bookmarksList" class="bookmarks-list">
          <!-- Bookmarks will be populated here -->
        </div>
      </div>
      ` : ''}

      <div class="action-buttons">
        ${data.features.options ? `
        <button id="openOptions" class="secondary-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/>
          </svg>
          Options
        </button>
        ` : ''}
        <button id="refreshData" class="primary-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
          </svg>
          Refresh
        </button>
      </div>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>`;
  }

  generatePopupCSS() {
    return `
body {
  width: 350px;
  min-height: 400px;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc;
}

.popup-container {
  padding: 16px;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

h1 {
  font-size: 18px;
  margin: 0;
  color: #1e293b;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.features-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.feature-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.feature-item h3 {
  margin: 0;
  font-size: 14px;
  color: #334155;
}

/* Switch styles */
.switch {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 24px;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: .4s;
  border-radius: 34px;
}

.slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .4s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #6366f1;
}

input:checked + .slider:before {
  transform: translateX(16px);
}

/* Buttons */
.action-buttons {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.primary-btn,
.secondary-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background: #6366f1;
  color: white;
}

.primary-btn:hover {
  background: #4f46e5;
}

.secondary-btn {
  background: #e2e8f0;
  color: #475569;
}

.secondary-btn:hover {
  background: #cbd5e1;
}

/* Lists */
.tabs-list,
.history-list,
.bookmarks-list {
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 13px;
  color: #334155;
}

.list-item:last-child {
  border-bottom: none;
}

.list-item img {
  width: 16px;
  height: 16px;
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}`;
  }

  generatePopupJS() {
    return `// Popup functionality
document.addEventListener('DOMContentLoaded', function() {
  // Initialize UI elements
  initializeUI();
  
  // Load saved settings
  loadSettings();
  
  // Load dynamic content based on permissions
  loadDynamicContent();
  
  // Add event listeners
  addEventListeners();
});

function initializeUI() {
  // Initialize any UI components that need setup
  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
}

function loadSettings() {
  // Load saved settings from storage
  chrome.storage.sync.get(null, (data) => {
    // Update toggle states
    const contextMenuToggle = document.getElementById('contextMenuToggle');
    if (contextMenuToggle) {
      contextMenuToggle.checked = data.contextMenuEnabled ?? true;
    }

    const notificationsToggle = document.getElementById('notificationsToggle');
    if (notificationsToggle) {
      notificationsToggle.checked = data.notificationsEnabled ?? true;
    }
  });
}

function loadDynamicContent() {
  // Load tabs if permission exists
  const tabsList = document.getElementById('tabsList');
  if (tabsList) {
    chrome.tabs.query({ currentWindow: true }, (tabs) => {
      tabsList.innerHTML = tabs.map(tab => \`
        <div class="list-item">
          <img src="\${tab.favIconUrl || 'icon128.png'}" alt="Tab icon">
          <span>\${tab.title}</span>
        </div>
      \`).join('');
    });
  }

  // Load history if permission exists
  const historyList = document.getElementById('historyList');
  if (historyList) {
    chrome.history.search({ text: '', maxResults: 5 }, (results) => {
      historyList.innerHTML = results.map(item => \`
        <div class="list-item">
          <span>\${item.title}</span>
        </div>
      \`).join('');
    });
  }

  // Load bookmarks if permission exists
  const bookmarksList = document.getElementById('bookmarksList');
  if (bookmarksList) {
    chrome.bookmarks.getRecent(5, (bookmarks) => {
      bookmarksList.innerHTML = bookmarks.map(bookmark => \`
        <div class="list-item">
          <span>\${bookmark.title}</span>
        </div>
      \`).join('');
    });
  }
}

function addEventListeners() {
  // Add listeners for toggles and buttons
  const contextMenuToggle = document.getElementById('contextMenuToggle');
  if (contextMenuToggle) {
    contextMenuToggle.addEventListener('change', (e) => {
      chrome.storage.sync.set({ contextMenuEnabled: e.target.checked });
      chrome.runtime.sendMessage({ 
        action: 'updateContextMenu',
        enabled: e.target.checked 
      });
    });
  }

  const notificationsToggle = document.getElementById('notificationsToggle');
  if (notificationsToggle) {
    notificationsToggle.addEventListener('change', (e) => {
      chrome.storage.sync.set({ notificationsEnabled: e.target.checked });
    });
  }

  const refreshData = document.getElementById('refreshData');
  if (refreshData) {
    refreshData.addEventListener('click', () => {
      loadDynamicContent();
    });
  }

  const openOptions = document.getElementById('openOptions');
  if (openOptions) {
    openOptions.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  const shortcutsBtn = document.getElementById('shortcutsBtn');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }
}`;
  }

  generateOptionsHTML(data) {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${data.name} Options</title>
  <link rel="stylesheet" href="options.css">
</head>
<body>
  <div class="options-container">
    <header>
      <h1>${data.name} Settings</h1>
      <p class="version">Version ${data.version}</p>
    </header>

    <main>
      <div class="settings-grid">
        ${data.features.contextMenu ? `
        <div class="settings-card">
          <h2>Context Menu</h2>
          <div class="settings-content">
            <div class="setting-item">
              <label>
                Enable Context Menu
                <input type="checkbox" id="contextMenuEnabled" checked>
              </label>
              <p class="setting-description">Show options when right-clicking on pages</p>
            </div>
            <div class="setting-item">
              <label>Custom Menu Text</label>
              <input type="text" id="contextMenuText" placeholder="Right-click menu text">
            </div>
          </div>
        </div>
        ` : ''}

        ${data.permissions.notifications ? `
        <div class="settings-card">
          <h2>Notifications</h2>
          <div class="settings-content">
            <div class="setting-item">
              <label>
                Enable Notifications
                <input type="checkbox" id="notificationsEnabled" checked>
              </label>
              <p class="setting-description">Show desktop notifications</p>
            </div>
            <div class="setting-item">
              <label>Notification Duration (seconds)</label>
              <input type="number" id="notificationDuration" min="1" max="60" value="5">
            </div>
          </div>
        </div>
        ` : ''}

        ${data.features.commands ? `
        <div class="settings-card">
          <h2>Keyboard Shortcuts</h2>
          <div class="settings-content">
            <div class="setting-item">
              <button id="configureShortcuts" class="primary-btn">Configure Shortcuts</button>
              <p class="setting-description">Set up custom keyboard shortcuts</p>
            </div>
          </div>
        </div>
        ` : ''}

        ${data.permissions.storage ? `
        <div class="settings-card">
          <h2>Data Management</h2>
          <div class="settings-content">
            <div class="setting-item">
              <button id="exportData" class="secondary-btn">Export Data</button>
              <button id="importData" class="secondary-btn">Import Data</button>
              <input type="file" id="importFile" accept="application/json" style="display: none;">
            </div>
            <div class="setting-item">
              <button id="clearData" class="danger-btn">Clear All Data</button>
              <p class="setting-description">Warning: This will reset all settings</p>
            </div>
          </div>
        </div>
        ` : ''}

        ${data.permissions.proxy ? `
        <div class="settings-card">
          <h2>Proxy Settings</h2>
          <div class="settings-content">
            <div class="setting-item">
              <label>Proxy Server</label>
              <input type="text" id="proxyServer" placeholder="proxy.example.com">
            </div>
            <div class="setting-item">
              <label>Port</label>
              <input type="number" id="proxyPort" placeholder="8080">
            </div>
          </div>
        </div>
        ` : ''}
      </div>

      <div class="about-section">
        <h2>About</h2>
        <p>${data.description}</p>
        ${data.homepage ? `<p><a href="${data.homepage}" target="_blank">Visit Website</a></p>` : ''}
        <p>Created by ${data.author}</p>
      </div>
    </main>

    <footer>
      <button id="saveSettings" class="primary-btn">Save Changes</button>
      <button id="resetSettings" class="secondary-btn">Reset to Defaults</button>
    </footer>
  </div>
  <script src="options.js"></script>
</body>
</html>`;
  }

  generateOptionsCSS() {
    return `body {
  margin: 0;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #f8fafc;
  color: #1e293b;
  line-height: 1.5;
}

.options-container {
  max-width: 1000px;
  margin: 0 auto;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 24px;
}

header {
  margin-bottom: 32px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e2e8f0;
}

h1 {
  margin: 0;
  font-size: 24px;
  color: #1e293b;
}

.version {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 14px;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}

.settings-card {
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
}

.settings-card h2 {
  margin: 0 0 16px;
  font-size: 18px;
  color: #334155;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 500;
}

.setting-description {
  margin: 0;
  font-size: 14px;
  color: #64748b;
}

input[type="text"],
input[type="number"] {
  padding: 8px 12px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 14px;
}

input[type="checkbox"] {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  border: 2px solid #cbd5e1;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  cursor: pointer;
  position: relative;
}

input[type="checkbox"]:checked {
  background-color: #6366f1;
  border-color: #6366f1;
}

input[type="checkbox"]:checked::after {
  content: "✓";
  color: white;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
}

.about-section {
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 32px;
}

.about-section h2 {
  margin: 0 0 16px;
  font-size: 18px;
  color: #334155;
}

.about-section p {
  margin: 8px 0;
  color: #475569;
}

.about-section a {
  color: #6366f1;
  text-decoration: none;
}

.about-section a:hover {
  text-decoration: underline;
}

footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding-top: 20px;
  border-top: 1px solid #e2e8f0;
}

.primary-btn,
.secondary-btn,
.danger-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.primary-btn {
  background: #6366f1;
  color: white;
}

.primary-btn:hover {
  background: #4f46e5;
}

.secondary-btn {
  background: #e2e8f0;
  color: #475569;
}

.secondary-btn:hover {
  background: #cbd5e1;
}

.danger-btn {
  background: #fee2e2;
  color: #ef4444;
}

.danger-btn:hover {
  background: #fecaca;
}

@media (max-width: 768px) {
  .options-container {
    padding: 16px;
  }
  
  .settings-grid {
    grid-template-columns: 1fr;
  }
}`;
  }

  generateOptionsJS() {
    return `// Options page functionality
document.addEventListener('DOMContentLoaded', function() {
  // Load saved settings
  loadSettings();
  
  // Add event listeners
  addEventListeners();
});

function loadSettings() {
  chrome.storage.sync.get(null, (data) => {
    // Update all settings inputs with saved values
    Object.keys(data).forEach(key => {
      const element = document.getElementById(key);
      if (element) {
        if (element.type === 'checkbox') {
          element.checked = data[key];
        } else {
          element.value = data[key];
        }
      }
    });
  });
}

function addEventListeners() {
  // Save settings
  const saveBtn = document.getElementById('saveSettings');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSettings);
  }

  // Reset settings
  const resetBtn = document.getElementById('resetSettings');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetSettings);
  }

  // Configure shortcuts
  const shortcutsBtn = document.getElementById('configureShortcuts');
  if (shortcutsBtn) {
    shortcutsBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    });
  }

  // Export data
  const exportBtn = document.getElementById('exportData');
  if (exportBtn) {
    exportBtn.addEventListener('click', exportData);
  }

  // Import data
  const importBtn = document.getElementById('importData');
  const importFile = document.getElementById('importFile');
  if (importBtn && importFile) {
    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', importData);
  }

  // Clear data
  const clearBtn = document.getElementById('clearData');
  if (clearBtn) {
    clearBtn.addEventListener('click', clearData);
  }
}

function saveSettings() {
  const settings = {};
  
  // Collect all input values
  document.querySelectorAll('input').forEach(input => {
    if (input.id) {
      settings[input.id] = input.type === 'checkbox' ? input.checked : input.value;
    }
  });

  // Save to storage
  chrome.storage.sync.set(settings, () => {
    showMessage('Settings saved successfully!');
  });
}

function resetSettings() {
  if (confirm('Are you sure you want to reset all settings to defaults?')) {
    chrome.storage.sync.clear(() => {
      loadSettings();
      showMessage('Settings reset to defaults');
    });
  }
}

function exportData() {
  chrome.storage.sync.get(null, (data) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'extension-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function importData(event) {
  const file = event.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const settings = JSON.parse(e.target.result);
        chrome.storage.sync.set(settings, () => {
          loadSettings();
          showMessage('Settings imported successfully!');
        });
      } catch (error) {
        showMessage('Error importing settings: Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
  }
}

function clearData() {
  if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
    chrome.storage.sync.clear(() => {
      showMessage('All data cleared successfully');
      loadSettings();
    });
  }
}

function showMessage(message, type = 'success') {
  // Create and show a toast message
  const toast = document.createElement('div');
  toast.className = \`toast toast-\${type}\`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}`;
  }

  generateBackgroundJS() {
    return `// Background script functionality
let settings = {};

// Initialize extension
chrome.runtime.onInstalled.addListener(function() {
  // Load settings
  loadSettings();
  
  // Initialize context menu if enabled
  setupContextMenu();
});

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch(message.action) {
    case 'updateContextMenu':
      setupContextMenu();
      break;
    case 'getSettings':
      sendResponse(settings);
      break;
    case 'updateSettings':
      updateSettings(message.settings);
      break;
  }
});

function loadSettings() {
  chrome.storage.sync.get(null, (data) => {
    settings = data;
    
    // Set default values if not exists
    if (typeof settings.contextMenuEnabled === 'undefined') {
      settings.contextMenuEnabled = true;
    }
    if (typeof settings.notificationsEnabled === 'undefined') {
      settings.notificationsEnabled = true;
    }
    
    chrome.storage.sync.set(settings);
  });
}

function setupContextMenu() {
  // Remove existing menu items
  chrome.contextMenus.removeAll(() => {
    if (settings.contextMenuEnabled) {
      chrome.contextMenus.create({
        id: 'mainContext',
        title: settings.contextMenuText || 'Extension Action',
        contexts: ['all']
      });
      
      // Add sub-menu items if needed
      chrome.contextMenus.create({
        id: 'subAction1',
        parentId: 'mainContext',
        title: 'Action 1',
        contexts: ['all']
      });
      
      chrome.contextMenus.create({
        id: 'subAction2',
        parentId: 'mainContext',
        title: 'Action 2',
        contexts: ['all']
      });
    }
  });
}

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(function(info, tab) {
  switch(info.menuItemId) {
    case 'subAction1':
      handleAction1(info, tab);
      break;
    case 'subAction2':
      handleAction2(info, tab);
      break;
  }
});

function handleAction1(info, tab) {
  if (settings.notificationsEnabled) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'Action 1',
      message: 'Action 1 was performed'
    });
  }
}

function handleAction2(info, tab) {
  if (settings.notificationsEnabled) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icon128.png',
      title: 'Action 2',
      message: 'Action 2 was performed'
    });
  }
}

function updateSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  chrome.storage.sync.set(settings);
  
  // Update context menu if needed
  if (typeof newSettings.contextMenuEnabled !== 'undefined') {
    setupContextMenu();
  }
}

// Handle keyboard commands
chrome.commands.onCommand.addListener(function(command) {
  switch(command) {
    case 'toggle-feature':
      toggleFeature();
      break;
    case 'show-popup':
      chrome.action.open
`;
  }

  generateContentJS() {
    return `// Content script for webpage integration
const EXTENSION_UI = {
  sidebar: null,
  overlay: null,
  floatingPanel: null,
  initialized: false
};

// Initialize UI elements
function initializeUI() {
  if (EXTENSION_UI.initialized) return;
  
  // Create sidebar
  EXTENSION_UI.sidebar = createSidebar();
  
  // Create overlay
  EXTENSION_UI.overlay = createOverlay();
  
  // Create floating panel
  EXTENSION_UI.floatingPanel = createFloatingPanel();
  
  // Add keyboard shortcuts
  setupKeyboardShortcuts();
  
  EXTENSION_UI.initialized = true;
}

function createSidebar() {
  const sidebar = document.createElement('div');
  sidebar.className = 'extension-sidebar';
  sidebar.innerHTML = \`
    <div class="sidebar-header">
      <h3>Extension Sidebar</h3>
      <button class="close-btn">&times;</button>
    </div>
    <div class="sidebar-content">
      <!-- Content will be dynamically populated -->
    </div>
    <div class="sidebar-footer">
      <button class="action-btn">Action</button>
    </div>
  \`;
  
  sidebar.querySelector('.close-btn').addEventListener('click', () => toggleSidebar(false));
  document.body.appendChild(sidebar);
  return sidebar;
}

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'extension-overlay';
  overlay.innerHTML = \`
    <div class="overlay-content">
      <div class="overlay-header">
        <h3>Extension Overlay</h3>
        <button class="close-btn">&times;</button>
      </div>
      <div class="overlay-body">
        <!-- Content will be dynamically populated -->
      </div>
      <div class="overlay-footer">
        <button class="action-btn">Confirm</button>
        <button class="cancel-btn">Cancel</button>
      </div>
    </div>
  \`;
  
  overlay.querySelector('.close-btn').addEventListener('click', () => toggleOverlay(false));
  overlay.querySelector('.cancel-btn').addEventListener('click', () => toggleOverlay(false));
  document.body.appendChild(overlay);
  return overlay;
}

function createFloatingPanel() {
  const panel = document.createElement('div');
  panel.className = 'extension-floating-panel';
  panel.innerHTML = \`
    <div class="panel-header">
      <span class="drag-handle">⋮⋮</span>
      <h4>Quick Access</h4>
      <button class="minimize-btn">_</button>
    </div>
    <div class="panel-content">
      <!-- Content will be dynamically populated -->
    </div>
  \`;
  
  makeElementDraggable(panel);
  panel.querySelector('.minimize-btn').addEventListener('click', toggleFloatingPanel);
  document.body.appendChild(panel);
  return panel;
}

function makeElementDraggable(element) {
  const handle = element.querySelector('.drag-handle');
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  handle.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    
    if (e.target === handle) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      
      setTranslate(currentX, currentY, element);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = \`translate3d(\${xPos}px, \${yPos}px, 0)\`;
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
  }
}

// UI Toggle Functions
function toggleSidebar(show = true) {
  EXTENSION_UI.sidebar.classList.toggle('active', show);
  updateSidebarContent();
}

function toggleOverlay(show = true) {
  EXTENSION_UI.overlay.classList.toggle('active', show);
  updateOverlayContent();
}

function toggleFloatingPanel() {
  EXTENSION_UI.floatingPanel.classList.toggle('minimized');
  updateFloatingPanelContent();
}

// Content Update Functions
function updateSidebarContent() {
  const content = EXTENSION_UI.sidebar.querySelector('.sidebar-content');
  // Update content dynamically
  content.innerHTML = \`
    <div class="sidebar-section">
      <h4>Recent Activity</h4>
      <ul class="activity-list">
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    </div>
  \`;
}

function updateOverlayContent() {
  const content = EXTENSION_UI.overlay.querySelector('.overlay-body');
  // Update content dynamically
  content.innerHTML = \`
    <div class="overlay-section">
      <h4>Options</h4>
      <div class="options-grid">
        <div class="option-item">Option 1</div>
        <div class="option-item">Option 2</div>
        <div class="option-item">Option 3</div>
      </div>
    </div>
  \`;
}

function updateFloatingPanelContent() {
  const content = EXTENSION_UI.floatingPanel.querySelector('.panel-content');
  // Update content dynamically
  content.innerHTML = \`
    <div class="quick-actions">
      <button class="action-item">Action 1</button>
      <button class="action-item">Action 2</button>
    </div>
  \`;
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Alt + S to toggle sidebar
    if (e.altKey && e.key === 's') {
      toggleSidebar();
    }
    // Alt + O to toggle overlay
    if (e.altKey && e.key === 'o') {
      toggleOverlay();
    }
    // Alt + P to toggle floating panel
    if (e.altKey && e.key === 'p') {
      toggleFloatingPanel();
    }
  });
}

// Initialize when content script loads
initializeUI();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'toggleSidebar':
      toggleSidebar(message.show);
      break;
    case 'toggleOverlay':
      toggleOverlay(message.show);
      break;
    case 'togglePanel':
      toggleFloatingPanel();
      break;
  }
});`;
  }

  generateContentStyles() {
    return `/* Extension UI Styles */
.extension-sidebar {
  position: fixed;
  top: 0;
  right: -350px;
  width: 350px;
  height: 100vh;
  background: #ffffff;
  box-shadow: -2px 0 5px rgba(0, 0, 0, 0.1);
  z-index: 999999;
  transition: right 0.3s ease;
}

.extension-sidebar.active {
  right: 0;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.sidebar-content {
  padding: 16px;
  height: calc(100% - 120px);
  overflow-y: auto;
}

.sidebar-footer {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
}

.extension-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.5);
  display: none;
  justify-content: center;
  align-items: center;
  z-index: 999999;
}

.extension-overlay.active {
  display: flex;
}

.overlay-content {
  background: #ffffff;
  border-radius: 8px;
  width: 90%;
  max-width: 600px;
  max-height: 80vh;
  overflow-y: auto;
}

.overlay-header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.overlay-body {
  padding: 16px;
}

.overlay-footer {
  padding: 16px;
  border-top: 1px solid #e2e8f0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.extension-floating-panel {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 300px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 999999;
  transition: transform 0.3s ease;
}

.extension-floating-panel.minimized {
  transform: translateY(calc(100% - 40px));
}

.panel-header {
  padding: 8px 16px;
  background: #f8fafc;
  border-radius: 8px 8px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: move;
}

.drag-handle {
  cursor: move;
  user-select: none;
}

.panel-content {
  padding: 16px;
}

.close-btn,
.minimize-btn {
  background: none;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: #64748b;
}

.close-btn:hover,
.minimize-btn:hover {
  color: #334155;
}

.action-btn {
  padding: 8px 16px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.action-btn:hover {
  background: #4f46e5;
}

.cancel-btn {
  padding: 8px 16px;
  background: #e2e8f0;
  color: #475569;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.cancel-btn:hover {
  background: #cbd5e1;
}

.activity-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.activity-list li {
  padding: 8px 0;
  border-bottom: 1px solid #e2e8f0;
}

.options-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.option-item {
  padding: 16px;
  background: #f8fafc;
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  transition: background 0.2s ease;
}

.option-item:hover {
  background: #e2e8f0;
}

.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-item {
  padding: 8px;
  background: #f8fafc;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.action-item:hover {
  background: #e2e8f0;
}`;
  }

  generateDevToolsHTML(data) {
    return `<!DOCTYPE html>
<html>
<head>
  <title>${data.name} DevTools</title>
</head>
<body>
  <div class="devtools-container">
    <h1>${data.name} DevTools</h1>
    <div class="devtools-content">
      <!-- Add your devtools content here -->
    </div>
  </div>
  <script src="devtools.js"></script>
</body>
</html>`;
  }

  generateDevToolsJS() {
    return `// Add your devtools JavaScript code here
document.addEventListener('DOMContentLoaded', function() {
  // Initialize devtools functionality
});`;
  }

  generateContextMenuJS() {
    return `// Add your context menu JavaScript code here
chrome.contextMenus.create({
  id: 'context-menu',
  title: 'Context menu',
  contexts: ['all']
});

chrome.contextMenus.onClicked.addListener(function(info, tab) {
  // Handle context menu click
});`;
  }

  generateOmniboxJS() {
    return `// Add your omnibox JavaScript code here
chrome.omnibox.onInputChanged.addListener(function(text, suggest) {
  // Handle omnibox input change
});

chrome.omnibox.onInputEntered.addListener(function(text) {
  // Handle omnibox input enter
});`;
  }

  async initializeMonacoEditor() {
    try {
      this.editor = monaco.editor.create(document.getElementById('codeEditor'), {
        value: '',
        language: 'json',
        theme: 'vs-dark',
        automaticLayout: true,
        minimap: {
          enabled: false
        },
        readOnly: true
      });

      // Initial update
      this.updateCodePreview();
    } catch (error) {
      console.error('Error initializing Monaco Editor:', error);
    }
  }

  initializeCodePreview() {
    // File selector change handler
    document.getElementById('fileSelector').addEventListener('change', (e) => {
      this.updateCodePreview(e.target.value);
    });

    // Preview tabs handler
    document.querySelectorAll('.preview-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.preview-panel').forEach(p => p.classList.remove('active'));
        
        e.target.classList.add('active');
        const view = e.target.dataset.view;
        document.getElementById(view === 'code' ? 'codeEditor' : 'livePreview').classList.add('active');
        
        if (view === 'preview') {
          this.updateLivePreview();
        }
      });
    });

    // Add form change listener for real-time updates
    document.querySelectorAll('input, textarea, select').forEach(element => {
      element.addEventListener('change', () => this.updateCodePreview());
    });
  }

  updateCodePreview(fileType = 'manifest') {
    if (!this.editor) return;

    const data = this.getFormData();
    let content = '';
    let language = 'json';

    // Check if it's a custom file
    if (fileType.startsWith('custom_')) {
      const filename = fileType.replace('custom_', '');
      const customFile = this.customFiles.get(filename);
      if (customFile) {
        content = customFile.content;
        language = customFile.type === 'javascript' ? 'javascript' :
                  customFile.type === 'html' ? 'html' :
                  customFile.type === 'css' ? 'css' : 'plaintext';
      }
    } else {
      // Handle standard files as before
      switch (fileType) {
        case 'manifest':
          const browser = document.getElementById('firefox').checked ? 'firefox' : 'chrome';
          content = JSON.stringify(this.generateManifest(data, browser), null, 2);
          language = 'json';
          break;
        case 'popup':
          content = this.generatePopupHTML(data);
          language = 'html';
          break;
        case 'background':
          content = this.generateBackgroundJS();
          language = 'javascript';
          break;
        case 'content':
          content = this.generateContentJS();
          language = 'javascript';
          break;
        case 'options':
          content = this.generateOptionsHTML(data);
          language = 'html';
          break;
        case 'style':
          content = this.generateOptionsCSS();
          language = 'css';
          break;
      }
    }

    // Update editor content and language
    monaco.editor.setModelLanguage(this.editor.getModel(), language);
    this.editor.setValue(content);

    // Format the document
    setTimeout(() => {
      this.editor.getAction('editor.action.formatDocument').run();
    }, 100);

    // Update file type indicator
    this.updateFileTypeIndicator(fileType, language);
  }

  updateFileTypeIndicator(fileType, language) {
    const indicator = document.querySelector('.file-type-indicator') || 
      document.createElement('div');
    indicator.className = 'file-type-indicator';
    
    const icons = {
      json: '<svg>...</svg>',
      html: '<svg>...</svg>',
      javascript: '<svg>...</svg>',
      css: '<svg>...</svg>'
    };

    indicator.innerHTML = `
      ${icons[language] || ''}
      <span>${language.toUpperCase()}</span>
    `;

    const selector = document.querySelector('.file-selector');
    if (!indicator.parentElement) {
      selector.appendChild(indicator);
    }
  }

  updateLivePreview() {
    const fileType = document.getElementById('fileSelector').value;
    const previewFrame = document.getElementById('previewFrame');
    const data = this.getFormData();
    
    let content = '';
    
    switch(fileType) {
      case 'popup':
        content = this.generatePopupHTML(data);
        // Add CSS link to preview
        content = content.replace('</head>', 
          `<style>${this.generatePopupCSS()}</style></head>`);
        break;
      case 'options':
        content = this.generateOptionsHTML(data);
        // Add CSS link to preview
        content = content.replace('</head>', 
          `<style>${this.generateOptionsCSS()}</style></head>`);
        break;
      default:
        content = `
          <div style="padding: 20px; font-family: sans-serif; color: #666;">
            <h3>Preview not available</h3>
            <p>Live preview is only available for HTML files (popup.html and options.html)</p>
            <p>Please use the Code view to see the content of this file.</p>
          </div>
        `;
    }
    
    // Update the preview iframe
    previewFrame.srcdoc = content;
  }

  async generateExtension() {
    const data = this.getFormData();
    
    if (!this.validateForm(data)) {
      return;
    }

    this.currentConfig = data; // Store current configuration
    this.hasGenerated = true;

    if (data.browsers.chromium) {
      this.generateFiles(data, 'chrome');
      document.getElementById('downloadChrome').classList.remove('hidden');
    }

    if (data.browsers.firefox) {
      this.generateFiles(data, 'firefox');
      document.getElementById('downloadFirefox').classList.remove('hidden');
    }

    // Show download section
    const downloadSection = document.getElementById('downloadSection');
    downloadSection.classList.remove('hidden');
    
    // Add regeneration prompt
    if (!document.getElementById('regeneratePrompt')) {
      const regenerateSection = document.createElement('div');
      regenerateSection.className = 'regenerate-prompt';
      regenerateSection.innerHTML = `
        <h3>Want to make changes?</h3>
        <p>Describe what you'd like to modify:</p>
        <textarea id="regeneratePrompt" placeholder="Example: Add bookmark functionality and change the color scheme"></textarea>
        <button id="regenerateBtn" class="secondary-btn">Update Extension</button>
      `;
      downloadSection.appendChild(regenerateSection);
      
      // Bind new regenerate button
      document.getElementById('regenerateBtn').addEventListener('click', () => this.handleRegeneration());
    }

    // Update all preview panels
    this.updateAllPreviews();
  }

  updateAllPreviews() {
    // Update code preview for current file
    this.updateCodePreview(document.getElementById('fileSelector').value);
    
    // Update live preview if active
    if (document.querySelector('.preview-tab[data-view="preview"]').classList.contains('active')) {
      this.updateLivePreview();
    }
  }

  handleFileChange(fileType) {
    // Update Monaco editor language based on file type
    const languageMap = {
      'manifest': 'json',
      'popup': 'html',
      'background': 'javascript',
      'content': 'javascript',
      'options': 'html',
      'style': 'css'
    };

    if (this.editor) {
      monaco.editor.setModelLanguage(
        this.editor.getModel(),
        languageMap[fileType] || 'plaintext'
      );
    }

    // Update preview
    this.updateCodePreview(fileType);
  }

  async handleRegeneration() {
    const prompt = document.getElementById('regeneratePrompt').value;
    if (!prompt) {
      alert('Please enter a description of what you want to change');
      return;
    }

    try {
      // Combine original config with new changes
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Modify the following extension configuration based on this change request: "${prompt}"
          
          Current configuration:
          ${JSON.stringify(this.currentConfig, null, 2)}
          
          Generate an updated configuration that maintains existing functionality while incorporating the requested changes.`,
        }),
      });

      const newConfig = await response.json();
      this.applyAIConfig(newConfig);
      this.updateAllPreviews();
      
      // Show success message
      const message = document.createElement('div');
      message.className = 'success-message';
      message.textContent = 'Extension updated successfully!';
      document.querySelector('.download-section').appendChild(message);
      setTimeout(() => message.remove(), 3000);
    } catch (error) {
      console.error('Error updating configuration:', error);
      alert('Error updating extension configuration. Please try again.');
    }
  }

  async downloadExtension(browser) {
    const data = this.getFormData();
    const filename = `${data.name}-${browser}.zip`;
    
    try {
      const content = await this.zip.generateAsync({ type: 'blob' });
      saveAs(content, filename);
    } catch (error) {
      console.error('Error generating zip file:', error);
      alert('Error generating extension files. Please try again.');
    }
  }

  switchTab(event) {
    const tabName = event.target.dataset.tab;
    
    // Update buttons
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    
    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
      if (content.dataset.tab === tabName) {
        content.classList.add('active');
      }
    });
  }

  initializeAIGeneration() {
    document.getElementById('aiGenerateBtn').addEventListener('click', () => this.generateFromAI());
  }

  async generateFromAI() {
    const prompt = document.getElementById('aiPrompt').value;
    if (!prompt) {
      alert('Please enter a description of your extension');
      return;
    }

    try {
      const response = await fetch('/api/ai_completion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Generate a complete browser extension configuration based on this description: "${prompt}"
          
          Generate a response matching this format:
          {
            "name": string,
            "description": string,
            "version": string,
            "author": string,
            "homepage": string,
            "features": {
              "popup": boolean,
              "options": boolean,
              "background": boolean,
              "contentScript": boolean,
              "devtools": boolean,
              "contextMenu": boolean,
              "commands": boolean,
              "omnibox": boolean
            },
            "permissions": {
              "storage": boolean,
              "tabs": boolean,
              "activeTab": boolean,
              "notifications": boolean,
              "webRequest": boolean,
              "cookies": boolean,
              "downloads": boolean,
              "history": boolean,
              "bookmarks": boolean,
              "proxy": boolean
            },
            "contentScriptSettings": {
              "urlPatterns": string[],
              "matchAll": boolean,
              "runAtStart": boolean
            },
            "additionalFiles": [
              {
                "filename": string,
                "content": string,
                "type": "javascript" | "html" | "css"
              }
            ]
          }

          Example response:
          {
            "name": "Quick Bookmarker",
            "description": "Efficiently save and organize bookmarks with tags",
            "version": "1.0.0",
            "author": "AI Assistant",
            "homepage": "https://example.com",
            "features": {
              "popup": true,
              "options": true,
              "background": true,
              "contentScript": true,
              "devtools": false,
              "contextMenu": true,
              "commands": true,
              "omnibox": true
            },
            "permissions": {
              "storage": true,
              "bookmarks": true,
              "tabs": true,
              "activeTab": true,
              "notifications": false,
              "webRequest": false,
              "cookies": false,
              "downloads": false,
              "history": false,
              "proxy": false
            },
            "contentScriptSettings": {
              "urlPatterns": ["*://*/*"],
              "matchAll": true,
              "runAtStart": false
            },
            "additionalFiles": [
              {
                "filename": "bookmark-manager.js",
                "content": "// Bookmark management functionality...",
                "type": "javascript"
              }
            ]
          }`,
        }),
      });

      if (!response.ok) {
        throw new Error('API request failed');
      }

      const config = await response.json();
      
      // Validate the response has the required structure
      if (!config || !config.name || !config.features || !config.permissions) {
        throw new Error('Invalid response format');
      }

      // Store the configuration
      this.currentConfig = config;

      // Apply the configuration to the form
      this.applyAIConfig(config);

      // Update file selector with new files
      this.updateFileSelector(config);

      // Show success message
      const successMessage = document.createElement('div');
      successMessage.className = 'success-message';
      successMessage.textContent = 'Extension configuration generated successfully!';
      document.querySelector('.ai-section').appendChild(successMessage);
      setTimeout(() => successMessage.remove(), 3000);

      // Generate the extension
      this.generateExtension();

    } catch (error) {
      console.error('Error generating AI config:', error);
      
      // Show more detailed error message
      const errorMessage = document.createElement('div');
      errorMessage.className = 'error-message';
      errorMessage.textContent = `Error: ${error.message}. Please try again or modify your prompt.`;
      document.querySelector('.ai-section').appendChild(errorMessage);
      setTimeout(() => errorMessage.remove(), 5000);
    }
  }

  updateFileSelector(config) {
    const fileSelector = document.getElementById('fileSelector');
    fileSelector.innerHTML = ''; // Clear existing options
    
    // Add standard files
    const standardFiles = ['manifest.json', 'popup.html', 'background.js', 'content.js', 'options.html'];
    standardFiles.forEach(file => {
      const option = document.createElement('option');
      option.value = file.split('.')[0];
      option.textContent = file;
      fileSelector.appendChild(option);
    });

    // Add AI-generated additional files
    if (config.additionalFiles) {
      config.additionalFiles.forEach(file => {
        const option = document.createElement('option');
        option.value = `custom_${file.filename}`;
        option.textContent = file.filename;
        fileSelector.appendChild(option);
        
        // Store the custom file content
        this.customFiles.set(file.filename, {
          content: file.content,
          type: file.type
        });
      });
    }

    // Update code preview with first file
    this.updateCodePreview(fileSelector.value);
  }

  applyAIConfig(config) {
    // Basic Information
    document.getElementById('extensionName').value = config.name;
    document.getElementById('extensionDescription').value = config.description;
    document.getElementById('version').value = config.version;
    document.getElementById('author').value = config.author;
    document.getElementById('homepage').value = config.homepage;

    // Features
    Object.entries(config.features).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (element) element.checked = value;
    });

    // Permissions
    Object.entries(config.permissions).forEach(([key, value]) => {
      const element = document.getElementById(key);
      if (element) element.checked = value;
    });

    // Content Script Settings
    if (config.features.contentScript && config.contentScriptSettings) {
      document.getElementById('contentMatchingSection').style.display = 'block';
      document.getElementById('urlPatterns').value = config.contentScriptSettings.urlPatterns.join('\n');
      document.getElementById('matchAll').checked = config.contentScriptSettings.matchAll;
      document.getElementById('runAtStart').checked = config.contentScriptSettings.runAtStart;
    }

    // Update preview
    this.updateCodePreview();
  }
}

// Initialize after Monaco Editor is loaded
window.onload = () => {
  require(['vs/editor/editor.main'], function() {
    new ExtensionGenerator();
  });
};