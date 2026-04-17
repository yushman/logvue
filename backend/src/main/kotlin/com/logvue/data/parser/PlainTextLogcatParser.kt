package com.logvue.data.parser

import com.logvue.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

/**
 * Parser for plain Android logcat text output.
 *
 * Format: MM-DD HH:MM:SS.mmm PID TID L Tag: Message
 * Example:
 *   04-09 11:59:46.133  1184  1680 D ConnectivityService: sending notification...
 *   --------- beginning of system
 */
class PlainTextLogcatParser : LogParser {

    // Pattern: MM-DD HH:MM:SS.mmm PID TID L Tag: Message
    // Example: 04-09 11:59:46.133  1184  1680 D ConnectivityService: sending notification
    private val logLinePattern = Regex(
        """^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+(\d+)\s+(\d+)\s+([A-Z])\s+([^:\s]+):\s*(.*)$"""
    )

    private val levelMap = mapOf(
        "D" to "DEBUG",
        "I" to "INFO",
        "W" to "WARN",
        "E" to "ERROR",
        "V" to "VERBOSE",
        "A" to "ASSERT"
    )

    private val sectionMarkerPattern = Regex("""^-+.*$""")

    override suspend fun parse(bytes: ByteArray, fileName: String): ParseResult = withContext(Dispatchers.IO) {
        val lines = bytes.toString(Charsets.UTF_8).lineSequence()
        val today = LocalDate.now()
        val parsedEntries = mutableListOf<LogEntry>()
        var id = 0

        for (line in lines) {
            // Skip section markers like "--------- beginning of system"
            if (sectionMarkerPattern.matches(line.trim())) {
                continue
            }

            val match = logLinePattern.matchEntire(line) ?: continue

            val month = match.groupValues[1].toInt()
            val day = match.groupValues[2].toInt()
            val hour = match.groupValues[3].toInt()
            val minute = match.groupValues[4].toInt()
            val second = match.groupValues[5].toInt()
            val millis = match.groupValues[6].toInt()
            val pid = match.groupValues[7].toInt()
            val tid = match.groupValues[8].toInt()
            val level = match.groupValues[9]
            val tag = match.groupValues[10]
            val message = match.groupValues[11]

            val epochMillis = parseTimestamp(today, month, day, hour, minute, second, millis)
            val seconds = epochMillis / 1000
            val nanos = (millis * 1_000_000)

            parsedEntries.add(
                LogEntry(
                    id = id++,
                    header = LogHeader(
                        logLevel = levelMap[level] ?: level,
                        pid = pid,
                        tid = tid,
                        tag = tag,
                        threadName = null,
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

    private fun parseTimestamp(
        today: LocalDate,
        month: Int,
        day: Int,
        hour: Int,
        minute: Int,
        second: Int,
        millis: Int
    ): Long {
        return try {
            // Use current year, but infer month/day from the log
            // If the month/day seems to be in the future, assume it's from last year
            var year = today.year
            var parsedDate = LocalDate.of(year, month, day)

            // If the date is in the future, assume it's from last year
            if (parsedDate.isAfter(today)) {
                parsedDate = LocalDate.of(year - 1, month, day)
            }

            val time = LocalTime.of(hour, minute, second, millis * 1_000_000)
            parsedDate.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        } catch (e: Exception) {
            // Fallback: use today's date
            val time = LocalTime.of(hour, minute, second, millis * 1_000_000)
            today.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        }
    }
}