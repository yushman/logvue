package com.logvue.data.model

import kotlinx.serialization.Serializable

@Serializable
data class TimelineRequest(
    val fileId: String,
    val resolution: String = "sec"
)

@Serializable
data class TimelineResponse(
    val timeRange: TimeRange,
    val resolution: String,
    val buckets: List<TimelineBucket>,
    val tagColors: Map<String, String>
)

@Serializable
data class TimelineBucket(
    val timestamp: Long,
    val count: Int,
    val tags: Map<String, Int>
)

// TimeRange is already defined in LogFile.kt in the same package
