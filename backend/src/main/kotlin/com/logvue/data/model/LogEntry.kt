package com.logvue.data.model

import kotlinx.serialization.Serializable

@Serializable
data class LogEntry(
    val id: Int,
    val header: LogHeader,
    val message: String,
    val timestamp: Long
)

@Serializable
data class LogHeader(
    val logLevel: String,
    val pid: Int,
    val tid: Int,
    val applicationId: String? = null,
    val processName: String? = null,
    val tag: String? = null,
    val timestamp: Timestamp
)

@Serializable
data class Timestamp(
    val seconds: Long,
    val nanos: Int
)

@Serializable
data class FilterRequest(
    val fileId: String,
    val levels: List<String> = emptyList(),
    val tagPattern: String = "",
    val tagRegex: Boolean = false,
    val contentFilter: String = "",
    val searchQuery: String? = null,
    val searchCaseSensitive: Boolean = false,
    val searchRegex: Boolean = false,
    val timeFrom: Long? = null,
    val timeTo: Long? = null,
    val hiddenTags: String = "",
    val offset: Int = 0,
    val limit: Int = 200
)

@Serializable
data class FilterResponse(
    val entries: List<LogEntry>,
    val total: Int,
    val hasMore: Boolean,
    val searchHighlightRanges: Map<String, List<List<Int>>> = emptyMap(),
    val levelCounts: Map<String, Int> = emptyMap(),
    val tagCounts: List<TagCount> = emptyList()
)

@Serializable
data class TagCount(
    val tag: String,
    val count: Int
)