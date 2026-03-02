# Tauri Migration Plan

## Overview

Migrate the Claude Code Web UI from a pure web application to a Tauri desktop application while maintaining the Node.js backend.

## Architecture Strategy

```
┌─────────────────────────────────────────┐
│        Tauri Desktop App                │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Rust Main Process               │ │
│  │   - Manage app lifecycle          │ │
│  │   - Spawn Node.js backend         │ │
│  │   - Handle system integration     │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   WebView (System)                │ │
│  │   Frontend: React + Vite          │ │
│  │   (Existing frontend code)        │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   Node.js Backend (Child Process) │ │
│  │   - Hono server                   │ │
│  │   - Claude Code SDK               │ │
│  │   (Existing backend code)         │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Key Decision:** Keep Node.js backend as-is, run as child process managed by Tauri.

---

## Prerequisites

### System Requirements
- **Rust**: Install via https://rustup.rs/
- **Node.js**: Already installed (v20+)
- **System WebView**:
  - macOS: Built-in (WebKit)
  - Windows: WebView2 (auto-installed)
  - Linux: webkit2gtk

### Check Installation
```bash
# Check Rust
rustc --version
cargo --version

# Install Tauri CLI
cargo install tauri-cli
# or
npm install -g @tauri-apps/cli
```

---

## Project Structure

```
claude-code-webui/
├── frontend/              # Existing React frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
├── backend/               # Existing Node.js backend
│   ├── cli/
│   ├── handlers/
│   └── package.json
├── src-tauri/             # NEW: Tauri Rust backend
│   ├── src/
│   │   ├── main.rs       # Main Rust entry
│   │   ├── backend.rs    # Node.js process manager
│   │   └── lib.rs
│   ├── Cargo.toml        # Rust dependencies
│   ├── tauri.conf.json   # Tauri configuration
│   ├── build.rs
│   └── icons/            # App icons
├── package.json           # Root package.json
└── tauri.config.json      # Alternative config location
```

---

## Implementation Steps

### Step 1: Initialize Tauri

```bash
cd /Users/ysh/ai/cowork/my-cowork/claude-code-webui

# Create Tauri app in existing project
npm install --save-dev @tauri-apps/cli
npm install @tauri-apps/api

# Initialize Tauri
npm run tauri init
```

**Interactive Setup:**
- App name: `Claude Code Web UI`
- Window title: `Claude Code`
- Web assets location: `../frontend/dist`
- Dev server URL: `http://localhost:3002`
- Dev command: `npm run dev:frontend`
- Build command: `npm run build:frontend`

---

### Step 2: Update Package.json

[NEW] Root `package.json`:
```json
{
  "name": "claude-code-webui-tauri",
  "version": "0.1.0",
  "scripts": {
    "dev:frontend": "cd frontend && npm run dev",
    "dev:backend": "cd backend && npm run dev",
    "dev": "npm-run-all --parallel dev:backend tauri:dev",
    "tauri:dev": "tauri dev",
    "tauri:build": "tauri build",
    "build:frontend": "cd frontend && npm run build",
    "build:backend": "cd backend && npm run build",
    "build": "npm run build:frontend && npm run build:backend && npm run tauri:build"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "npm-run-all": "^4.1.5"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0"
  }
}
```

---

### Step 3: Rust Backend Manager

[NEW] `src-tauri/src/backend.rs`:

```rust
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::State;

pub struct BackendProcess(pub Mutex<Option<Child>>);

pub fn start_backend() -> Result<Child, std::io::Error> {
    // Find Node.js executable
    let node_path = which::which("node")
        .or_else(|_| which::which("node.exe"))
        .expect("Node.js not found in PATH");

    // Start backend server
    let backend_dir = std::env::current_dir()
        .expect("Failed to get current directory")
        .join("backend");

    let child = Command::new(node_path)
        .arg("dist/cli/node.js")
        .current_dir(backend_dir)
        .spawn()?;

    println!("Backend started with PID: {:?}", child.id());
    Ok(child)
}

#[tauri::command]
pub fn get_backend_status(backend: State<BackendProcess>) -> bool {
    backend.0.lock().unwrap().is_some()
}
```

---

### Step 4: Main Rust Entry

[NEW] `src-tauri/src/main.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;

use backend::{start_backend, get_backend_status, BackendProcess};
use std::sync::Mutex;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Start backend server
            let backend_process = match start_backend() {
                Ok(child) => Some(child),
                Err(e) => {
                    eprintln!("Failed to start backend: {}", e);
                    None
                }
            };

            // Store backend process in app state
            app.manage(BackendProcess(Mutex::new(backend_process)));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_backend_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

---

### Step 5: Tauri Configuration

[MODIFY] `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "beforeDevCommand": "npm run dev:frontend",
    "beforeBuildCommand": "npm run build:frontend && npm run build:backend",
    "devPath": "http://localhost:3002",
    "distDir": "../frontend/dist",
    "withGlobalTauri": true
  },
  "package": {
    "productName": "Claude Code",
    "version": "0.1.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "open": true
      },
      "dialog": {
        "all": true
      },
      "fs": {
        "scope": ["$HOME/.claude/**", "$HOME/.claude-webui/**"]
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.claude.code.webui",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "resources": ["../backend/dist/**/*", "../backend/node_modules/**/*"]
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "Claude Code",
        "width": 1400,
        "height": 900,
        "minWidth": 800,
        "minHeight": 600
      }
    ]
  }
}
```

---

### Step 6: Update Frontend for Tauri

[MODIFY] `frontend/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';

export default defineConfig({
  plugins: [react()],
  
  // @tauri-apps/cli integration
  clearScreen: false,
  server: {
    port: 3002,
    strictPort: true,
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  
  // Better build for Tauri
  build: {
    target: process.env.TAURI_PLATFORM === 'windows' 
      ? 'chrome105' 
      : 'safari13',
    minify: !process.env.TAURI_DEBUG,
    sourcemap: !!process.env.TAURI_DEBUG,
  }
});
```

---

### Step 7: Cargo Dependencies

[NEW] `src-tauri/Cargo.toml`:

```toml
[package]
name = "claude-code-webui"
version = "0.1.0"
edition = "2021"

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = ["shell-open", "dialog-all"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
which = "6.0"

[features]
custom-protocol = ["tauri/custom-protocol"]
```

---

## Development Workflow

### Development Mode
```bash
# Terminal 1: Start backend (optional, Tauri will start it)
npm run dev:backend

# Terminal 2: Start Tauri app (includes frontend)
npm run tauri:dev
```

### Production Build
```bash
# Build everything
npm run build

# Output locations:
# - macOS: src-tauri/target/release/bundle/dmg/
# - Windows: src-tauri/target/release/bundle/msi/
# - Linux: src-tauri/target/release/bundle/appimage/
```

---

## Migration Checklist

### Phase 1: Setup
- [ ] Install Rust and Tauri CLI
- [ ] Run `tauri init`
- [ ] Create `src-tauri` directory structure
- [ ] Add root `package.json`

### Phase 2: Backend Integration
- [ ] Create `backend.rs` for Node.js process management
- [ ] Update `main.rs` with backend startup
- [ ] Test backend spawning in dev mode

### Phase 3: Configuration
- [ ] Configure `tauri.conf.json`
- [ ] Add app icons
- [ ] Set up resource bundling
- [ ] Update `vite.config.ts`

### Phase 4: Testing
- [ ] Test dev mode: `npm run tauri:dev`
- [ ] Test backend communication
- [ ] Test all existing features
- [ ] Test on target platforms

### Phase 5: Build & Package
- [ ] Test production build
- [ ] Verify backend bundling
- [ ] Test installed app
- [ ] Sign app (for distribution)

---

## Expected Results

### Performance
- **Start Time**: ~500ms (vs 2-5s for Electron)
- **Memory**: ~50MB (vs 150MB+ for Electron)
- **App Size**: ~10-15MB (vs 100MB+ for Electron)

### User Experience
- ✅ Native window controls
- ✅ System tray integration
- ✅ Native notifications
- ✅ File system access (with permissions)
- ✅ Auto-updates (optional)

---

## Potential Issues & Solutions

### Issue 1: Backend Not Starting
**Solution**: Check Node.js path, ensure backend is built

### Issue 2: Frontend Can't Connect
**Solution**: Verify port configuration, check CORS settings

### Issue 3: Large Bundle Size
**Solution**: Exclude dev dependencies, optimize backend bundle

### Issue 4: Platform-specific Bugs
**Solution**: Test on each platform, use conditional compilation

---

## Next Steps

1. **Review this plan** - Confirm approach
2. **Install prerequisites** - Rust, Tauri CLI
3. **Initialize Tauri** - Run setup commands
4. **Iterative development** - Build and test incrementally
