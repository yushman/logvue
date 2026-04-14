<script setup lang="ts">
const props = defineProps<{
    modelValue: 'sec' | 'min' | 'hour'
}>()

const emit = defineEmits<{
    (e: 'update:modelValue', value: 'sec' | 'min' | 'hour'): void
}>()

function select(res: 'sec' | 'min' | 'hour') {
    emit('update:modelValue', res)
}
</script>

<template>
    <div class="resolution-selector">
        <label class="resolution-label">Resolution:</label>
        <div class="resolution-options">
            <button
                type="button"
                class="resolution-btn"
                :class="{ active: modelValue === 'sec' }"
                @click="select('sec')"
            >
                Sec
            </button>
            <button
                type="button"
                class="resolution-btn"
                :class="{ active: modelValue === 'min' }"
                @click="select('min')"
            >
                Min
            </button>
            <button
                type="button"
                class="resolution-btn"
                :class="{ active: modelValue === 'hour' }"
                @click="select('hour')"
            >
                Hour
            </button>
        </div>
    </div>
</template>

<style scoped>
.resolution-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.resolution-label {
    font-size: 0.8rem;
    color: #666;
    font-weight: 500;
}

.resolution-options {
    display: flex;
    gap: 0.25rem;
}

.resolution-btn {
    padding: 0.2rem 0.5rem;
    font-size: 0.75rem;
    border: 1px solid #ccc;
    background: #fff;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;
}

.resolution-btn:hover {
    background: #f0f0f0;
}

.resolution-btn.active {
    background: #4a90d9;
    color: white;
    border-color: #4a90d9;
}
</style>
