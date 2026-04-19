package parser

import (
	"fmt"
	"testing"
)

func TestDetectLogType(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected LogType
		wantErr  bool
	}{
		// TEXT_LOG_DETAILED tests
		{
			name: "detailed format with thread brackets",
			input: "00:46:47.548 [DefaultDispatcher-worker-2] INFO  ktor.application - Autoreload is disabled\n" +
				"00:46:47.578 [DefaultDispatcher-worker-2] INFO  ktor.application - Application started\n",
			expected: LogTypeTextLogDetailed,
		},
		{
			name: "detailed format simple thread",
			input: "00:46:47.548 [worker-1] DEBUG MyApp - Processing request\n" +
				"00:46:47.549 [worker-2] WARN MyApp - Connection slow\n",
			expected: LogTypeTextLogDetailed,
		},

		// TEXT_LOG_SIMPLE tests
		{
			name: "simple DD-MM format",
			input: "14-12 22:13:59 I Tag Message here\n" +
				"15-12 22:14:00 W AnotherTag Another message\n",
			expected: LogTypeTextLogSimple,
		},
		{
			name: "simple format with single letter level",
			input: "01-01 12:00:00 I System Startup complete\n" +
				"01-01 12:00:01 E Error Error occurred\n",
			expected: LogTypeTextLogSimple,
		},

		// TEXT_LOG_MONTH_NAME tests
		{
			name: "month name MMM-DD format",
			input: "Feb-03 22:13:59 Tag Info Message here\n" +
				"Mar-15 10:30:00 MyTag Warn Warning message\n",
			expected: LogTypeTextLogMonthName,
		},
		{
			name: "month name all months",
			input: "Jan-01 00:00:00 System Info System initialized\n" +
				"Dec-31 23:59:59 App Error Shutting down\n",
			expected: LogTypeTextLogMonthName,
		},

		// ANDROID_JSON tests
		{
			name: "Android JSON new format",
			input: "{\n" +
				"  \"metadata\": { \"device\": { \"name\": \"test\" } },\n" +
				"  \"logcatMessages\": [\n" +
				"    { \"header\": { \"timestamp\": { \"seconds\": 1234567890, \"nanos\": 0 } }, \"message\": \"test\" }\n" +
				"  ]\n" +
				"}",
			expected: LogTypeAndroidJSON,
		},
		{
			name: "Android JSON array style",
			input: "[\n" +
				"  { \"header\": { \"logLevel\": \"INFO\" }, \"message\": \"test1\" },\n" +
				"  { \"header\": { \"logLevel\": \"ERROR\" }, \"message\": \"test2\" }\n" +
				"]",
			expected: LogTypeAndroidJSON,
		},

		// TEXT_LOG_PLAIN tests
		{
			name: "plain Android logcat format",
			input: "04-09 11:59:46.133  1184  1680 D ConnectivityService: sending notification CALLBACK_LOST\n" +
				"04-09 11:59:46.134  1184  1680 D ConnectivityService: sending notification\n",
			expected: LogTypeTextLogPlain,
		},
		{
			name: "plain format with section markers",
			input: "--------- beginning of system\n" +
				"04-09 11:59:46.133  1184  1680 D ConnectivityService: sending notification\n" +
				"--------- beginning of main\n" +
				"04-09 11:59:47.100  1184  1680 I ActivityManager: Started package\n",
			expected: LogTypeTextLogPlain,
		},
		{
			name: "plain format all log levels",
			input: "04-09 11:59:46.133  1184  1680 V Tag: Verbose message\n" +
				"04-09 11:59:46.134  1184  1680 D Tag: Debug message\n" +
				"04-09 11:59:46.135  1184  1680 I Tag: Info message\n" +
				"04-09 11:59:46.136  1184  1680 W Tag: Warn message\n" +
				"04-09 11:59:46.137  1184  1680 E Tag: Error message\n" +
				"04-09 11:59:46.138  1184  1680 A Tag: Assert message\n",
			expected: LogTypeTextLogPlain,
		},

		// Mixed content tests
		{
			name: "detailed dominates mixed with JSON-like",
			input: "{ some content here\n" +
				"00:46:47.548 [thread] INFO source - message 1\n" +
				"00:46:47.549 [thread] WARN source - message 2\n" +
				"{ another bracket line\n" +
				"00:46:47.550 [thread] ERROR source - message 3\n",
			expected: LogTypeTextLogDetailed,
		},
		{
			name: "simple dominates mixed with JSON",
			input: "{ \"json\": true }\n" +
				"14-12 22:13:59 I Tag Message 1\n" +
				"14-12 22:14:00 I Tag Message 2\n" +
				"{ \"more\": true }\n" +
				"15-12 22:14:01 W Tag Message 3\n",
			expected: LogTypeTextLogSimple,
		},
		{
			name: "month name dominates mixed",
			input: "{ \"json\": true }\n" +
				"Feb-03 22:13:59 Tag Info Message 1\n" +
				"Feb-03 22:14:00 Tag Info Message 2\n" +
				"{ \"more\": true }\n" +
				"Mar-01 10:00:00 Tag Warn Message 3\n",
			expected: LogTypeTextLogMonthName,
		},

		// Edge cases
		{
			name:     "empty input returns unknown",
			input:    "",
			expected: LogTypeUnknown,
			wantErr:  false, // Our Go version doesn't throw, returns Unknown
		},
		{
			name: "unicode content",
			input: "00:46:47.548 [thread] INFO source - Логирование на русском\n" +
				"00:46:47.549 [thread] INFO source - 中文日志\n" +
				"00:46:47.550 [thread] WARN source - 日本語のログ\n",
			expected: LogTypeTextLogDetailed,
		},
		{
			name: "very long line",
			input: "00:46:47.548 [DefaultDispatcher-worker-2] INFO ktor.application - " + string(make([]byte, 10000)),
			expected: LogTypeTextLogDetailed,
		},
		{
			name: "exactly 100 lines",
			input: func() string {
				var sb string
				for i := 0; i < 100; i++ {
					sb += "00:46:47." + fmt.Sprintf("%03d", i%1000) + " [thread-" + fmt.Sprintf("%d", i) + "] INFO source-" + fmt.Sprintf("%d", i) + " - message " + fmt.Sprintf("%d", i) + "\n"
				}
				return sb
			}(),
			expected: LogTypeTextLogDetailed,
		},
		{
			name: "simple format ignores non-matching lines",
			input: "14-12 22:13:59 I Tag Valid message\n" +
				"at java.lang.Thread.run\n" +
				"Caused by: java.io.IOException\n" +
				"15-12 22:14:00 W Tag Another valid message\n",
			expected: LogTypeTextLogSimple,
		},
		{
			name: "month name ignores non-matching lines",
			input: "Feb-03 22:13:59 Tag Info Valid message\n" +
				"org.springframework.web.servlet\n" +
				"at org.springframework.context\n" +
				"Mar-15 10:30:00 Tag Warn Another valid message\n",
			expected: LogTypeTextLogMonthName,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := DetectLogType([]byte(tt.input))
			if result != tt.expected {
				t.Errorf("DetectLogType() = %v, want %v", result, tt.expected)
			}
		})
	}
}
