package com.logvue.service

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
            logCount = result.metadata.logCount,
            deviceName = result.metadata.deviceName,
            timeRange = result.metadata.timeRange
        )
    }

    fun getLogFile(fileId: String): ParseResult? = logFiles[fileId]

    private fun generateFileId(): String = java.util.UUID.randomUUID().toString()
}