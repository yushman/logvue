package com.logvue.data.parser

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test

class PreParserTest {

    // ========== Detailed format tests (with thread brackets) ==========

    @Test
    fun `detect returns TEXT_LOG_DETAILED for formatted text log lines`() {
        val textLog = buildString {
            appendLine("00:46:47.548 [DefaultDispatcher-worker-2] INFO  ktor.application - Autoreload is disabled")
            appendLine("00:46:47.578 [DefaultDispatcher-worker-2] INFO  ktor.application - Application started in 0.04 seconds")
            appendLine("00:46:48.512 [DefaultDispatcher-worker-1] INFO  ktor.application - 200 OK: GET - /health")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_DETAILED, result)
    }

    @Test
    fun `detect returns TEXT_LOG_DETAILED for detailed format with thread`() {
        val textLog = buildString {
            appendLine("00:46:47.548 [worker-1] DEBUG MyApp - Processing request")
            appendLine("00:46:47.549 [worker-2] WARN MyApp - Connection slow")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_DETAILED, result)
    }

    // ========== Simple format tests (DD-MM HH:MM:SS L Tag Message) ==========

    @Test
    fun `detect returns TEXT_LOG_SIMPLE for DD-MM format`() {
        val textLog = buildString {
            appendLine("14-12 22:13:59 I Tag Message here")
            appendLine("15-12 22:14:00 W AnotherTag Another message")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_SIMPLE, result)
    }

    @Test
    fun `detect returns TEXT_LOG_SIMPLE for simple format with single letter level`() {
        val textLog = buildString {
            appendLine("01-01 12:00:00 I System Startup complete")
            appendLine("01-01 12:00:01 E Error Error occurred")
            appendLine("01-01 12:00:02 D Debug Debug message")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_SIMPLE, result)
    }

    // ========== Month name format tests (MMM-DD HH:MM:SS Tag Level Message) ==========

    @Test
    fun `detect returns TEXT_LOG_MONTH_NAME for MMM-DD format`() {
        val textLog = buildString {
            appendLine("Feb-03 22:13:59 Tag Info Message here")
            appendLine("Mar-15 10:30:00 MyTag Warn Warning message")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_MONTH_NAME, result)
    }

    @Test
    fun `detect returns TEXT_LOG_MONTH_NAME for month name format`() {
        val textLog = buildString {
            appendLine("Jan-01 00:00:00 System Info System initialized")
            appendLine("Dec-31 23:59:59 App Error Shutting down")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_MONTH_NAME, result)
    }

    // ========== JSON format tests ==========

    @Test
    fun `detect returns ANDROID_JSON for JSON log content`() {
        val jsonLog = buildString {
            appendLine("{")
            appendLine("  \"metadata\": { \"device\": { \"name\": \"test\" } },")
            appendLine("  \"logcatMessages\": [")
            appendLine("    { \"header\": { \"timestamp\": { \"seconds\": 1234567890, \"nanos\": 0 } }, \"message\": \"test\" }")
            appendLine("  ]")
            appendLine("}")
        }
        val result = PreParser.detect(jsonLog.toByteArray())
        assertEquals(ParserType.ANDROID_JSON, result)
    }

    @Test
    fun `detect returns ANDROID_JSON for array-style JSON`() {
        val arrayJson = buildString {
            appendLine("[")
            appendLine("  { \"header\": { \"logLevel\": \"INFO\" }, \"message\": \"test1\" },")
            appendLine("  { \"header\": { \"logLevel\": \"ERROR\" }, \"message\": \"test2\" }")
            appendLine("]")
        }
        val result = PreParser.detect(arrayJson.toByteArray())
        assertEquals(ParserType.ANDROID_JSON, result)
    }

    // ========== Mixed content tests ==========

    @Test
    fun `detect returns TEXT_LOG_DETAILED when detailed lines outnumber others`() {
        val mixed = buildString {
            // JSON-like line but not actual JSON structure
            appendLine("{ some content here")
            appendLine("00:46:47.548 [thread] INFO source - message 1")
            appendLine("00:46:47.549 [thread] WARN source - message 2")
            appendLine("{ another bracket line")
            appendLine("00:46:47.550 [thread] ERROR source - message 3")
        }
        val result = PreParser.detect(mixed.toByteArray())
        assertEquals(ParserType.TEXT_LOG_DETAILED, result)
    }

    @Test
    fun `detect returns TEXT_LOG_SIMPLE when simple format dominates`() {
        val mixed = buildString {
            appendLine("{ \"json\": true }")
            appendLine("14-12 22:13:59 I Tag Message 1")
            appendLine("14-12 22:14:00 I Tag Message 2")
            appendLine("{ \"more\": true }")
            appendLine("15-12 22:14:01 W Tag Message 3")
        }
        val result = PreParser.detect(mixed.toByteArray())
        assertEquals(ParserType.TEXT_LOG_SIMPLE, result)
    }

    @Test
    fun `detect returns TEXT_LOG_MONTH_NAME when month name format dominates`() {
        val mixed = buildString {
            appendLine("{ \"json\": true }")
            appendLine("Feb-03 22:13:59 Tag Info Message 1")
            appendLine("Feb-03 22:14:00 Tag Info Message 2")
            appendLine("{ \"more\": true }")
            appendLine("Mar-01 10:00:00 Tag Warn Message 3")
        }
        val result = PreParser.detect(mixed.toByteArray())
        assertEquals(ParserType.TEXT_LOG_MONTH_NAME, result)
    }

    // ========== Edge cases ==========

    @Test
    fun `detect throws when no recognizable patterns found`() {
        val garbage = buildString {
            appendLine("This is not a log file")
            appendLine("Just some random text")
            appendLine("No timestamps or JSON structures")
            appendLine("   also some indented lines")
            appendLine("and maybe some more random content here")
        }
        assertThrows(IllegalArgumentException::class.java) {
            PreParser.detect(garbage.toByteArray())
        }
    }

    @Test
    fun `detect throws for empty input`() {
        assertThrows(IllegalArgumentException::class.java) {
            PreParser.detect(ByteArray(0))
        }
    }

    @Test
    fun `detect ignores non-matching lines and counts only pattern matches`() {
        val content = buildString {
            appendLine("00:46:47.548 [thread] INFO source - valid line 1")
            appendLine("at org.gradle.internal.some.StackTraceLine")
            appendLine("at java.base/java.lang.Thread.run")
            appendLine("00:46:47.549 [thread] INFO source - valid line 2")
            appendLine("Caused by: java.io.IOException")
            appendLine("00:46:47.550 [thread] ERROR source - valid line 3")
        }
        val result = PreParser.detect(content.toByteArray())
        assertEquals(ParserType.TEXT_LOG_DETAILED, result)
    }

    @Test
    fun `detect handles very long lines without crashing`() {
        val longLine = "00:46:47.548 [DefaultDispatcher-worker-2] INFO ktor.application - " + "x".repeat(10000)
        val result = PreParser.detect(longLine.toByteArray())
        assertEquals(ParserType.TEXT_LOG_DETAILED, result)
    }

    @Test
    fun `detect handles unicode content`() {
        val unicode = buildString {
            appendLine("00:46:47.548 [thread] INFO source - Логирование на русском")
            appendLine("00:46:47.549 [thread] INFO source - 中文日志")
            appendLine("00:46:47.550 [thread] WARN source - 日本語のログ")
        }
        val result = PreParser.detect(unicode.toByteArray())
        assertEquals(ParserType.TEXT_LOG_DETAILED, result)
    }

    @Test
    fun `detect handles exactly 100 lines of text log`() {
        val sb = StringBuilder()
        repeat(100) { i ->
            sb.appendLine("00:46:47.${String.format("%03d", i % 1000)} [thread-$i] INFO source-$i - message $i")
        }
        val result = PreParser.detect(sb.toString().toByteArray())
        assertEquals(ParserType.TEXT_LOG_DETAILED, result)
    }

    // ========== Simple format edge cases ==========

    @Test
    fun `detect handles simple format with various level letters`() {
        val textLog = buildString {
            appendLine("01-01 12:00:00 I InfoTag Info message")
            appendLine("01-01 12:00:01 W WarnTag Warn message")
            appendLine("01-01 12:00:02 E ErrorTag Error message")
            appendLine("01-01 12:00:03 D DebugTag Debug message")
            appendLine("01-01 12:00:04 V VerboseTag Verbose message")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_SIMPLE, result)
    }

    @Test
    fun `detect handles month name format with all months`() {
        val textLog = buildString {
            appendLine("Jan-15 10:00:00 Tag Info Message")
            appendLine("Mar-20 15:30:00 Tag Warn Message")
            appendLine("Dec-25 20:00:00 Tag Error Message")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_MONTH_NAME, result)
    }

    @Test
    fun `detect simple format ignores lines without dash after level`() {
        val content = buildString {
            appendLine("14-12 22:13:59 I Tag Valid message")
            appendLine("at java.lang.Thread.run")
            appendLine("Caused by: java.io.IOException")
            appendLine("15-12 22:14:00 W Tag Another valid message")
        }
        val result = PreParser.detect(content.toByteArray())
        assertEquals(ParserType.TEXT_LOG_SIMPLE, result)
    }

    @Test
    fun `detect month name format ignores non-matching lines`() {
        val content = buildString {
            appendLine("Feb-03 22:13:59 Tag Info Valid message")
            appendLine("org.springframework.web.servlet")
            appendLine("at org.springframework.context")
            appendLine("Mar-15 10:30:00 Tag Warn Another valid message")
        }
        val result = PreParser.detect(content.toByteArray())
        assertEquals(ParserType.TEXT_LOG_MONTH_NAME, result)
    }

    // ========== Plain text logcat format tests (MM-DD HH:MM:SS.mmm PID TID L Tag: Message) ==========

    @Test
    fun `detect returns TEXT_LOG_PLAIN for Android logcat plain text format`() {
        val textLog = buildString {
            appendLine("04-09 11:59:46.133  1184  1680 D ConnectivityService: sending notification CALLBACK_LOST")
            appendLine("04-09 11:59:46.134  1184  1680 D ConnectivityService: sending notification for NetworkRequest")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_PLAIN, result)
    }

    @Test
    fun `detect returns TEXT_LOG_PLAIN for format with section markers`() {
        val textLog = buildString {
            appendLine("--------- beginning of system")
            appendLine("04-09 11:59:46.133  1184  1680 D ConnectivityService: sending notification")
            appendLine("--------- beginning of main")
            appendLine("04-09 11:59:47.100  1184  1680 I ActivityManager: Started package")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_PLAIN, result)
    }

    @Test
    fun `detect returns TEXT_LOG_PLAIN for all log levels`() {
        val textLog = buildString {
            appendLine("04-09 11:59:46.133  1184  1680 V Tag: Verbose message")
            appendLine("04-09 11:59:46.134  1184  1680 D Tag: Debug message")
            appendLine("04-09 11:59:46.135  1184  1680 I Tag: Info message")
            appendLine("04-09 11:59:46.136  1184  1680 W Tag: Warn message")
            appendLine("04-09 11:59:46.137  1184  1680 E Tag: Error message")
            appendLine("04-09 11:59:46.138  1184  1680 A Tag: Assert message")
        }
        val result = PreParser.detect(textLog.toByteArray())
        assertEquals(ParserType.TEXT_LOG_PLAIN, result)
    }

    @Test
    fun `detect TEXT_LOG_PLAIN dominates over sparse JSON-like lines`() {
        val mixed = buildString {
            appendLine("{ \"json\": true }")
            appendLine("04-09 11:59:46.133  1184  1680 D Tag: message 1")
            appendLine("04-09 11:59:46.134  1184  1680 D Tag: message 2")
            appendLine("{ \"more\": true }")
            appendLine("04-09 11:59:46.135  1184  1680 D Tag: message 3")
        }
        val result = PreParser.detect(mixed.toByteArray())
        assertEquals(ParserType.TEXT_LOG_PLAIN, result)
    }
}
