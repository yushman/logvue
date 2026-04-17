package com.logvue.data.parser

import com.logvue.data.model.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/**
 * Parser for simpler text log formats without thread brackets.
 *
 * Format 1: DD-MM HH:MM:SS L Tag Message (e.g., "14-12 22:13:59 I Tag Message")
 * Format 2: MMM-DD HH:MM:SS Tag Level Message (e.g., "Feb-03 22:13:59 Tag Info Message")
 */
class SimpleTextLogParser : LogParser {

    // Format: DD-MM HH:MM:SS L Tag Message
    private val patternSimple = Regex(
        """^(\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z])\s+([^\s]+)\s+(.*)$"""
    )

    // Format: MMM-DD HH:MM:SS Tag Level Message
    private val patternMonthName = Regex(
        """^([A-Za-z]{3}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([^\s]+)\s+([A-Za-z_]+)\s+(.*)$"""
    )

    private val levelMap = mapOf(
        "I" to "INFO", "INFO" to "INFO", "INFORMATION" to "INFO",
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
            val match = parseLine(line) ?: continue
            val (datePart, timePart, level, tag, message) = match

            val epochMillis = parseTimestamp(today, datePart, timePart)
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

    private fun parseLine(line: String): Tuple5<String, String, String, String, String>? {
        // Try format: DD-MM HH:MM:SS L Tag Message
        patternSimple.matchEntire(line)?.let { match ->
            return Tuple5(
                match.groupValues[1],
                match.groupValues[2],
                match.groupValues[3],
                match.groupValues[4],
                match.groupValues[5]
            )
        }

        // Try format: MMM-DD HH:MM:SS Tag Level Message
        patternMonthName.matchEntire(line)?.let { match ->
            // For this format, groups are: date, time, tag, level, message
            return Tuple5(
                match.groupValues[1],
                match.groupValues[2],
                match.groupValues[4],
                match.groupValues[3],
                match.groupValues[5]
            )
        }

        return null
    }

    private fun parseTimestamp(date: LocalDate, datePart: String, timePart: String): Long {
        val time = LocalTime.parse(timePart, DateTimeFormatter.ofPattern("HH:mm:ss"))

        // Try to extract month and day from datePart
        return try {
            val parts = datePart.split("-")
            if (parts.size == 2) {
                // Could be DD-MM or MMM-DD
                val first = parts[0]
                val second = parts[1]

                val month: Int
                val day: Int

                if (first.length == 3) {
                    // Format: MMM-DD (e.g., Feb-03)
                    month = parseMonth(first)
                    day = second.toInt()
                } else {
                    // Format: DD-MM (e.g., 14-12)
                    day = first.toInt()
                    month = second.toInt()
                }

                val parsedDate = LocalDate.of(date.year, month, day)
                parsedDate.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            } else {
                date.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            }
        } catch (e: Exception) {
            // Fallback: use today's date with the time
            date.atTime(time).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
        }
    }

    private fun parseMonth(monthStr: String): Int {
        val months = listOf(
            "Jan", "Feb", "Mar", "Apr", "May", "Jun",
            "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
        )
        return months.indexOf(monthStr).let { if (it >= 0) it + 1 else 1 }
    }
}

data class Tuple5<A, B, C, D, E>(val first: A, val second: B, val third: C, val fourth: D, val fifth: E)
