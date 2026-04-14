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