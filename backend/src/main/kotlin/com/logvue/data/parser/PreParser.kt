package com.logvue.data.parser

enum class ParserType {
    ANDROID_JSON,
    TEXT_LOG_DETAILED,    // With thread brackets: 00:46:47.548 [thread] LEVEL tag - message
    TEXT_LOG_SIMPLE,      // DD-MM HH:MM:SS L Tag Message
    TEXT_LOG_MONTH_NAME   // MMM-DD HH:MM:SS Tag Level Message
}

object PreParser {

    // Format 1: 00:46:47.548 [thread] LEVEL tag - message (detailed format with thread)
    private val textLogPatternDetailed = Regex(
        """^\d{2}:\d{2}:\d{2}\.\d{3}\s+\[[^\]]+\]\s+[A-Z_]+\s+.+\s+-\s+"""
    )

    // Format 2: DD-MM HH:MM:SS L Tag Message (e.g., 14-12 22:13:59 I Tag Message)
    private val textLogPatternSimple = Regex(
        """^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[A-Z]\s+[^\s]+\s+.*"""
    )

    // Format 3: MMM-DD HH:MM:SS Tag Level Message (e.g., Feb-03 22:13:59 Tag Info Message)
    private val textLogPatternMonthName = Regex(
        """^[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[^\s]+\s+[A-Za-z_]+\s+.*"""
    )

    fun detect(bytes: ByteArray): ParserType {
        val lines = bytes.toString(Charsets.UTF_8).lineSequence().take(101).toList()

        var jsonScore = 0
        var textScore = 0

        for (line in lines) {
            val trimmed = line.trim()

            // Skip empty lines
            if (trimmed.isEmpty()) continue

            // Check for JSON (line starting with { or [)
            if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
                jsonScore++
            }

            // Check for text log formats (timestamp patterns)
            if (textLogPatternDetailed.containsMatchIn(line) ||
                textLogPatternSimple.containsMatchIn(line) ||
                textLogPatternMonthName.containsMatchIn(line)
            ) {
                textScore++
            }
        }

        return when {
            textScore > 0 && textScore > jsonScore -> detectTextLogSubtype(bytes)
            jsonScore > 0 -> ParserType.ANDROID_JSON
            textScore > 0 -> detectTextLogSubtype(bytes)
            else -> throw IllegalArgumentException("Unable to detect log format. No recognizable lines found.")
        }
    }

    private fun detectTextLogSubtype(bytes: ByteArray): ParserType {
        val lines = bytes.toString(Charsets.UTF_8).lineSequence().take(101).toList()

        var detailedCount = 0
        var simpleCount = 0
        var monthNameCount = 0

        for (line in lines) {
            if (textLogPatternDetailed.containsMatchIn(line)) detailedCount++
            if (textLogPatternSimple.containsMatchIn(line)) simpleCount++
            if (textLogPatternMonthName.containsMatchIn(line)) monthNameCount++
        }

        // Return the most common text log format
        val maxCount = maxOf(detailedCount, simpleCount, monthNameCount)
        return when {
            maxCount == detailedCount -> ParserType.TEXT_LOG_DETAILED
            maxCount == simpleCount -> ParserType.TEXT_LOG_SIMPLE
            else -> ParserType.TEXT_LOG_MONTH_NAME
        }
    }
}