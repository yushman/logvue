package com.logvue.service

import com.logvue.data.model.*
import com.logvue.data.parser.LogParser
import com.logvue.data.parser.ParseResult
import java.util.concurrent.ConcurrentHashMap

class LogService(private val parser: LogParser) {

    private val logFiles = ConcurrentHashMap<String, ParseResult>()

    suspend fun uploadLogFile(bytes: ByteArray, fileName: String): LogUploadResponse {
        if (bytes.size > MAX_FILE_SIZE) {
            throw FileTooLargeException(bytes.size.toLong(), MAX_FILE_SIZE)
        }
        val result = parser.parse(bytes, fileName)

        val fileId = generateFileId()
        logFiles[fileId] = result

        return LogUploadResponse(
            fileId = fileId,
            logCount = result.metadata.logCount,
            deviceName = result.metadata.deviceName,
            timeRange = result.metadata.timeRange
        )
    }

    fun getLogFile(fileId: String): ParseResult? = logFiles[fileId]

    fun filterLogs(request: FilterRequest): FilterResponse {
        val parseResult = logFiles[request.fileId] ?: return FilterResponse(
            entries = emptyList(),
            total = 0,
            hasMore = false,
            searchHighlightRanges = emptyMap(),
            levelCounts = emptyMap(),
            tagCounts = emptyList()
        )

        var filtered = parseResult.entries.asSequence()

        // Filter by log level
        if (request.levels.isNotEmpty()) {
            filtered = filtered.filter { it.header.logLevel in request.levels }
        }

        // Filter by tag pattern (pipe-separated list means OR)
        if (request.tagPattern.isNotEmpty()) {
            val tags = request.tagPattern.split("|").filter { it.isNotEmpty() }
            filtered = if (request.tagRegex) {
                val regex = Regex(request.tagPattern, RegexOption.IGNORE_CASE)
                filtered.filter { it.header.tag?.let { tag -> regex.containsMatchIn(tag) } == true }
            } else {
                filtered.filter { entry ->
                    entry.header.tag?.let { tag ->
                        tags.any { tagPattern -> tag.contains(tagPattern, ignoreCase = true) }
                    } == true
                }
            }
        }

        // Filter by content
        if (request.contentFilter.isNotEmpty()) {
            filtered = filtered.filter { it.message.contains(request.contentFilter, ignoreCase = true) }
        }

        // Filter by time range
        request.timeFrom?.let { from ->
            filtered = filtered.filter { it.timestamp >= from }
        }
        request.timeTo?.let { to ->
            filtered = filtered.filter { it.timestamp <= to }
        }

        // Compute counts from all filtered entries (before pagination)
        val filteredList = filtered.toList()
        val total = filteredList.size

        val levelCounts = mutableMapOf<String, Int>()
        val tagCounts = mutableMapOf<String, Int>()
        filteredList.forEach { entry ->
            levelCounts[entry.header.logLevel] = levelCounts.getOrDefault(entry.header.logLevel, 0) + 1
            val tag = entry.header.tag ?: ""
            if (tag.isNotEmpty()) {
                tagCounts[tag] = tagCounts.getOrDefault(tag, 0) + 1
            }
        }

        val entries = filteredList
            .drop(request.offset)
            .take(request.limit)

        // Compute highlight ranges for searchQuery on current page entries
        val searchHighlightRanges = mutableMapOf<String, List<List<Int>>>()
        if (!request.searchQuery.isNullOrEmpty()) {
            entries.forEach { entry ->
                val ranges = mutableListOf<List<Int>>()
                var start = 0
                val message = entry.message
                while (true) {
                    val idx = message.indexOf(request.searchQuery, start, ignoreCase = true)
                    if (idx == -1) break
                    ranges.add(listOf(idx, idx + request.searchQuery.length))
                    start = idx + 1
                }
                if (ranges.isNotEmpty()) {
                    searchHighlightRanges[entry.id.toString()] = ranges
                }
            }
        }

        return FilterResponse(
            entries = entries.toList(),
            total = total,
            hasMore = request.offset + request.limit < total,
            searchHighlightRanges = searchHighlightRanges,
            levelCounts = levelCounts,
            tagCounts = tagCounts.map { TagCount(it.key, it.value) }.sortedByDescending { it.count }
        )
    }

    fun getTimeline(request: TimelineRequest): TimelineResponse {
        val parseResult = logFiles[request.fileId]
            ?: return TimelineResponse(TimeRange(0, 0), emptyList(), emptyMap())

        val entries = parseResult.entries
        if (entries.isEmpty()) {
            return TimelineResponse(parseResult.metadata.timeRange, emptyList(), emptyMap())
        }

        val globalTimeRange = parseResult.metadata.timeRange
        val numBuckets = request.numBuckets ?: 20

        val effectiveTimeRange = TimeRange(
            startTimestamp = request.timeFrom ?: globalTimeRange.startTimestamp,
            endTimestamp = request.timeTo ?: globalTimeRange.endTimestamp
        )

        val rangeStart = effectiveTimeRange.startTimestamp
        val rangeEnd = effectiveTimeRange.endTimestamp
        val rangeMs = rangeEnd - rangeStart

        val buckets = if (rangeMs <= 0) {
            emptyList()
        } else {
            val bucketSizeMsDouble = rangeMs.toDouble() / numBuckets
            val bucketMap = mutableMapOf<Int, MutableList<LogEntry>>()

            for (entry in entries) {
                if (entry.timestamp < rangeStart || entry.timestamp > rangeEnd) continue
                val bucketIndex =
                    ((entry.timestamp - rangeStart) / bucketSizeMsDouble).toInt().coerceIn(0, numBuckets - 1)
                bucketMap.getOrPut(bucketIndex) { mutableListOf() }.add(entry)
            }

            (0 until numBuckets).map { i ->
                val bucketEntries = bucketMap[i] ?: emptyList()
                val tagCounts = mutableMapOf<String, Int>()
                for (entry in bucketEntries) {
                    val tag = entry.header.tag ?: "(no tag)"
                    tagCounts[tag] = tagCounts.getOrDefault(tag, 0) + 1
                }
                TimelineBucket(
                    timestamp = rangeStart + (i * bucketSizeMsDouble).toLong(),
                    count = bucketEntries.size,
                    tags = tagCounts
                )
            }
        }

        // Build tag colors map (deterministic hash to palette)
        val allTags = buckets.flatMap { it.tags.keys }.toSet()
        val tagColors = allTags.associateWith { tag -> TAG_PALETTE[hashString(tag) % TAG_PALETTE.size] }

        return TimelineResponse(
            timeRange = effectiveTimeRange,
            buckets = buckets,
            tagColors = tagColors
        )
    }

    private fun generateFileId(): String = java.util.UUID.randomUUID().toString()

    fun getEntry(fileId: String, entryId: Int): LogEntry? {
        val parseResult = logFiles[fileId] ?: return null
        return parseResult.entries.find { it.id == entryId }
    }

    fun getMetadata(fileId: String): Map<String, String>? {
        val parseResult = logFiles[fileId] ?: return null
        val allTags = parseResult.entries.mapNotNull { it.header.tag }.toSet()
        return allTags.associateWith { tag -> TAG_PALETTE[hashString(tag) % TAG_PALETTE.size] }
    }

    companion object {
        const val MAX_FILE_SIZE = 500 * 1024 * 1024L // 500MB

        private val TAG_PALETTE = listOf(
            "#e41a1c", "#377eb8", "#4daf4a", "#984ea3",
            "#ff7f00", "#a65628", "#f781bf", "#999999",
            "#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3",
            "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3"
        )

        private fun hashString(str: String): Int {
            var hash = 0
            for (c in str) {
                hash = (hash * 31 + c.code) and 0x7FFFFFFF
            }
            return hash
        }
    }
}