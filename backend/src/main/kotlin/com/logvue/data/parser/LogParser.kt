package com.logvue.data.parser

import com.logvue.data.model.LogEntry
import com.logvue.data.model.LogFileMetadata

interface LogParser {
    suspend fun parse(bytes: ByteArray, fileName: String): ParseResult
}

data class ParseResult(
    val metadata: LogFileMetadata,
    val entries: List<LogEntry>
)
