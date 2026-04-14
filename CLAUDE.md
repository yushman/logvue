# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogVue is a log viewer application for Android logcat JSON exports. It consists of a Kotlin/Ktor backend that parses and
filters logs, and a Vue.js frontend with virtual scrolling, filtering, and timeline visualization.

## Build Commands

### Backend (Kotlin/Ktor)

```bash
cd backend
gradle run                    # Start server on port 8080
gradle build                  # Build JAR
gradle test                   # Run tests
```

### Frontend (Vue 3/Vite)

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
    parser/
      LogParser.kt             # Parser interface
      AndroidLogcatParser.kt   # Android logcat JSON (new + legacy format support)
  service/
    LogService.kt              # Business logic: upload, filter, highlight ranges
```

Note: Currently uses direct instantiation (no Koin/dependency injection framework).

### Frontend Structure

```
frontend/src/
  main.ts                      # Vue app entry point
  App.vue                      # Root component (FileDropzone → LogView)
  stores/
    logStore.ts                # Pinia store (filter state, persisted fileId to localStorage)
  components/
    FileDropzone.vue           # File upload drag & drop
    LogList.vue                # Virtual scrolling log list (vue-virtual-scroller)
    LogLevelFilter.vue         # VERBOSE/DEBUG/INFO/WARN/ERROR/ASSERT checkboxes
    FilterBar.vue              # Contains all filter controls
    TextFilter.vue             # Tag filter with regex toggle
    ContentFilter.vue          # Content filter + search with highlights
    TimeRangePicker.vue        # From/to datetime pickers
  api/
    client.ts                  # Backend API client
  types/
    LogEntry.ts                # TypeScript interfaces mirroring backend models
  utils/
    tagColors.ts               # Deterministic tag → color mapping
```

## Key API Endpoints

| Method | Path               | Purpose                                          |
|--------|--------------------|--------------------------------------------------|
| GET    | `/health`          | Health check                                     |
| POST   | `/api/logs/upload` | Upload JSON log file, returns metadata + fileId  |
| POST   | `/api/logs/filter` | Filter logs (levels, tag, content, time, search) |

## Data Models

### Backend (Kotlin)

- `LogEntry`: id, header (LogHeader), message, timestamp (epoch millis)
- `LogHeader`: logLevel, pid, tid, applicationId, processName, tag, timestamp (seconds + nanos)
- `FilterRequest`: fileId, levels[], tagPattern, tagRegex, contentFilter, searchQuery, timeFrom, timeTo, offset, limit
- `FilterResponse`: entries[], total, hasMore, searchHighlightRanges (computed lazily for current page)

### Frontend (TypeScript)

Mirrors backend models in `frontend/src/types/LogEntry.ts`. Pinia store persists `fileId` to localStorage.

## Tech Stack

- **Backend**: Kotlin 1.9.x, Ktor 2.3.x (CIO engine), kotlinx-serialization 1.6.x
- **Frontend**: Vue 3 (Composition API), TypeScript, Vite, Pinia with persistedstate plugin
- **Storage**: In-memory ConcurrentHashMap (no database)

## Important Implementation Notes

- Parser supports two Android logcat JSON formats: new format (`{metadata, logcatMessages}`) and legacy (
  `{log: {event[], device}}`)
- All filtering is server-side (in-memory) for performance with large files
- Highlight ranges are computed lazily on the backend only for the current page when searchQuery is non-empty
- Virtual scrolling in LogList handles 100k+ entries efficiently
- Tag colors are deterministic (hash tag name → palette)
