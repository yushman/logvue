![LogVue Logo](frontend/public/favicon.svg)

# LogVue

A log viewer application for Android logcat JSON exports. Features virtual scrolling, filtering, and timeline
visualization.

![Screenshot](screenshot.png)

### Installation

#### macOS

1. Download the appropriate binary:
   - **Apple Silicon (M1/M2/M3)**:
     `curl -L -o logvue https://github.com/yushman/logvue/releases/download/v0.2.0/logvue-darwin-arm64`
   - **Intel Mac**: `curl -L -o logvue https://github.com/yushman/logvue/releases/download/v0.2.0/logvue-darwin-amd64`

2. Remove quarantine attribute (required by macOS):
   ```bash
   /usr/bin/xattr -drs com.apple.quarantine logvue
   ```

3. Make it executable:
   ```bash
   chmod +x logvue
   ```

#### Linux

1. Download the appropriate binary:
   - **x86_64**: `curl -L -o logvue https://github.com/yushman/logvue/releases/download/v0.2.0/logvue-linux-amd64`
   - **ARM64**: `curl -L -o logvue https://github.com/yushman/logvue/releases/download/v0.2.0/logvue-linux-arm64`

2. Make it executable:
   ```bash
   chmod +x logvue
   ```

### Usage

```bash
./logvue start -p 8081    # Start server on port 8081 (default)
./logvue status            # Check server status
./logvue stop              # Stop server
```

Then open http://localhost:8081 in your browser.

### License

MIT