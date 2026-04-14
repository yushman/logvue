<script setup lang="ts">
import {ref, watch} from 'vue'
import {useLogStore} from '../stores/logStore'

const logStore = useLogStore()

const localPattern = ref(logStore.filters.tagPattern)
const isRegex = ref(logStore.filters.tagRegex)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function emitUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
        logStore.setTagPattern(localPattern.value, isRegex.value)
    }, 300)
}

watch(localPattern, emitUpdate)
watch(isRegex, () => {
    logStore.setTagPattern(localPattern.value, isRegex.value)
})
</script>

<template>
    <div class="text-filter">
        <label class="filter-label">
            Tag:
            <input
                v-model="localPattern"
                type="text"
                class="filter-input"
                placeholder="filter tag..."
            />
        </label>
        <label class="regex-toggle">
            <input
                v-model="isRegex"
                type="checkbox"
            />
            <span>Regex</span>
        </label>
    </div>
</template>

<style scoped>
.text-filter {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.filter-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.8rem;
    color: #666;
}

.filter-input {
    padding: 0.25rem 0.5rem;
    border: 1px solid #ccc;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: monospace;
    width: 120px;
}

.regex-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: #666;
    cursor: pointer;
    white-space: nowrap;
}

.regex-toggle input {
    cursor: pointer;
}
</style>
