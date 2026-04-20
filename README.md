### Installation
1. Download release binary
   - mac x86 - `curl -L -o logvue https://github.com/yushman/logvue/releases/download/v0.2.0/logvue-darwin-amd64`
   - mac arm - `curl -L -o logvue https://github.com/yushman/logvue/releases/download/v0.2.0/logvue-darwin-arm64`
   - linux x86 - `curl -L -o logvue https://github.com/yushman/logvue/releases/download/v0.2.0/logvue-linux-amd64`
3. Remove carantine on macOs - `/usr/bin/xattr -drs com.apple.quarantine logvue`
4. Make executable - `chmod +x logvue`

### Lanch  
1. Launch on specific port - `./logvue start -p 8081`
2. Use on - `http://localhost:8081`
3. Status - `./logvue status`
4. Stop - `Ctrl + C` , `./logvue stop`
