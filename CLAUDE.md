# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LogVue is a log viewer application with a Kotlin/Ktor backend and Vue.js frontend. It parses and visualizes Android
logcat JSON exports with filtering, search, timeline, and virtual scrolling.

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
npm run test                  # Run tests
```

## Architecture

### Backend Structure

```
backend/src/main/kotlin/com/logvue/
  Main.kt                     # Ktor Application entry point
  plugins/
    Routing.kt                 # API route configuration
    Serialization.kt           # JSON serialization setup
  module/
    AppModule.kt               # Koin dependency injection modules
  data/
    model/
      LogEntry.kt              # Log entry data classes
      LogFile.kt               # Log file metadata
      Exceptions.kt            # Custom exceptions
    parser/
      LogParser.kt             # Parser interface
      AndroidLogcatParser.kt   # Android logcat JSON implementation
  service/
    LogService.kt              # Business logic (parsing, filtering)
```

### Frontend Structure

```
frontend/src/
  main.ts                      # Vue app entry point
  App.vue                      # Root component
  stores/
    logStore.ts                # Pinia store with filter/pagination state
  components/
    FileDropzone.vue           # File upload drag & drop
    LogList.vue               # Virtual scrolling log list
    LogLevelFilter.vue         # VERBOSE/DEBUG/INFO/WARN/ERROR/ASSERT checkboxes
    FilterBar.vue              # Contains all filter controls
    TextFilter.vue             # Tag filter with regex toggle
    ContentFilter.vue          # Content filter + search with highlights
    TimeRangePicker.vue        # From/to datetime pickers
    Timeline.vue               # SVG/Canvas timeline with per-tag markers
    ResolutionSelector.vue     # sec/min/hour selector
    PinnedRow.vue              # Sticky pinned log entry
    ErrorDisplay.vue           # Toast error notifications
    EmptyState.vue             # Empty/loading states
  api/
    client.ts                  # Backend API client
```

## Key API Endpoints

| Method | Path                 | Purpose                                                             |
|--------|----------------------|---------------------------------------------------------------------|
| GET    | `/health`            | Health check                                                        |
| POST   | `/api/logs/upload`   | Upload JSON log file, returns metadata + entry count                |
| POST   | `/api/logs/filter`   | Filter logs with levels, tag/content search, time range, pagination |
| GET    | `/api/logs/timeline` | Get aggregated timeline buckets with tag colors                     |

## Data Models

### ParsedLogFile

- `metadata`: LogFileMetadata (deviceName, avdPath, release, apiLevel, applicationIds, filter, logCount, timeRange)
- `entries`: List of LogEntry

### LogEntry

- `id`: Int
- `header`: LogHeader (logLevel, pid, tid, applicationId, processName, tag, timestamp)
- `message`: String
- `timestamp`: Long (epoch millis, derived from header.timestamp.seconds + nanos)

### FilterRequest

- `fileId`, `levels[]`, `tagPattern`, `tagRegex`, `contentFilter`, `searchQuery`, `timeFrom`, `timeTo`, `offset`,
  `limit`
- Response includes `entries[]`, `total`, `hasMore`, `searchHighlightRanges`

## Tech Stack

- **Backend**: Kotlin 1.9.x, Ktor 2.3.x (CIO engine), Koin 3.5.x, kotlinx-serialization 1.6.x
- **Frontend**: Vue 3 (Composition API), TypeScript, Vite, Pinia (persisted to localStorage)
- **Storage**: In-memory for parsed entries (no database initially)

## Important Implementation Notes

- Timeline uses SVG/Canvas for performance - aggregate buckets if more buckets than pixels
- Virtual scrolling in LogList renders only visible rows + buffer for 100k+ entries
- Tag colors are deterministic (hash tag name → palette) and shared between timeline and log list
- All filtering is server-side (in-memory) for performance
- Highlight ranges are computed lazily only for current page when searchQuery is non-empty
- Max file size: 500MB with user-friendly error handling
