package com.logvue.data.parser

import com.logvue.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

class TextLogParser : LogParser {

    private val lineRegex = Regex(
        """^(\d{2}:\d{2}:\d{2}\.\d{3})\s+\[([^\]]+)\]\s+([A-Z]+)\s+([^\s-]+)\s+-\s+(.*)$"""
    )

    private val levelMap = mapOf(
        "I" to "INFO", "INFO" to "INFO", "INFO" to "INFO", "INFORMATION" to "INFO",
        "W" to "WARN", "WARN" to "WARN", "WARNING" to "WARN",
        "E" to "ERROR", "ERROR" to "ERROR", "ERR" to "ERROR",
        "D" to "DEBUG", "DEBUG" to "DEBUG", "DBG" to "DEBUG",
        "V" to "VERBOSE", "VERBOSE" to "VERBOSE", "TRACE" to "VERBOSE",
        "A" to "ASSERT", "ASSERT" to "ASSERT", "FATAL" to "ASSERT"
    )

    override suspend fun parse(bytes: ByteArray, fileName: String): ParseResult = withContext(Dispatchers.IO) {
        val lines = bytes.toString(Charsets.UTF_8).lineSequence()
        val today = LocalDate.now()
        val parsedEntries = mutableListOf<LogEntry>()
        var id = 0

        for (line in lines) {
            val match = lineRegex.matchEntire(line) ?: continue
            val (timeStr, threadName, level, tag, message) = match.destructured

            val epochMillis = parseTimestamp(today, timeStr)
            val seconds = epochMillis / 1000
            val nanos = ((epochMillis % 1000) * 1_000_000).toInt()

            parsedEntries.add(
                LogEntry(
                    id = id++,
                    header = LogHeader(
                        logLevel = levelMap[level.uppercase()] ?: level.uppercase(),
                        pid = 0,
                        tid = 0,
                        tag = tag,
                        threadName = threadName,
                        timestamp = Timestamp(seconds, nanos)
                    ),
                    message = message,
                    timestamp = epochMillis
                )
            )
        }

        if (parsedEntries.isEmpty()) {
            throw IllegalArgumentException("No parseable log entries found in file")
        }

        val startTs = parsedEntries.minOf { it.timestamp }
        val endTs = parsedEntries.maxOf { it.timestamp }

        val metadata = LogFileMetadata(
            deviceName = fileName,
            logCount = parsedEntries.size,
            timeRange = TimeRange(startTimestamp = startTs, endTimestamp = endTs)
        )

        ParseResult(metadata, parsedEntries)
    }

    private fun parseTimestamp(date: LocalDate, timeStr: String): Long {
        val time = LocalTime.parse(timeStr, DateTimeFormatter.ofPattern("HH:mm:ss.SSS"))
        return date.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
    }
}