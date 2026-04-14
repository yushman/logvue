<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { computed, reactive, ref, onMounted, onUnmounted } from 'vue'
import { useLogStore } from '../stores/logStore'
import { getTagColor, getLogLevelColor } from '../utils/tagColors'
import type { LogEntry } from '../types/LogEntry'

const logStore = useLogStore()

const hoveredEntryId = ref<number | null>(null)
const scrollContainer = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportHeight = ref(0)

// Track scroll position for position-based sticky
function handleScroll(e: Event) {
  const target = e.target as HTMLElement
  scrollTop.value = target.scrollTop
}

function updateViewportHeight() {
  if (scrollContainer.value) {
    viewportHeight.value = scrollContainer.value.clientHeight
  }
}

onMounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.addEventListener('scroll', handleScroll)
    updateViewportHeight()
    window.addEventListener('resize', updateViewportHeight)
  }
})

onUnmounted(() => {
  if (scrollContainer.value) {
    scrollContainer.value.removeEventListener('scroll', handleScroll)
    window.removeEventListener('resize', updateViewportHeight)
  }
})

function clearFiltersAndRefetch() {
  logStore.resetFilters()
  logStore.fetchFilteredLogs()
}

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

// Computed set of pinned entry IDs for O(1) lookup
const pinnedIdsSet = computed(() => new Set(logStore.pinnedEntryIds))

function isPinned(entryId: number): boolean {
  return pinnedIdsSet.value.has(entryId)
}

function getStarIcon(entryId: number): string {
  return isPinned(entryId) ? '★' : '☆'
}

// Compute sticky pins - those that have been scrolled past the viewport top
// and have no visible neighbors
const stickyPinnedEntries = computed(() => {
  const pinnedIds = logStore.pinnedEntryIds
  if (pinnedIds.length === 0) return []

  const entries = logStore.entries
  const stickyPins: LogEntry[] = []
  const rowHeight = 28 // matching item-size in RecycleScroller

  for (const id of pinnedIds) {
    const entryIndex = entries.findIndex(e => e.id === id)
    if (entryIndex === -1) continue

    const entry = entries[entryIndex]
    const entryTop = entryIndex * rowHeight
    const entryBottom = entryTop + rowHeight

    // If entry top is above viewport top (scrolled past), it could be sticky
    if (entryTop < scrollTop.value) {
      // Check if entry would be visible if we scrolled back
      const entryBottomInViewport = entryBottom <= scrollTop.value + viewportHeight.value
      const prevEntry = entryIndex > 0 ? entries[entryIndex - 1] : null
      const nextEntry = entryIndex < entries.length - 1 ? entries[entryIndex + 1] : null

      // Sticky if entry bottom is below viewport top AND both neighbors are not visible
      const prevVisible = prevEntry
        ? (entryIndex - 1) * rowHeight >= scrollTop.value
        : false
      const nextVisible = nextEntry
        ? (entryIndex + 1) * rowHeight <= scrollTop.value + viewportHeight.value
        : false

      // If this pin has been scrolled past AND its neighbors are not in view, make it sticky
      if (entryBottomInViewport && !prevVisible && !nextVisible) {
        stickyPins.push(entry)
      }
    }
  }

  // Sort sticky pins by their original position in the list
  return stickyPins.sort((a, b) => {
    return entries.findIndex(e => e.id === a.id) - entries.findIndex(e => e.id === b.id)
  })
})

// Items to render in virtual scroller, excluding sticky pins
const virtualItems = computed(() => {
  const stickyIds = new Set(stickyPinnedEntries.value.map(e => e.id))
  return logStore.entries.filter(e => !stickyIds.has(e.id))
})

// Column resizing
const columnWidths = reactive({
  pin: 36,
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
      <div class="log-col-header log-col-header--pin" :style="{ width: columnWidths.pin + 'px' }">
        <span class="header-label">PIN</span>
        <div class="col-resizer" @mousedown="startDrag('pin', $event)"></div>
      </div>
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

    <!-- Sticky pinned entries -->
    <div v-if="stickyPinnedEntries.length > 0" class="sticky-pins-container">
      <div
        v-for="item in stickyPinnedEntries"
        :key="'sticky-' + item.id"
        class="log-row log-row--pinned"
      >
        <div class="log-cell log-cell--pin" :style="{ width: columnWidths.pin + 'px' }">
          <button
            class="pin-btn pin-btn--active"
            @click.stop="logStore.togglePin(item.id)"
            title="Unpin"
          >
            ★
          </button>
        </div>
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
    </div>

    <!-- Scrolling log entries -->
    <div class="log-scroll-area" ref="scrollContainer">
      <RecycleScroller
        v-if="virtualItems.length > 0"
        class="virtual-scroller"
        :items="virtualItems"
        :item-size="28"
        key-field="id"
        v-slot="{ item }: { item: LogEntry }"
      >
        <div
          class="log-row"
          :class="{ 'log-row--pinned': isPinned(item.id) }"
          @mouseenter="hoveredEntryId = item.id"
          @mouseleave="hoveredEntryId = null"
        >
          <!-- Pin column -->
          <div class="log-cell log-cell--pin" :style="{ width: columnWidths.pin + 'px' }">
            <button
              class="pin-btn"
              :class="{ 'pin-btn--active': isPinned(item.id) }"
              @click.stop="logStore.togglePin(item.id)"
              :title="isPinned(item.id) ? 'Unpin' : 'Pin this row'"
            >
              {{ getStarIcon(item.id) }}
            </button>
          </div>
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
        <span>No log entries match your filters</span>
        <button class="clear-filters-btn" @click="clearFiltersAndRefetch">Clear filters</button>
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
  min-height: 0;
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

.log-col-header--pin {
  justify-content: center;
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
  height: 400px;
  background: #2a2a2a;
}

.virtual-scroller {
  height: 100%;
  display: block;
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
  border-bottom: 1px solid #3a5a3a;
}

.log-row:hover {
  background: #2a2a2a;
}

.log-row--pinned:hover {
  background: #3a4a3a;
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

.log-cell--pin {
  display: flex;
  align-items: center;
  justify-content: center;
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

/* Pin button */
.pin-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 0.9rem;
  color: #666;
  padding: 2px 4px;
  border-radius: 2px;
  transition: color 0.15s, transform 0.15s;
  line-height: 1;
}

.pin-btn:hover {
  color: #ffeb3b;
  transform: scale(1.1);
}

.pin-btn--active {
  color: #ffeb3b;
}

.pin-btn--active:hover {
  color: #ffc107;
}

/* Sticky pins container */
.sticky-pins-container {
  flex-shrink: 0;
  background: #1e1e1e;
  border-bottom: 2px solid #4a6a4a;
  max-height: 140px;
  overflow-y: auto;
  min-height: 0;
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

.clear-filters-btn {
  margin-left: 1rem;
  padding: 0.4rem 1rem;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.15s;
}

.clear-filters-btn:hover {
  background: #3a7bc8;
}
</style>
