package com.logvue.data.parser

import com.logvue.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*

class AndroidLogcatParser : LogParser {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
    }

    override suspend fun parse(bytes: ByteArray, fileName: String): ParseResult = withContext(Dispatchers.IO) {
        val text = bytes.toString(Charsets.UTF_8)
        val jsonTree = json.parseToJsonElement(text)

        val logWrapper = jsonTree.jsonObject["log"]?.jsonObject
            ?: throw IllegalArgumentException("Invalid log format: missing 'log' object")

        val eventsArray = logWrapper["event"]?.jsonArray ?: emptyList()

        val entries = eventsArray.mapIndexed { index, element ->
            parseEvent(element.jsonObject, index)
        }

        val metadata = extractMetadata(logWrapper, entries)

        ParseResult(metadata, entries)
    }

    private fun parseEvent(obj: JsonObject, id: Int): LogEntry {
        val headerObj = obj["header"]?.jsonObject
        val timestampObj = headerObj?.get("timestamp")?.jsonObject

        val seconds = timestampObj?.get("seconds")?.jsonPrimitive?.longOrNull ?: 0L
        val nanos = timestampObj?.get("nanos")?.jsonPrimitive?.intOrNull ?: 0
        val timestamp = seconds * 1000 + nanos / 1_000_000

        return LogEntry(
            id = id,
            header = LogHeader(
                logLevel = headerObj?.get("logLevel")?.jsonPrimitive?.content ?: "INFO",
                pid = headerObj?.get("pid")?.jsonPrimitive?.intOrNull ?: 0,
                tid = headerObj?.get("tid")?.jsonPrimitive?.intOrNull ?: 0,
                applicationId = headerObj?.get("applicationId")?.jsonPrimitive?.contentOrNull,
                processName = headerObj?.get("processName")?.jsonPrimitive?.contentOrNull,
                tag = headerObj?.get("tag")?.jsonPrimitive?.contentOrNull,
                timestamp = Timestamp(seconds, nanos)
            ),
            message = obj["message"]?.jsonPrimitive?.content ?: "",
            timestamp = timestamp
        )
    }

    private fun extractMetadata(logWrapper: JsonObject, entries: List<LogEntry>): LogFileMetadata {
        val deviceObj = logWrapper["device"]?.jsonObject

        val startTs = entries.minOfOrNull { it.timestamp } ?: 0L
        val endTs = entries.maxOfOrNull { it.timestamp } ?: System.currentTimeMillis()

        return LogFileMetadata(
            deviceName = deviceObj?.get("name")?.jsonPrimitive?.content ?: "Unknown Device",
            avdPath = deviceObj?.get("avdPath")?.jsonPrimitive?.contentOrNull,
            release = deviceObj?.get("release")?.jsonPrimitive?.contentOrNull,
            apiLevel = deviceObj?.get("apiLevel")?.jsonPrimitive?.intOrNull,
            applicationIds = logWrapper["applicationId"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList(),
            filter = logWrapper["filter"]?.jsonPrimitive?.contentOrNull,
            logCount = entries.size,
            timeRange = TimeRange(startTimestamp = startTs, endTimestamp = endTs)
        )
    }
}