<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  'file-selected': [file: File]
}>()

const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function handleDragOver(event: DragEvent) {
  event.preventDefault()
  isDragging.value = true
}

function handleDragLeave() {
  isDragging.value = false
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  isDragging.value = false

  const files = event.dataTransfer?.files
  if (files && files.length > 0) {
    emit('file-selected', files[0])
  }
}

function handleClick() {
  fileInput.value?.click()
}

function handleFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = target.files
  if (files && files.length > 0) {
    emit('file-selected', files[0])
  }
}
</script>

<template>
  <div
    class="dropzone"
    :class="{ 'dropzone--dragging': isDragging }"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @click="handleClick"
  >
    <input
      ref="fileInput"
      type="file"
      accept="text/*"
      class="dropzone-input"
      @change="handleFileChange"
    />

    <div class="dropzone-content">
      <svg class="dropzone-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>

      <p class="dropzone-text">
        Drag and drop a log JSON file here, or click to select
      </p>

      <p class="dropzone-hint">
        Supports Android logcat JSON exports
      </p>
    </div>
  </div>
</template>

<style scoped>
.dropzone {
  width: 100%;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
  margin-top: auto;
  margin-bottom: auto;
  padding: 4rem 2rem;
  border: 2px dashed #ccc;
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  text-align: center;
}

.dropzone:hover,
.dropzone--dragging {
  border-color: #4a90d9;
  background-color: rgba(74, 144, 217, 0.05);
}

.dropzone-input {
  display: none;
}

.dropzone-icon {
  width: 48px;
  height: 48px;
  color: #999;
  margin-bottom: 1rem;
}

.dropzone-text {
  font-size: 1.1rem;
  color: #333;
  margin: 0 0 0.5rem 0;
}

.dropzone-hint {
  font-size: 0.875rem;
  color: #666;
  margin: 0;
}
</style>