package parser

import (
	"testing"
)

func TestPlainTextLogcatParser_Parse(t *testing.T) {
	parser := NewPlainTextLogcatParser()

	t.Run("valid input with PID and TID", func(t *testing.T) {
		input := `04-09 11:59:46.133  1184  1680 D ConnectivityService: sending notification CALLBACK_LOST
04-09 11:59:46.134  1184  1680 I ActivityManager: Started package com.example`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
		if result.Entries[0].Header.PID != 1184 {
			t.Errorf("PID = %d, want 1184", result.Entries[0].Header.PID)
		}
		if result.Entries[0].Header.TID != 1680 {
			t.Errorf("TID = %d, want 1680", result.Entries[0].Header.TID)
		}
		if result.Entries[0].Header.LogLevel != "DEBUG" {
			t.Errorf("LogLevel = %q, want %q", result.Entries[0].Header.LogLevel, "DEBUG")
		}
		if result.Entries[0].Header.Tag != "ConnectivityService" {
			t.Errorf("Tag = %q, want %q", result.Entries[0].Header.Tag, "ConnectivityService")
		}
	})

	t.Run("valid input with section markers", func(t *testing.T) {
		input := `--------- beginning of system
04-09 11:59:46.133  1184  1680 D Tag: message
--------- beginning of main
04-09 11:59:47.100  1184  1680 I Tag: another message`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
	})

	t.Run("all log levels", func(t *testing.T) {
		input := `04-09 11:59:46.133  1000  2000 V Tag: Verbose
04-09 11:59:46.134  1000  2000 D Tag: Debug
04-09 11:59:46.135  1000  2000 I Tag: Info
04-09 11:59:46.136  1000  2000 W Tag: Warn
04-09 11:59:46.137  1000  2000 E Tag: Error
04-09 11:59:46.138  1000  2000 A Tag: Assert`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		levels := []string{"VERBOSE", "DEBUG", "INFO", "WARN", "ERROR", "ASSERT"}
		for i, want := range levels {
			if result.Entries[i].Header.LogLevel != want {
				t.Errorf("Entries[%d].LogLevel = %q, want %q", i, result.Entries[i].Header.LogLevel, want)
			}
		}
	})

	t.Run("empty input returns error", func(t *testing.T) {
		_, err := parser.Parse([]byte(""), "test.txt")
		if err == nil {
			t.Error("Parse() expected error for empty input, got nil")
		}
	})

	t.Run("only section markers returns error", func(t *testing.T) {
		input := `--------- beginning of system
--------- beginning of main`
		_, err := parser.Parse([]byte(input), "test.txt")
		if err == nil {
			t.Error("Parse() expected error when no entries match, got nil")
		}
	})

	t.Run("non-matching lines are skipped", func(t *testing.T) {
		input := `not a matching line
04-09 11:59:46.133  1184  1680 D Tag: valid message
at java.lang.Thread.run
04-09 11:59:47.100  1184  1680 I Tag: another valid`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
	})

	t.Run("whitespace only lines are skipped", func(t *testing.T) {
		input := `04-09 11:59:46.133  1184  1680 D Tag: message

   `
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 1 {
			t.Errorf("len(Entries) = %d, want 1", len(result.Entries))
		}
	})
}

func TestNormalizeLevelChar(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"V", "VERBOSE"},
		{"D", "DEBUG"},
		{"I", "INFO"},
		{"W", "WARN"},
		{"E", "ERROR"},
		{"A", "ASSERT"},
		{"X", "X"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			if got := normalizeLevelChar(tt.input); got != tt.expected {
				t.Errorf("normalizeLevelChar(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestPlainTextLogcatParser_TimeRange(t *testing.T) {
	parser := NewPlainTextLogcatParser()
	input := `04-09 11:59:46.133  1184  1680 D Tag: first
04-09 11:59:47.100  1184  1680 D Tag: second`
	result, err := parser.Parse([]byte(input), "test.txt")
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if result.Metadata.TimeRange.StartTimestamp >= result.Metadata.TimeRange.EndTimestamp {
		t.Errorf("StartTimestamp >= EndTimestamp")
	}
}
