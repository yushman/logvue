# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogVue is a log viewer application for Android logcat JSON exports. It consists of a Go backend that parses and
filters logs, and a React TypeScript frontend with virtual scrolling, filtering, and timeline visualization.

## Build Commands

### Backend (Go)

```bash
cd backend
go build -o logvue .          # Build binary
./logvue start -p 8080        # Start server
./logvue stop                  # Stop server
./logvue status                # Check status
go test ./...                  # Run all tests
go test ./parser -run TestName # Run single test
```

### Frontend (React/Vite)

```bash
cd frontend
npm install                   # Install dependencies
npm run dev                   # Start dev server (port 5173, proxies to 8080)
npm run build                 # Production build (outputs to ../backend/files)
npm run lint                  # ESLint
```

### Root (Makefile)

```bash
make build   # Build frontend then Go binary
make run     # Start server on 8080
make stop    # Stop server
make status  # Check server status
```

### Dev Scripts

- `devb.sh` - Clean assets, build frontend to backend/assets, start LogVue on 8080
- `devf.sh` - Build backend binary, then start LogVue on 8080 (use `devf.sh run` to skip build, `devf.sh build` to skip
  start)

## Architecture

## Abstract Syntax Tree

**To access projects AST - use `ast-index` skill**
Available commands:

- ast-index search <query> — universal search
- ast-index class <name> — find class/interface definitions
- ast-index usages <symbol> — find symbol references
- ast-index map — project structure overview
- ast-index outline <file> — file structure
- ast-index callers <func> — who calls a function

### Backend Structure

```
backend/
  main.go                     # CLI entry point (start/stop/status), PID management
  server.go                   # HTTP server, gorilla/mux router, CORS, static files
  models/
    log_entry.go             # LogEntry, LogHeader, FilterRequest, FilterResponse
    log_file.go              # LogFileMetadata, TimeRange, LogUploadResponse
    timeline.go              # Timeline bucket and request models
    exceptions.go            # FileTooLargeException, MalformedJsonException
  service/
    log_service.go           # In-memory storage, filtering, tag colors
  parser/
    parser.go               # LogParser interface
    pre_parser.go          # Format detection (Android JSON, 4 text formats)
    auto_detect.go         # Parser dispatcher
    android.go             # Android JSON (new + legacy format support)
    text_log.go            # HH:MM:SS.mmm [thread] LEVEL tag - message
    simple_text.go          # DD-MM and MMM-DD formats
    plain_text.go           # MM-DD HH:MM:SS.mmm PID TID L Tag: message
  handlers/
    health.go              # GET /health
    session.go             # GET /api/session (create/retrieve session)
    upload.go              # POST /api/logs/upload
    filter.go              # POST /api/logs/filter
    timeline.go            # GET /api/logs/timeline
    entry.go               # GET /api/logs/entry
    metadata.go            # GET /api/logs/metadata
```

### Frontend Structure

```
frontend/src/
  main.tsx                    # React app entry point
  App.tsx                     # Root component (FileDropzone → LogView)
  stores/
    useLogStore.ts            # Zustand store (filter, pagination, pinned entries, sidebar state)
  api/
    client.ts                 # Backend API client (fetch-based)
  types/
    LogEntry.ts               # TypeScript interfaces mirroring backend models
  components/
    Header.tsx                # App header
    FileDropzone.tsx          # File upload drag & drop
    LogList.tsx               # Virtual scrolling log list (@tanstack/react-virtual)
    LogLevelFilter.tsx        # VERBOSE/DEBUG/INFO/WARN/ERROR/ASSERT checkboxes
    Sidebar.tsx               # Collapsible sidebar with time/level/tag filters
    MessageInspector.tsx      # Selected log entry detail view
    Timeline.tsx              # Timeline visualization with bucket selection
    ErrorDisplay.tsx          # Error/warning/info message display
```

Note: Uses CSS Modules (`.module.css`) for styling.

## Key API Endpoints

| Method | Path                 | Purpose                                          |
|--------|----------------------|--------------------------------------------------|
| GET    | `/health`            | Health check                                     |
| GET    | `/api/session`       | Get/create session (sets cookie)                 |
| POST   | `/api/logs/upload`   | Upload log file, returns metadata + fileId       |
| POST   | `/api/logs/filter`   | Filter logs (levels, tag, content, time, search) |
| GET    | `/api/logs/timeline` | Get timeline buckets (fileId, resolution params) |
| GET    | `/api/logs/entry`    | Get single log entry (fileId, entryId params)    |
| GET    | `/api/logs/metadata` | Get tag colors for file (fileId param)           |

## Data Models

### Backend (Go)

- `LogEntry`: id, header (LogHeader), message, timestamp (epoch millis)
- `LogHeader`: logLevel, pid, tid, applicationId, processName, tag, timestamp (seconds + nanos)
- `FilterRequest`: fileId, levels[], tagPattern, tagRegex, contentFilter, searchQuery, timeFrom, timeTo, offset, limit
- `FilterResponse`: entries[], total, hasMore, searchHighlightRanges, levelCounts, tagCounts
- `TimelineRequest`: fileId, numBuckets, timeFrom, timeTo
- `TimelineResponse`: timeRange, buckets[], tagColors

### Frontend (TypeScript)

Mirrors backend models in `frontend/src/types/LogEntry.ts`. Zustand store persists `fileId` to localStorage.

## Tech Stack

- **Backend**: Go 1.x, net/http, gorilla/mux
- **Frontend**: React 18 (TypeScript), Vite, Zustand, @tanstack/react-virtual
- **Storage**: In-memory sync.Mutex + map (no database)

## Important Implementation Notes

- Parser supports two Android logcat JSON formats: new format (`{metadata, logcatMessages}`) and legacy (
  `{log: {event[], device}}`)
- All filtering is server-side (in-memory) for performance with large files
- Highlight ranges are computed on the backend for the current page when searchQuery is non-empty
- Virtual scrolling in LogList handles 100k+ entries efficiently via @tanstack/react-virtual
- Tag colors are deterministic (hash tag name → palette)
- Frontend uses Zustand (not Pinia) for state management with persist middleware (localStorage)
- File uploads are multipart form-data, not JSON body
- Frontend uses CSS Modules (`.module.css`) for component styling
- Pinned entries feature allows bookmarking specific log entries for quick access
- Client-side log limit of 1000 entries enforced via `maxLogsReached` flag in store
