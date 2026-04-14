package com.logvue.service

import com.logvue.data.model.FilterRequest
import com.logvue.data.model.FilterResponse
import com.logvue.data.model.LogUploadResponse
import com.logvue.data.parser.LogParser
import com.logvue.data.parser.ParseResult
import java.util.concurrent.ConcurrentHashMap

class LogService(private val parser: LogParser) {

    private val logFiles = ConcurrentHashMap<String, ParseResult>()

    suspend fun uploadLogFile(bytes: ByteArray, fileName: String): LogUploadResponse {
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
        val parseResult = logFiles[request.fileId] ?: return FilterResponse(emptyList(), 0, false)

        var filtered = parseResult.entries.asSequence()

        // Filter by log level
        if (request.levels.isNotEmpty()) {
            filtered = filtered.filter { it.header.logLevel in request.levels }
        }

        // Filter by tag pattern
        if (request.tagPattern.isNotEmpty()) {
            filtered = if (request.tagRegex) {
                val regex = Regex(request.tagPattern, RegexOption.IGNORE_CASE)
                filtered.filter { it.header.tag?.let { tag -> regex.containsMatchIn(tag) } == true }
            } else {
                filtered.filter { it.header.tag?.contains(request.tagPattern, ignoreCase = true) == true }
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

        val total = filtered.count()
        val entries = filtered
            .drop(request.offset)
            .take(request.limit)
            .toList()

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
            entries = entries,
            total = total,
            hasMore = request.offset + request.limit < total,
            searchHighlightRanges = searchHighlightRanges
        )
    }

    private fun generateFileId(): String = java.util.UUID.randomUUID().toString()
}