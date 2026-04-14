<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'

const props = defineProps<{
  message: string
  type: 'error' | 'warning' | 'info'
}>()

const emit = defineEmits<{
  dismiss: []
}>()

const visible = ref(true)
let timeoutId: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  timeoutId = setTimeout(() => {
    visible.value = false
    emit('dismiss')
  }, 5000)
})

onUnmounted(() => {
  if (timeoutId) clearTimeout(timeoutId)
})

function dismiss() {
  visible.value = false
  if (timeoutId) clearTimeout(timeoutId)
  emit('dismiss')
}
</script>

<template>
  <Transition name="toast">
    <div v-if="visible" class="error-toast" :class="'toast-' + type">
      <span class="toast-message">{{ message }}</span>
      <button class="toast-dismiss" @click="dismiss">✕</button>
    </div>
  </Transition>
</template>

<style scoped>
.error-toast {
  position: fixed;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  z-index: 1000;
  max-width: 400px;
  font-size: 0.875rem;
}

.toast-error {
  background: #d32f2f;
  color: white;
}

.toast-warning {
  background: #f57c00;
  color: white;
}

.toast-info {
  background: #1976d2;
  color: white;
}

.toast-message {
  flex: 1;
}

.toast-dismiss {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  font-size: 0.75rem;
  padding: 0.25rem;
  opacity: 0.7;
  transition: opacity 0.15s;
}

.toast-dismiss:hover {
  opacity: 1;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
</style>
