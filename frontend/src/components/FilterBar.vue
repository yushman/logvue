<script setup lang="ts">
import TextFilter from './TextFilter.vue'
import ContentFilter from './ContentFilter.vue'
import TimeRangePicker from './TimeRangePicker.vue'
</script>

<template>
    <div class="filter-bar">
        <TextFilter />
        <ContentFilter />
        <TimeRangePicker />
    </div>
</template>

<style scoped>
.filter-bar {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    padding: 0.5rem 1rem;
    background: #fafafa;
    border-bottom: 1px solid #ddd;
    flex-wrap: wrap;
}
</style>
