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
	fmt.Println("Usage: logvue <command> [-p|--port <port>]")
	fmt.Println("Commands:")
	fmt.Println("  start [-p|--port <port>]  Start the server")
	fmt.Println("  stop                       Stop the server")
	fmt.Println("  status                     Check if server is running")
}

func handleStart() {
	port := defaultPort

	// Parse flags manually for cross-platform compatibility
	args := os.Args[2:]
	for i := 0; i < len(args); i++ {
		if args[i] == "-p" || args[i] == "--port" {
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
		}
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

	fmt.Printf("Server starting on port %d (PID: %d)\n", port, os.Getpid())

	// Start server - blocks until shutdown
	if err := startServer(port); err != nil {
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
