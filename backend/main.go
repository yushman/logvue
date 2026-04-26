package main

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"syscall"
	"time"
)

const (
	pidFile    = ".logvue.pid"
	defaultPort = 8080
	defaultHTTPSPort = 443
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		return
	}

	switch os.Args[1] {
	case "start":
		handleStart()
	case "stop":
		handleStop()
	case "status":
		handleStatus()
	default:
		printUsage()
	}
}

func printUsage() {
	fmt.Println("Usage: logvue <command> [options]")
	fmt.Println("Commands:")
	fmt.Println("  start [options]  Start the server")
	fmt.Println("  stop             Stop the server")
	fmt.Println("  status           Check if server is running")
	fmt.Println("")
	fmt.Println("Options:")
	fmt.Println("  -p, --port <port>       HTTP port (default: 8080)")
	fmt.Println("  --tls                   Enable HTTPS with Let's Encrypt auto-cert")
	fmt.Println("  --domain <domain>       Domain name for Let's Encrypt (required with --tls)")
	fmt.Println("  --https-port <port>     HTTPS port (default: 443, requires root)")
}

func handleStart() {
	port := defaultPort
	var tlsEnabled bool
	var domain string
	httpsPort := defaultHTTPSPort

	// Parse flags manually for cross-platform compatibility
	args := os.Args[2:]
	for i := 0; i < len(args); i++ {
		switch args[i] {
		case "-p", "--port":
			if i+1 < len(args) {
				p, err := strconv.Atoi(args[i+1])
				if err != nil {
					log.Fatalf("Invalid port: %s", args[i+1])
				}
				port = p
				i++
			} else {
				log.Fatal("Port requires a value")
			}
		case "--tls":
			tlsEnabled = true
		case "--domain":
			if i+1 < len(args) {
				domain = args[i+1]
				i++
			} else {
				log.Fatal("Domain requires a value")
			}
		case "--https-port":
			if i+1 < len(args) {
				p, err := strconv.Atoi(args[i+1])
				if err != nil {
					log.Fatalf("Invalid HTTPS port: %s", args[i+1])
				}
				httpsPort = p
				i++
			} else {
				log.Fatal("HTTPS port requires a value")
			}
		}
	}

	if tlsEnabled && domain == "" {
		log.Fatal("--domain is required when --tls is enabled")
	}

	// Check if already running
	if pid, err := readPidFile(); err == nil {
		if isProcessRunning(pid) {
			log.Fatalf("Server is already running (PID: %d)", pid)
		}
	}

	// Write PID file
	if err := writePidFile(os.Getpid()); err != nil {
		log.Fatalf("Failed to write PID file: %v", err)
	}

	if tlsEnabled {
		fmt.Printf("Server starting with HTTPS (Let's Encrypt) on ports %d (HTTP) -> %d (HTTPS)\n", port, httpsPort)
	} else {
		fmt.Printf("Server starting on port %d (PID: %d)\n", port, os.Getpid())
	}

	// Start server - blocks until shutdown
	if err := startServer(port, tlsEnabled, domain, httpsPort); err != nil {
		log.Printf("Server error: %v", err)
	}

	// Cleanup
	os.Remove(pidFile)
	fmt.Println("Server stopped")
}

func handleStop() {
	pid, err := readPidFile()
	if err != nil {
		log.Fatal("Server is not running (no PID file)")
	}

	if !isProcessRunning(pid) {
		os.Remove(pidFile)
		log.Fatal("Server is not running (stale PID file)")
	}

	// Send SIGTERM to gracefully shutdown
	proc, err := os.FindProcess(pid)
	if err != nil {
		log.Fatalf("Failed to find process: %v", err)
	}

	if err := proc.Signal(syscall.SIGTERM); err != nil {
		log.Fatalf("Failed to stop server: %v", err)
	}

	// Wait for process to exit
	time.Sleep(500 * time.Millisecond)

	os.Remove(pidFile)
	fmt.Println("Server stopped")
}

func handleStatus() {
	pid, err := readPidFile()
	if err != nil {
		fmt.Println("Server is not running")
		return
	}

	if !isProcessRunning(pid) {
		os.Remove(pidFile)
		fmt.Println("Server is not running (stale PID file)")
		return
	}

	fmt.Printf("Server is running (PID: %d)\n", pid)
}

func readPidFile() (int, error) {
	data, err := os.ReadFile(pidFile)
	if err != nil {
		return 0, err
	}
	pid, err := strconv.Atoi(strings.TrimSpace(string(data)))
	if err != nil {
		return 0, err
	}
	return pid, nil
}

func writePidFile(pid int) error {
	return os.WriteFile(pidFile, []byte(strconv.Itoa(pid)), 0644)
}

func isProcessRunning(pid int) bool {
	proc, err := os.FindProcess(pid)
	if err != nil {
		return false
	}
	// Signal 0 doesn't send anything but checks if process exists
	err = proc.Signal(syscall.Signal(0))
	return err == nil
}
