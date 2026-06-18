# ZCode Account Switcher (zcode-account-switcher)

An **invisible** account switching tool for ZCode that comes in two forms: a **desktop app (Electron GUI)** and a **CLI**. It lets you **switch ZCode client login accounts with one click**, so you do not have to repeat the OAuth + verification-code login flow every time.

**Other languages**

- [中文文档](docs/README.zh.md)
- [Русская документация](docs/README.ru.md)

---

## Platform Support

| Platform | Status |
|----------|--------|
| Windows  | ✅ Fully supported |
| macOS    | ✅ Fully supported (process detection, kill, and auto-restart) |
| Linux    | ⚠️ Should work (CLI only, not tested) |

---

## Quick Start (First Time)

```bash
git clone https://github.com/zubyrbutt/zcode-account-switcher.git
cd zcode-account-switcher
npm run setup
```

This single command installs dependencies, builds the UI, and launches the desktop app.

## Desktop App (Recommended · GUI)

### macOS / Linux

```bash
npm run setup
```

Or if already set up:

```bash
npm run desktop
```

### Windows

```cmd
npm run setup
```

Or double-click `启动桌面版.bat`.

### Usage

1. Open the desktop app

2. Click **Add Account** in the top-right corner to open a browser window for OAuth login

3. Sign in with your ZCode credentials in the browser — the app will automatically detect the login and save the snapshot

4. Switch between accounts with one click from the list

---

## How It Works

ZCode client sign-in state is stored entirely in two files at `~/.zcode/v2/`:

| File | Content |
|------|---------|
| `credentials.json` | Encrypted OAuth tokens (`oauth:zai:access_token` / `zcodejwttoken` / `oauth:zai:user_info`) |
| `config.json` | `apiKey` values in each provider block (plain JWT; the base64 payload contains `user_id`) |

Together, these two files represent **a complete login state**. What the tool does:

1. **capture**: saves the current pair of files as an "account snapshot"
2. **use**: closes ZCode → backs up the current login state to `.last` → **atomically replaces** those two files with the snapshot → restarts ZCode
3. The account identity (fingerprint) is derived from `user_id`, decoded from the JWT `apiKey` of an enabled provider in `config.json`, and used for deduplication and naming

Switching is essentially "replace login-state files + restart", hence **invisible switching** — no QR scans, no verification codes.

---

## CLI Version (Command Line · Fallback)

You only need Node.js >= 18, with **zero dependencies** (no `npm install` required).

```bash
cd zcode-account-switcher
node src/cli.js status
node src/cli.js quota
```

The project root also provides npm forwarding scripts:

```bash
npm run status
npm run quota
npm run build
npm run desktop
```

### Optional alias

**PowerShell (Windows):**
```powershell
function zcas { node "<project-path>\zcode-account-switcher\src\cli.js" @args }
```

**bash/zsh (macOS/Linux):**
```bash
alias zcas='node /path/to/zcode-account-switcher/src/cli.js'
```

Then use `zcas status` / `zcas use 1`.

---

## Usage Flow

### First time: run capture once for each account

After logging in to a ZCode account, while that account is signed in, run:

```bash
node src/cli.js capture --name "main account"
```

Then exit ZCode → log in with another account → capture again:

```bash
node src/cli.js capture --name "alt account A"
```

Repeat until all accounts are saved.

### Daily switching

```bash
# show the current account + list
node src/cli.js status

# switch to the account at index 2 (ZCode will close and restart automatically)
node src/cli.js use 2

# or use an id (prefixes are supported, e.g. a869)
node src/cli.js use a869
```

### If a switch goes wrong

```bash
# roll back to the login state before the switch (using the .last backup)
node src/cli.js rollback
```

---

## Command Reference

| Command | Purpose |
|---------|---------|
| `status` | Show the current signed-in account + the saved account list (default command) |
| `list` | List all saved accounts |
| `quota` | Query the current account quota (total, used, remaining, breakdown) |
| `capture [--name name] [--note note] [--overwrite]` | Save the current login state as a snapshot (use `--overwrite` to replace an existing snapshot with the same name) |
| `use <id\|index> [--no-restart] [--force]` | Switch accounts (auto-restarts ZCode by default; `--no-restart` only replaces files and does not launch) |
| `delete <id\|index>` | Delete a snapshot |
| `rename <id\|index> <new-name>` | Rename |
| `rollback [--no-restart]` | Roll back to the pre-switch state (`.last`) |
| `kill` / `launch` | Manually close / launch ZCode |

`<id|index>` supports list indexes (`1`/`2`/`3`), short account ids, and id prefixes (e.g. `a869` matches `a869314f`).

---

## Safety Mechanisms

- **ZCode must be closed before switching**: editing login-state files while the app is running is unreliable because the client may write them back. The tool defaults to `--force` to kill the process automatically; without it, switching is rejected and a prompt is shown.
- **Automatic backup**: before each `use`, the current two files are backed up to `.last/`, so `rollback` is always available.
- **Atomic writes**: files are written to `.tmp` first and then renamed, which avoids half-written login states.
- **Self-healing on write failure**: if replacement fails, the tool restores from `.last` automatically — no broken state left behind.
- **Fingerprint deduplication**: capturing the same account again prompts that it already exists (`--overwrite` is required to replace it).

---

## Directory Structure

```
zcode-account-switcher/
├── src/                          # Backend core (shared by CLI + desktop, pure CommonJS, zero deps)
│   ├── paths.js                  # Path constants (v2 directory, ZCode.exe/app lookup)
│   ├── fingerprint.js            # Decode JWT and use user_id as the account fingerprint
│   ├── manager.js                # Snapshot CRUD (list/capture/use/delete/rename)
│   ├── switcher.js               # Process detection / backup / atomic replacement / rollback
│   └── cli.js                    # CLI command routing
├── desktop/                      # Electron desktop app
│   ├── main.js                   # Main process: window creation + IPC + logs
│   ├── preload.js                # contextBridge safety bridge
│   ├── index.html                # Vite entry (for development)
│   ├── vite.config.js            # React build config
│   ├── assets/icon.png           # App icon
│   └── renderer/                 # React frontend (App + components + dark theme)
├── docs/                         # Documentation
│   ├── README.zh.md              # Chinese documentation
│   ├── README.en.md              # English documentation (mirror)
│   └── README.ru.md              # Russian documentation
├── accounts/                     # Account snapshots (auto-generated, do not commit)
├── .last/                        # Previous login state backup (auto-generated, do not commit)
├── 启动桌面版.bat                 # Windows launcher (production mode)
├── 启动桌面版-开发模式.bat         # Windows launcher (development mode)
├── package.json
└── README.md
```

---

## Pre-Release Safety Reminder

Before public release or uploading to GitHub, double-check that the repository does not contain:

- `accounts/`, `.last/`, `browser_profile/`, and other local account / login-state directories.
- `.har`, `.log`, tokens, cookies, sessions, and other sensitive files.
- `node_modules/`, build artifacts, temporary analysis scripts, and other local development files.

---

## FAQ

**Q: ZCode still shows the old account after switching?**  
A: Make sure ZCode was closed and restarted during the switch (if `status` shows "running", `use` will automatically kill + launch it). If you use `--no-restart`, you must restart ZCode manually for the change to take effect.

**Q: `status` shows "Unable to recognize current signed-in account"?**  
A: That means there is no provider with a plain JWT `apiKey` in the current `config.json` (it may all be `enc:` encrypted or the account may not be signed in). You can still switch because the tool uses the full files from the snapshot, but the fingerprint will fall back to a weaker hash. It is recommended to run capture for each account when a plain `apiKey` provider is enabled.

**Q: Do the tokens in an account snapshot expire?**  
A: Yes. `access_token` has an expiration time. However, after ZCode starts, the client uses a refresh mechanism to renew it automatically, so the snapshot mainly preserves the "login identity" and the client handles renewal. If an account has not been used for a long time and refresh also expires, just sign in again and run `capture --overwrite`.

**Q: What if I change computers?**  
A: Copy the entire `accounts/` directory over (assuming the new machine also has ZCode installed and the `.zcode/v2` path is the same).

---

⚠️ **Disclaimer**

This project is for learning, research, and personal use only. It must not be used for commercial purposes or provided as a service to others.

All consequences arising from the use of this project, including but not limited to account bans and legal risks, are the user's responsibility.

This project does not store or collect any user data.

If you believe your rights have been infringed, please contact me for removal.

Please follow the Z.AI / Zhipu service terms, use the project reasonably, and avoid putting pressure on the official service.

This project is purely for research and learning exchange.

---

## Friends

- [LINUX DO Community](https://linux.do/)
