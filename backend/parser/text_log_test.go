package parser

import (
	"testing"
	"time"
)

func TestTextLogParser_Parse(t *testing.T) {
	parser := NewTextLogParser()

	t.Run("valid multi-line input", func(t *testing.T) {
		input := `00:46:47.548 [DefaultDispatcher-worker-2] INFO ktor.application - Autoreload is disabled
00:46:47.578 [DefaultDispatcher-worker-2] INFO ktor.application - Application started
00:46:48.100 [worker-1] DEBUG MyApp - Processing request`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 3 {
			t.Errorf("len(Entries) = %d, want 3", len(result.Entries))
		}
		if result.Metadata.DeviceName != "Text Log" {
			t.Errorf("DeviceName = %q, want %q", result.Metadata.DeviceName, "Text Log")
		}
		if result.Metadata.LogCount != 3 {
			t.Errorf("LogCount = %d, want 3", result.Metadata.LogCount)
		}
	})

	t.Run("single valid line", func(t *testing.T) {
		input := `00:46:47.548 [worker-1] WARN MyApp - Connection slow`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 1 {
			t.Errorf("len(Entries) = %d, want 1", len(result.Entries))
		}
		if result.Entries[0].Header.LogLevel != "WARN" {
			t.Errorf("LogLevel = %q, want %q", result.Entries[0].Header.LogLevel, "WARN")
		}
		if result.Entries[0].Header.Tag != "MyApp" {
			t.Errorf("Tag = %q, want %q", result.Entries[0].Header.Tag, "MyApp")
		}
		if result.Entries[0].Message != "Connection slow" {
			t.Errorf("Message = %q, want %q", result.Entries[0].Message, "Connection slow")
		}
	})

	t.Run("empty input returns error", func(t *testing.T) {
		_, err := parser.Parse([]byte(""), "test.txt")
		if err == nil {
			t.Error("Parse() expected error for empty input, got nil")
		}
	})

	t.Run("no matching lines returns error", func(t *testing.T) {
		input := `not a matching line
another non-matching line`
		_, err := parser.Parse([]byte(input), "test.txt")
		if err == nil {
			t.Error("Parse() expected error when no lines match, got nil")
		}
	})

	t.Run("mixed matching and non-matching lines", func(t *testing.T) {
		input := `not a matching line
00:46:47.548 [worker-1] INFO Tag - Valid message
another non-matching line
00:46:47.549 [worker-2] DEBUG Tag2 - Another valid`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
	})

	t.Run("whitespace only lines are skipped", func(t *testing.T) {
		input := "00:46:47.548 [worker-1] INFO Tag - Message\n\n   \n\n00:46:47.549 [worker-2] DEBUG Tag - Another"
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
	})
}

func TestParseTimeOfDay(t *testing.T) {
	base := time.Date(2024, 3, 15, 0, 0, 0, 0, time.UTC)

	t.Run("valid time", func(t *testing.T) {
		result, err := parseTimeOfDay(base, "12:30:45.123")
		if err != nil {
			t.Fatalf("parseTimeOfDay() error = %v", err)
		}
		if result.Hour() != 12 || result.Minute() != 30 || result.Second() != 45 {
			t.Errorf("time components = %d:%d:%d, want 12:30:45", result.Hour(), result.Minute(), result.Second())
		}
		if result.Nanosecond() != 123000000 {
			t.Errorf("Nanoseconds = %d, want 123000000", result.Nanosecond())
		}
	})

	t.Run("midnight boundary", func(t *testing.T) {
		result, err := parseTimeOfDay(base, "00:00:00.000")
		if err != nil {
			t.Fatalf("parseTimeOfDay() error = %v", err)
		}
		if result.Hour() != 0 || result.Minute() != 0 || result.Second() != 0 {
			t.Errorf("time = %d:%d:%d, want 0:0:0", result.Hour(), result.Minute(), result.Second())
		}
	})

	t.Run("noon", func(t *testing.T) {
		result, err := parseTimeOfDay(base, "12:00:00.000")
		if err != nil {
			t.Fatalf("parseTimeOfDay() error = %v", err)
		}
		if result.Hour() != 12 {
			t.Errorf("Hour = %d, want 12", result.Hour())
		}
	})

	t.Run("preserves base date", func(t *testing.T) {
		result, err := parseTimeOfDay(base, "23:59:59.999")
		if err != nil {
			t.Fatalf("parseTimeOfDay() error = %v", err)
		}
		if result.Year() != 2024 || result.Month() != 3 || result.Day() != 15 {
			t.Errorf("date = %s, want 2024-03-15", result.Format("2006-01-02"))
		}
	})

	t.Run("preserves location", func(t *testing.T) {
		loc := time.FixedZone("Test", 5*3600)
		baseWithLoc := time.Date(2024, 3, 15, 0, 0, 0, 0, loc)
		result, err := parseTimeOfDay(baseWithLoc, "12:00:00.000")
		if err != nil {
			t.Fatalf("parseTimeOfDay() error = %v", err)
		}
		if result.Location() != loc {
			t.Errorf("Location = %v, want %v", result.Location(), loc)
		}
	})

	t.Run("invalid format returns error", func(t *testing.T) {
		_, err := parseTimeOfDay(base, "not-a-time")
		if err == nil {
			t.Error("parseTimeOfDay() expected error for invalid format, got nil")
		}
	})

	t.Run("missing milliseconds returns error", func(t *testing.T) {
		_, err := parseTimeOfDay(base, "12:30:45")
		if err == nil {
			t.Error("parseTimeOfDay() expected error for missing milliseconds, got nil")
		}
	})
}

func TestNormalizeLevel(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"I", "INFO"},
		{"INFO", "INFO"},
		{"INFORMATION", "INFO"},
		{"W", "WARN"},
		{"WARN", "WARN"},
		{"WARNING", "WARN"},
		{"E", "ERROR"},
		{"ERROR", "ERROR"},
		{"ERR", "ERROR"},
		{"D", "DEBUG"},
		{"DEBUG", "DEBUG"},
		{"DBG", "DEBUG"},
		{"V", "VERBOSE"},
		{"VERBOSE", "VERBOSE"},
		{"TRACE", "VERBOSE"},
		{"A", "ASSERT"},
		{"ASSERT", "ASSERT"},
		{"FATAL", "ASSERT"},
		{"unknown", "unknown"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			if got := normalizeLevel(tt.input); got != tt.expected {
				t.Errorf("normalizeLevel(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
