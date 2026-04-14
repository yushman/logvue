<script setup lang="ts">
import { useLogStore } from '../stores/logStore'

const logStore = useLogStore()

const LEVELS = ['VERBOSE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'ASSERT']

function isChecked(level: string): boolean {
  return logStore.filters.levels.includes(level)
}

function toggleLevel(level: string) {
  const current = logStore.filters.levels
  if (current.includes(level)) {
    logStore.setLevels(current.filter(l => l !== level))
  } else {
    logStore.setLevels([...current, level])
  }
}
</script>

<template>
  <div class="log-level-filter">
    <label
      v-for="level in LEVELS"
      :key="level"
      class="level-checkbox"
      :class="`level-checkbox--${level.toLowerCase()}`"
    >
      <input
        type="checkbox"
        :checked="isChecked(level)"
        @change="toggleLevel(level)"
      />
      <span class="level-label">{{ level }}</span>
    </label>
    <span class="entry-count-badge">
      {{ logStore.total }} / {{ logStore.metadata?.logCount }} entries
    </span>
  </div>
</template>

<style scoped>
.log-level-filter {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
  flex-wrap: wrap;
  align-items: center;
}

.entry-count-badge {
  font-size: 0.75rem;
  color: #666;
  white-space: nowrap;
  font-weight: 700;
  margin-left: auto;
  margin-right: 0.5rem;
}

.level-checkbox {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.level-checkbox:hover {
  background: rgba(0, 0, 0, 0.05);
}

.level-checkbox input {
  cursor: pointer;
}

.level-label {
  font-family: monospace;
  text-transform: uppercase;
}

.level-checkbox--verbose .level-label { color: #999999; }
.level-checkbox--debug .level-label { color: #377eb8; }
.level-checkbox--info .level-label { color: #4daf4a; }
.level-checkbox--warn .level-label { color: #ff7f00; }
.level-checkbox--error .level-label { color: #e41a1c; }
.level-checkbox--assert .level-label { color: #984ea3; }
</style>
