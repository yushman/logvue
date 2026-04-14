<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import FileDropzone from './components/FileDropzone.vue'
import LogLevelFilter from './components/LogLevelFilter.vue'
import FilterBar from './components/FilterBar.vue'
import LogList from './components/LogList.vue'
import ResolutionSelector from './components/ResolutionSelector.vue'
import Timeline from './components/Timeline.vue'
import ErrorDisplay from './components/ErrorDisplay.vue'
import { useLogStore } from './stores/logStore'

const logStore = useLogStore()

const showDropzone = computed(() => !logStore.metadata)
const errorMessage = ref<string | null>(null)
const errorType = ref<'error' | 'warning' | 'info'>('error')

watch(() => logStore.error, (newError) => {
  if (newError) {
    errorMessage.value = newError
    errorType.value = 'error'
  }
})

async function handleFileSelected(file: File) {
  await logStore.uploadLog(file)
  await logStore.loadTimeline(logStore.resolution)
}

function handleRangeSelect(range: { from: number; to: number } | null) {
  logStore.setSelectedRange(range)
}

function handleResolutionChange(res: 'sec' | 'min' | 'hour') {
  logStore.loadTimeline(res)
}

function dismissError() {
  errorMessage.value = null
  logStore.error = null
}

onMounted(() => {
  // If we have persisted state (metadata exists but no entries), fetch logs
  if (logStore.metadata && logStore.fileId && logStore.entries.length === 0) {
    logStore.fetchFilteredLogs()
    logStore.loadTimeline(logStore.resolution)
  }
})
</script>

<template>
  <div class="app">
    <ErrorDisplay
      v-if="errorMessage"
      :message="errorMessage"
      :type="errorType"
      @dismiss="dismissError"
    />
    <main class="app-main">
      <FileDropzone
        v-if="showDropzone"
        @file-selected="handleFileSelected"
      />

      <div v-else class="log-view">
        <div class="log-header">
          <div class="log-meta">
            <span class="app-name">LogVue</span>
            <span class="separator">|</span>
            <span class="device-name">{{ logStore.metadata?.deviceName }}</span>
          </div>
          <button class="clear-btn" @click="logStore.clearLog()">
            Load New File
          </button>
        </div>
        <LogLevelFilter />
        <FilterBar />
        <div class="timeline-container">
            <ResolutionSelector
                v-model="logStore.resolution"
                @update:modelValue="handleResolutionChange"
            />
            <Timeline
                v-if="logStore.metadata?.timeRange"
                :buckets="logStore.buckets"
                :tagColors="logStore.tagColors"
                :timeRange="logStore.metadata.timeRange"
                :selectedRange="logStore.selectedRange"
                :resolution="logStore.resolution"
                @range-select="handleRangeSelect"
            />
        </div>
        <LogList />
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.log-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.app-name {
  font-weight: 700;
  color: #333;
  font-size: 1.1rem;
}

.separator {
  color: #ccc;
  font-size: 0.9rem;
}

.device-name {
  font-weight: 500;
  color: #666;
  font-size: 0.85rem;
}

.clear-btn {
  padding: 0.3rem 0.7rem;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
  transition: background-color 0.15s;
}

.clear-btn:hover {
  background: #3a7bc8;
}

.timeline-container {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid #ddd;
  background: #fff;
}

.timeline-container > :first-child {
  padding: 0.3rem 1rem;
  border-bottom: 1px solid #eee;
}
</style>
