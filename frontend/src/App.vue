<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import FileDropzone from './components/FileDropzone.vue'
import LogLevelFilter from './components/LogLevelFilter.vue'
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
    <header class="app-header">
      <h1>LogVue</h1>
    </header>

    <main class="app-main">
      <FileDropzone
        v-if="showDropzone"
        @file-selected="handleFileSelected"
      />

      <div v-else class="log-view">
        <div class="log-header">
          <div class="log-meta">
            <span class="device-name">{{ logStore.metadata?.deviceName }}</span>
            <span class="entry-count">{{ logStore.total }} / {{ logStore.metadata?.logCount }} entries</span>
          </div>
          <button class="clear-btn" @click="logStore.clearLog()">
            Load New File
          </button>
        </div>
        <LogLevelFilter />
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

.app-header {
  background: #1a1a2e;
  color: white;
  padding: 1rem 2rem;
}

.app-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
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
  padding: 0.75rem 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.log-meta {
  display: flex;
  gap: 1.5rem;
  align-items: center;
}

.device-name {
  font-weight: 600;
  color: #333;
}

.entry-count {
  font-size: 0.875rem;
  color: #666;
}

.clear-btn {
  padding: 0.4rem 0.8rem;
  background: #4a90d9;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.8rem;
  transition: background-color 0.15s;
}

.clear-btn:hover {
  background: #3a7bc8;
}
</style>
