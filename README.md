# Steam Game Manager

A modern, fast, and feature-rich desktop application to downgrade Steam games, manage multiple game builds in an isolated Vault, switch versions instantly, and safeguard your save files and mod setups.

Built with **Tauri v2 (Rust)**, **React 19**, **TypeScript**, and **Chakra UI v3**.

---

## Key Features

- **🔄 Version Management & Build Switching (3 Flexible Modes)**:
  - **⚡ Automated 1-Click Version Switch**: Built-in DepotDownloader runner that automatically creates pre-change snapshots in the Version Vault, streams live download percentages and transfer speeds (MB/s), handles Steam Guard 2FA & password prompts in-app, applies files directly, caches the new build into the Version Vault, and locks the Steam manifest.
  - **🎮 Official Steam Console**: Launches the built-in Steam client console (`steam://open/console`) with ready-to-paste commands (`download_depot <appid> <depot> <manifest>`) for users who prefer using their native Steam client.
  - **💻 Manual DepotDownloader CLI**: Generates full command-line arguments (`DepotDownloader -app ... -depot ... -manifest ... -validate`) for external terminals or scripting.

- **⚡ Version Vault (Instant Hardlink Build Switching)**:
  - Automatically snapshots both your pre-change and newly installed builds into an isolated local Vault on the same drive partition.
  - Consecutive downloads build a version history automatically—switch between any previously downloaded build in under 200ms with **0 extra disk space** using filesystem hardlinks.
  - Automatically synchronizes and locks Steam manifest flags (`appmanifest_<appid>.acf`) to stop Steam from auto-updating your chosen build.

- **🌐 SteamDB Integration & Smart Patch Matching**:
  - **1-Click Clipboard Parser**: Copy a manifest table from SteamDB and click "Auto-Import" to populate all available versions and release dates.
  - **Date Correlation**: Automatically cross-references SteamDB build dates with official Steam patch notes.
  - **Same-Day Revision Estimations**: If multiple manifests were released on the same day, the app assigns revision tags (`Rev 1`, `Rev 2 / Hotfix`) to keep your builds organized.
  - **Multilingual Script Filtering**: Filters out third-party RSS syndications (e.g. foreign gaming blogs) and matches patch notes in your preferred language.

- **💾 Game & Save Backup Manager (Disaster Recovery & Archives)**:
  - Create independent deep-copy archives of your save files, `.ini` configuration settings, or complete game directories.
  - Stored in an external backup directory that safely persists even if a game is completely uninstalled from Steam.
  - Restore backups at any time with full size and file-count metrics.

- **🗂️ Universal Drive & Library Scanner**:
  - Scans across Windows drive letters (`C:\` through `Z:\`), WSL mounts (`/mnt/*`), and Linux paths (`/media/*`, `/run/media/*`, `~/.steam`).
  - Supports custom library directories and uninstalled games from your Steam userdata history.
  - Automatically resolves uninstalled game titles and dynamic headers via the Steam Store API with local caching.

- **🖼️ 4-Stage Resilient Artwork Fallback**:
  - Automatically cascades through box art (`library_600x900.jpg`), dynamic CDN headers, hero banners (`library_hero.jpg`), and store backgrounds to ensure games never display missing or broken images.

- **🎨 Multi-Theme Accent System & Customization**:
  - Choose from 7 reactive color accents: **Steam Blue**, **Cyberpunk Purple**, **Neon Emerald**, **Electric Cyan**, **Solar Amber**, **Valkyrie Crimson**, and **Rose Neon**.
  - Dynamically updates buttons, badges, spinners, hover halos, and modal highlights throughout the application.
  - Seamless Light and Dark mode toggle.

- **📐 Custom Grid Sizing & Density**:
  - Switch between **Compact (Small)**, **Standard (Medium)**, and **Posters (Large)** library grid layouts directly from the filter bar or settings.
  - Responsive depot & manifest info tags automatically adapt to smaller window sizes to eliminate awkward word wrapping.

- **✨ Modern Frameless UI & Desktop Integration**:
  - Custom Discord/Spotify-style TitleBar with native window controls (minimize, maximize/restore, close, drag region) and multi-monitor maximize support.
  - Custom in-DOM dark mode dropdown menus (`AppSelect`) replacing unstyled native OS `<select>` elements.
  - Global browser context menu suppression with dedicated game action context menus.
  - Production security lockdowns disabling DevTools and element inspection on production builds.
  - Native multi-resolution application icons with sleek modern Game Manager branding.

- **🚀 Cryptographic Auto-Updater**:
  - Built-in Tauri v2 updater powered by Minisign cryptographic verification.
  - One-click update checking and in-app download progress with auto-restart.

---

## How It Works

### 1. Downgrading a Game
1. Select a game from your library and navigate to the **Downgrade Versions** tab.
2. Choose from curated presets, or copy the manifest table from [SteamDB](https://steamdb.info) and click **"Paste / Import from SteamDB"**.
3. Copy the **DepotDownloader** command or click **"Open Steam Console"** to download the manifest.
4. Once downloaded, Steam Game Manager automatically detects the files in your Steam depot cache or download folder. Click **"Apply Files to Game"**.
5. Click **"Register with Steam"** to patch `appmanifest_<appid>.acf` so Steam recognizes the build and disables forced auto-updates.

### 2. The Build Vault
When you have a working setup you want to keep:
1. Open the **Version Vault** tab.
2. Click **"Snapshot Current Installed Build"** to archive your current installation into the Vault.
3. Switch between active builds at any time with **"Switch to this Build"**—the app swaps the files and updates the Steam manifest in seconds.

---

## Development & Setup

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (1.78+ recommended)
- [Bun](https://bun.sh/) (or Node.js 18+)
- Linux build dependencies (Ubuntu/Debian):
  ```bash
  sudo apt-get update
  sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
  ```

### Install Dependencies

```bash
# Clone the repository
git clone https://github.com/RealEzra/steam-game-manager.git
cd steam-game-manager

# Install frontend dependencies
bun install
```

### Running in Development Mode

```bash
bun run tauri dev
```

### Running Unit Tests

```bash
# Frontend & utility tests (date matching, filters, parsers)
bun test

# Rust backend tests (VDF parser, scanning, manifest patcher)
cargo test --manifest-path src-tauri/Cargo.toml
```

### Building for Production

```bash
bun run tauri build
```

Production installers will be generated under `src-tauri/target/release/bundle/`:
- **Linux**: `.AppImage`, `.deb`
- **Windows**: `.msi`, `.exe`
- **macOS**: `.dmg`, `.app`

---

## Automated Releases & Updating

This repository includes a fully automated GitHub Actions workflow (`.github/workflows/release.yml`).

To publish an update:
1. Bump `"version"` in both `package.json` and `src-tauri/tauri.conf.json`.
2. Commit and push a version tag:
   ```bash
   git commit -am "Release v0.9.1"
   git tag v0.9.1
   git push origin main --tags
   ```
3. GitHub Actions builds and cryptographically signs binaries for all three platforms and uploads `latest.json` to the release.
4. Active users will receive an in-app update prompt on startup or via **Settings → Check for Updates**.

---

## Tech Stack

- **Runtime & Desktop Layer**: [Tauri v2](https://v2.tauri.app/)
- **Backend**: Rust (tokio, serde, minisign-verify, tauri-plugin-updater, tauri-plugin-process)
- **Frontend Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite 6](https://vitejs.dev/) + [Bun](https://bun.sh/)
- **UI Components & Styling**: [Chakra UI v3](https://chakra-ui.com/) + [Ark UI](https://ark-ui.com/)
- **Icons**: [Lucide Icons](https://lucide.dev/) (`react-icons/lu`)

---

## License

MIT License. See [LICENSE](LICENSE) for details.
