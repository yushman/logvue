<script setup lang="ts">
import {ref, computed} from 'vue'
import {useLogStore} from '../stores/logStore'

const logStore = useLogStore()

const localFilter = ref(logStore.filters.contentFilter)

function applyFilter() {
    logStore.setContentFilter(localFilter.value)
    if (localFilter.value.trim()) {
        logStore.setSearchQuery(localFilter.value)
    }
}

function clearFilter() {
    localFilter.value = ''
    logStore.setContentFilter('')
    logStore.clearSearch()
}

const matchText = computed(() => {
    if (!logStore.filters.searchQuery) return ''
    const total = logStore.total
    const shown = logStore.entries.length
    const hasMore = logStore.hasMore
    return hasMore ? `1-${shown} of ${total}` : `${total}`
})
</script>

<template>
    <div class="content-filter">
        <label class="filter-label">
            Content:
            <input
                v-model="localFilter"
                type="text"
                class="filter-input"
                placeholder="filter content..."
                @keyup.enter="applyFilter"
            />
        </label>
        <button class="filter-btn search-btn" @click="applyFilter">Search</button>
        <button class="filter-btn clear-btn" @click="clearFilter">Clear</button>
        <span v-if="logStore.filters.searchQuery" class="match-counter">
            {{ matchText }} matches
        </span>
    </div>
</template>

<style scoped>
.content-filter {
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
    width: 140px;
}

.filter-btn {
    padding: 0.25rem 0.5rem;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.15s;
}

.search-btn {
    background: #4a90d9;
    color: white;
}

.search-btn:hover {
    background: #3a7bc8;
}

.clear-btn {
    background: #e0e0e0;
    color: #333;
}

.clear-btn:hover {
    background: #d0d0d0;
}

.match-counter {
    font-size: 0.7rem;
    color: #888;
    white-space: nowrap;
}
</style>
