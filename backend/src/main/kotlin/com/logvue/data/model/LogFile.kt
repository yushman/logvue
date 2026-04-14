package com.logvue.data.model

import kotlinx.serialization.Serializable

@Serializable
data class LogFileMetadata(
    val deviceName: String,
    val avdPath: String? = null,
    val release: String? = null,
    val apiLevel: Int? = null,
    val applicationIds: List<String> = emptyList(),
    val filter: String? = null,
    val logCount: Int,
    val timeRange: TimeRange
)

@Serializable
data class TimeRange(
    val startTimestamp: Long,
    val endTimestamp: Long
)

@Serializable
data class LogUploadResponse(
    val fileId: String,
    val logCount: Int,
    val deviceName: String,
    val timeRange: TimeRange
)