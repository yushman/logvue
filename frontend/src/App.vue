<script setup lang="ts">
import { ref } from 'vue'
import FileDropzone from './components/FileDropzone.vue'
import { useLogStore } from './stores/logStore'

const logStore = useLogStore()
const showDropzone = ref(true)

async function handleFileSelected(file: File) {
  await logStore.uploadLog(file)
  showDropzone.value = false
}
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

      <div v-else class="log-info">
        <h2>Log File Loaded</h2>
        <p>Device: {{ logStore.metadata?.deviceName }}</p>
        <p>Log entries: {{ logStore.metadata?.logCount }}</p>
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
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.log-info {
  text-align: center;
}
</style>