<script setup lang="ts">
import { computed, onMounted } from 'vue'
import FileDropzone from './components/FileDropzone.vue'
import LogLevelFilter from './components/LogLevelFilter.vue'
import FilterBar from './components/FilterBar.vue'
import LogList from './components/LogList.vue'
import { useLogStore } from './stores/logStore'

const logStore = useLogStore()

const showDropzone = computed(() => !logStore.metadata)

async function handleFileSelected(file: File) {
  await logStore.uploadLog(file)
}

onMounted(() => {
  // If we have persisted state (metadata exists but no entries), fetch logs
  if (logStore.metadata && logStore.fileId && logStore.entries.length === 0) {
    logStore.fetchFilteredLogs()
  }
})
</script>

<template>
  <div class="app">
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
</style>
