<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { computed, reactive } from 'vue'
import { useLogStore } from '../stores/logStore'
import { getTagColor, getLogLevelColor } from '../utils/tagColors'
import type { LogEntry } from '../types/LogEntry'

const logStore = useLogStore()

function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function getLevelClass(level: string): string {
  return `log-level--${level.toLowerCase()}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderHighlightedMessage(message: string, entryId: number | string): string {
  const ranges = logStore.searchHighlightRanges[String(entryId)] || []
  if (ranges.length === 0) return escapeHtml(message)

  const escaped = escapeHtml(message)
  let result = escaped
  for (const [start, end] of ranges.reverse()) {
    const before = result.slice(0, start)
    const highlighted = result.slice(start, end)
    const after = result.slice(end)
    result = `${before}<mark>${highlighted}</mark>${after}`
  }
  return result
}

const pinnedEntry = computed<LogEntry | null>(() => {
  if (logStore.pinnedEntryId == null) return null
  return logStore.entries.find(e => e.id === logStore.pinnedEntryId) || null
})

// Column resizing
const columnWidths = reactive({
  level: 60,
  date: 100,
  time: 100,
  tag: 120
})

let dragging: string | null = null
let dragStartX = 0
let dragStartWidth = 0

function startDrag(key: string, e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  dragging = key
  dragStartX = e.clientX
  dragStartWidth = columnWidths[key as keyof typeof columnWidths]
  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e: MouseEvent) {
  if (!dragging) return
  const delta = e.clientX - dragStartX
  columnWidths[dragging as keyof typeof columnWidths] = Math.max(30, dragStartWidth + delta)
}

function stopDrag() {
  dragging = null
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}
</script>

<template>
  <div class="log-list">
    <!-- Column headers -->
    <div class="log-header-row">
      <div class="log-col-header" :style="{ width: columnWidths.level + 'px' }">
        <span class="header-label">LEVEL</span>
        <div class="col-resizer" @mousedown="startDrag('level', $event)"></div>
      </div>
      <div class="log-col-header" :style="{ width: columnWidths.date + 'px' }">
        <span class="header-label">DATE</span>
        <div class="col-resizer" @mousedown="startDrag('date', $event)"></div>
      </div>
      <div class="log-col-header" :style="{ width: columnWidths.time + 'px' }">
        <span class="header-label">TIME</span>
        <div class="col-resizer" @mousedown="startDrag('time', $event)"></div>
      </div>
      <div class="log-col-header" :style="{ width: columnWidths.tag + 'px' }">
        <span class="header-label">TAG</span>
        <div class="col-resizer" @mousedown="startDrag('tag', $event)"></div>
      </div>
      <div class="log-col-header log-col-header--message">
        <span class="header-label">MESSAGE</span>
      </div>
    </div>

    <!-- Pinned entry -->
    <div v-if="pinnedEntry" class="log-row log-row--pinned">
      <div class="log-cell" :style="{ width: columnWidths.level + 'px' }">
        <span
          class="log-level"
          :class="getLevelClass(pinnedEntry.header.logLevel)"
          :style="{ color: getLogLevelColor(pinnedEntry.header.logLevel) }"
        >
          {{ pinnedEntry.header.logLevel }}
        </span>
      </div>
      <div class="log-cell" :style="{ width: columnWidths.date + 'px' }">
        {{ formatDate(pinnedEntry.timestamp) }}
      </div>
      <div class="log-cell" :style="{ width: columnWidths.time + 'px' }">
        {{ formatTime(pinnedEntry.timestamp) }}
      </div>
      <div class="log-cell" :style="{ width: columnWidths.tag + 'px', color: getTagColor(pinnedEntry.header.tag || '') }">
        {{ pinnedEntry.header.tag || '---' }}
      </div>
      <div class="log-cell log-cell--message" v-html="renderHighlightedMessage(pinnedEntry.message, pinnedEntry.id)"></div>
    </div>

    <!-- Scrolling log entries -->
    <div class="log-scroll-area">
      <RecycleScroller
        v-if="logStore.entries.length > 0"
        :items="logStore.entries"
        :item-size="28"
        key-field="id"
        v-slot="{ item }: { item: LogEntry }"
      >
        <div class="log-row">
          <div class="log-cell" :style="{ width: columnWidths.level + 'px' }">
            <span
              class="log-level"
              :class="getLevelClass(item.header.logLevel)"
              :style="{ color: getLogLevelColor(item.header.logLevel) }"
            >
              {{ item.header.logLevel }}
            </span>
          </div>
          <div class="log-cell" :style="{ width: columnWidths.date + 'px' }">
            {{ formatDate(item.timestamp) }}
          </div>
          <div class="log-cell" :style="{ width: columnWidths.time + 'px' }">
            {{ formatTime(item.timestamp) }}
          </div>
          <div class="log-cell" :style="{ width: columnWidths.tag + 'px', color: getTagColor(item.header.tag || '') }">
            {{ item.header.tag || '---' }}
          </div>
          <div class="log-cell log-cell--message" v-html="renderHighlightedMessage(item.message, item.id)"></div>
        </div>
      </RecycleScroller>
      <div v-if="logStore.isLoading && logStore.entries.length === 0" class="log-list-empty">
        Loading...
      </div>
      <div v-else-if="logStore.entries.length === 0" class="log-list-empty">
        No log entries match your filters
      </div>
    </div>

    <!-- Load more -->
    <div v-if="logStore.hasMore" class="load-more-container">
      <button class="load-more-btn" :disabled="logStore.isLoading" @click="logStore.loadMore">
        {{ logStore.isLoading ? 'Loading...' : 'Load More' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.log-list {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #1e1e1e;
  height: 100%;
}

.log-list-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 1rem;
}

/* Column headers */
.log-header-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 0.5rem;
  background: #252525;
  border-bottom: 1px solid #444;
  flex-shrink: 0;
}

.log-col-header {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  position: relative;
  border-right: 1px solid #444;
}

.log-col-header--message {
  flex: 1;
  border-right: none;
}

.header-label {
  font-size: 0.65rem;
  font-weight: 700;
  color: #888;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0 0.25rem;
}

/* Resizers */
.col-resizer {
  position: absolute;
  right: -3px;
  top: 0;
  bottom: 0;
  width: 6px;
  cursor: col-resize;
  background: transparent;
  z-index: 5;
}

.col-resizer:hover,
.col-resizer:active {
  background: #4a90d9;
}

/* Scroll area */
.log-scroll-area {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  height: 0; /* Force flex algorithm to compute height */
}

/* Log rows */
.log-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 0.5rem;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.75rem;
  color: #d4d4d4;
  border-bottom: 1px solid #2a2a2a;
}

.log-row--pinned {
  background: #2a3a2a;
  border-bottom: 2px solid #4a6a4a;
  flex-shrink: 0;
}

.log-row:hover {
  background: #2a2a2a;
}

/* Cells */
.log-cell {
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0 0.25rem;
  border-right: 1px solid transparent;
}

.log-cell:last-child {
  border-right: none;
}

.log-cell--message {
  flex: 1;
  padding: 0 0.25rem;
}

.log-level {
  font-weight: 600;
  text-transform: uppercase;
}

.log-cell--message :deep(mark) {
  background: #ffeb3b;
  color: #000;
  padding: 0 1px;
  border-radius: 2px;
}

/* Load more */
.load-more-container {
  display: flex;
  justify-content: center;
  padding: 0.75rem;
  background: #1e1e1e;
  border-top: 1px solid #2a2a2a;
  flex-shrink: 0;
}

.load-more-btn {
  padding: 0.5rem 1.5rem;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.15s;
}

.load-more-btn:hover:not(:disabled) {
  background: #3a7bc8;
}

.load-more-btn:disabled {
  background: #888;
  cursor: not-allowed;
}

.log-level--verbose { color: #999999; }
.log-level--debug { color: #377eb8; }
.log-level--info { color: #4daf4a; }
.log-level--warn { color: #ff7f00; }
.log-level--error { color: #e41a1c; }
.log-level--assert { color: #984ea3; }
</style>
