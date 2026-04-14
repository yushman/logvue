<script setup lang="ts">
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
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

function getLevelClass(level: string): string {
  return `log-level--${level.toLowerCase()}`
}
</script>

<template>
  <div class="log-list">
    <div v-if="logStore.isLoading && logStore.entries.length === 0" class="log-list-empty">
      Loading...
    </div>
    <div v-else-if="logStore.entries.length === 0" class="log-list-empty">
      No log entries match your filters
    </div>
    <RecycleScroller
      v-else
      :items="logStore.entries"
      :item-size="28"
      key-field="id"
      v-slot="{ item }: { item: LogEntry }"
      class="log-scroller"
    >
      <div class="log-row">
        <span
          class="log-level"
          :class="getLevelClass(item.header.logLevel)"
          :style="{ color: getLogLevelColor(item.header.logLevel) }"
        >
          {{ item.header.logLevel }}
        </span>
        <span class="log-time">{{ formatTime(item.timestamp) }}</span>
        <span
          class="log-tag"
          :style="{ color: getTagColor(item.header.tag || '') }"
        >
          {{ item.header.tag || '---' }}
        </span>
        <span class="log-message">{{ item.message }}</span>
      </div>
    </RecycleScroller>
  </div>
</template>

<style scoped>
.log-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #1e1e1e;
}

.log-list-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  font-size: 1rem;
}

.log-scroller {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.log-row {
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 1rem;
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.75rem;
  color: #d4d4d4;
  border-bottom: 1px solid #2a2a2a;
}

.log-row:hover {
  background: #2a2a2a;
}

.log-level {
  width: 60px;
  font-weight: 600;
  flex-shrink: 0;
}

.log-time {
  width: 90px;
  color: #888;
  flex-shrink: 0;
}

.log-tag {
  width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.log-message {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.log-level--verbose { color: #999999; }
.log-level--debug { color: #377eb8; }
.log-level--info { color: #4daf4a; }
.log-level--warn { color: #ff7f00; }
.log-level--error { color: #e41a1c; }
.log-level--assert { color: #984ea3; }
</style>
