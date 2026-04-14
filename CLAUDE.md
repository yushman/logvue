# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogVue is a log viewer application for Android logcat JSON exports. It consists of a Kotlin/Ktor backend that parses and
filters logs, and a React TypeScript frontend with virtual scrolling, filtering, and timeline visualization.

## Build Commands

### Backend (Kotlin/Ktor)

```bash
cd backend
gradle run                    # Start server on port 8080
gradle build                  # Build JAR
gradle test                   # Run tests
```

### Frontend (React/Vite)

```bash
cd frontend
npm install                   # Install dependencies
npm run dev                   # Start dev server
npm run build                 # Production build
```

## Architecture

### Backend Structure

```
backend/src/main/kotlin/com/logvue/
  Main.kt                     # Ktor Application entry point (CIO engine, port 8080)
  plugins/
    Routing.kt                 # API route configuration
    Serialization.kt           # JSON serialization setup
  data/
    model/
      LogEntry.kt              # LogEntry, LogHeader, FilterRequest, FilterResponse
      LogFile.kt               # LogFileMetadata, TimeRange, LogUploadResponse
      Timeline.kt              # Timeline bucket and request models
      Exceptions.kt            # FileTooLargeException, MalformedJsonException
    parser/
      LogParser.kt             # Parser interface
      AndroidLogcatParser.kt   # Android logcat JSON (new + legacy format support)
  service/
    LogService.kt              # Business logic: upload, filter, timeline, metadata
```

Note: Currently uses direct instantiation (no dependency injection framework).

### Frontend Structure

```
frontend/src/
  main.tsx                    # React app entry point
  App.tsx                     # Root component (FileDropzone → LogView)
  stores/
    useLogStore.ts            # Zustand store (filter state, file metadata, timeline)
  api/
    client.ts                 # Backend API client (fetch-based)
  components/
    FileDropzone.tsx          # File upload drag & drop
    LogList.tsx               # Virtual scrolling log list (@tanstack/react-virtual)
    LogLevelFilter.tsx        # VERBOSE/DEBUG/INFO/WARN/ERROR/ASSERT checkboxes
    FilterBar.tsx             # Contains all filter controls
    TextFilter.tsx            # Tag filter with regex toggle
    ContentFilter.tsx          # Content filter + search with highlights
    TimeRangePicker.tsx       # From/to datetime pickers
    Timeline.tsx              # Timeline visualization with bucket selection
    ResolutionSelector.tsx     # sec/min/hour resolution picker
    ErrorDisplay.tsx           # Error/warning/info message display
```

## Key API Endpoints

| Method | Path                 | Purpose                                          |
|--------|----------------------|--------------------------------------------------|
| GET    | `/health`            | Health check                                     |
| POST   | `/api/logs/upload`   | Upload JSON log file, returns metadata + fileId  |
| POST   | `/api/logs/filter`   | Filter logs (levels, tag, content, time, search) |
| GET    | `/api/logs/timeline` | Get timeline buckets (fileId, resolution params) |
| GET    | `/api/logs/entry`    | Get single log entry (fileId, entryId params)    |
| GET    | `/api/logs/metadata` | Get tag colors for file (fileId param)           |

## Data Models

### Backend (Kotlin)

- `LogEntry`: id, header (LogHeader), message, timestamp (epoch millis)
- `LogHeader`: logLevel, pid, tid, applicationId, processName, tag, timestamp (seconds + nanos)
- `FilterRequest`: fileId, levels[], tagPattern, tagRegex, contentFilter, searchQuery, timeFrom, timeTo, offset, limit
- `FilterResponse`: entries[], total, hasMore, searchHighlightRanges (computed lazily for current page)
- `TimelineRequest`: fileId, resolution (sec/min/hour)

### Frontend (TypeScript)

Mirrors backend models in `frontend/src/types/LogEntry.ts`. Zustand store persists `fileId` to localStorage.

## Tech Stack

- **Backend**: Kotlin 1.9.x, Ktor 2.3.x (CIO engine), kotlinx-serialization 1.6.x
- **Frontend**: React 18 (TypeScript), Vite, Zustand, @tanstack/react-virtual
- **Storage**: In-memory ConcurrentHashMap (no database)

## Important Implementation Notes

- Parser supports two Android logcat JSON formats: new format (`{metadata, logcatMessages}`) and legacy (
  `{log: {event[], device}}`)
- All filtering is server-side (in-memory) for performance with large files
- Highlight ranges are computed lazily on the backend only for the current page when searchQuery is non-empty
- Virtual scrolling in LogList handles 100k+ entries efficiently via @tanstack/react-virtual
- Tag colors are deterministic (hash tag name → palette)
- Frontend uses Zustand (not Pinia) for state management
- File uploads are multipart form-data, not JSON body