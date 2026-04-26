package parser

import (
	"testing"
)

func TestSimpleTextLogParser_Parse(t *testing.T) {
	parser := NewSimpleTextLogParser()

	t.Run("format A (DD-MM) with all log levels", func(t *testing.T) {
		input := `14-12 22:13:59 I Tag Info message
15-12 22:14:00 W Tag Warn message
16-12 22:14:01 E Tag Error message`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 3 {
			t.Errorf("len(Entries) = %d, want 3", len(result.Entries))
		}
		levels := []string{"INFO", "WARN", "ERROR"}
		for i, want := range levels {
			if result.Entries[i].Header.LogLevel != want {
				t.Errorf("Entries[%d].LogLevel = %q, want %q", i, result.Entries[i].Header.LogLevel, want)
			}
		}
	})

	t.Run("format B (MMM-DD) with tag and level", func(t *testing.T) {
		input := `Feb-03 22:13:59 Tag Info Message here
Mar-15 10:30:00 MyTag Warn Warning message`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
		if result.Entries[0].Header.Tag != "Tag" {
			t.Errorf("Tag = %q, want %q", result.Entries[0].Header.Tag, "Tag")
		}
		if result.Entries[0].Message != "Message here" {
			t.Errorf("Message = %q, want %q", result.Entries[0].Message, "Message here")
		}
	})

	t.Run("mixed format A and B", func(t *testing.T) {
		input := `14-12 22:13:59 I Tag FormatA message
Feb-03 22:13:59 Tag Info FormatB message`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
	})

	t.Run("empty input returns error", func(t *testing.T) {
		_, err := parser.Parse([]byte(""), "test.txt")
		if err == nil {
			t.Error("Parse() expected error for empty input, got nil")
		}
	})

	t.Run("no matching lines returns error", func(t *testing.T) {
		input := `not matching format
14-13 22:13:59 I Tag valid message`
		_, err := parser.Parse([]byte(input), "test.txt")
		if err == nil {
			t.Error("Parse() expected error when no lines match, got nil")
		}
	})

	t.Run("non-matching lines are skipped", func(t *testing.T) {
		input := `not a matching line
14-12 22:13:59 I Tag Valid message
at java.lang.Thread.run
15-12 22:14:00 W Tag Another valid message`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
	})

	t.Run("whitespace only lines are skipped", func(t *testing.T) {
		input := `14-12 22:13:59 I Tag Message

   `
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 1 {
			t.Errorf("len(Entries) = %d, want 1", len(result.Entries))
		}
	})

	t.Run("all months in format B", func(t *testing.T) {
		input := `Jan-01 00:00:00 System Info Jan
Feb-15 00:00:00 System Info Feb
Mar-01 00:00:00 System Info Mar
Apr-01 00:00:00 System Info Apr
May-01 00:00:00 System Info May
Jun-01 00:00:00 System Info Jun
Jul-01 00:00:00 System Info Jul
Aug-01 00:00:00 System Info Aug
Sep-01 00:00:00 System Info Sep
Oct-01 00:00:00 System Info Oct
Nov-01 00:00:00 System Info Nov
Dec-01 00:00:00 System Info Dec`
		result, err := parser.Parse([]byte(input), "test.txt")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 12 {
			t.Errorf("len(Entries) = %d, want 12", len(result.Entries))
		}
	})
}

func TestParseFormatA(t *testing.T) {
	parser := NewSimpleTextLogParser()
	year := 2024

	t.Run("valid DD-MM format", func(t *testing.T) {
		matches := []string{"", "15", "12", "22:13:59", "I", "Tag", "Message"}
		entry, err := parser.parseFormatA(matches, year)
		if err != nil {
			t.Fatalf("parseFormatA() error = %v", err)
		}
		if entry.Header.LogLevel != "INFO" {
			t.Errorf("LogLevel = %q, want %q", entry.Header.LogLevel, "INFO")
		}
		if entry.Header.Tag != "Tag" {
			t.Errorf("Tag = %q, want %q", entry.Header.Tag, "Tag")
		}
	})

	t.Run("invalid month returns error", func(t *testing.T) {
		matches := []string{"", "15", "13", "22:13:59", "I", "Tag", "Message"}
		_, err := parser.parseFormatA(matches, year)
		if err == nil {
			t.Error("parseFormatA() expected error for invalid month (13), got nil")
		}
	})

	t.Run("invalid day returns error", func(t *testing.T) {
		matches := []string{"", "32", "12", "22:13:59", "I", "Tag", "Message"}
		_, err := parser.parseFormatA(matches, year)
		if err == nil {
			t.Error("parseFormatA() expected error for invalid day (32), got nil")
		}
	})
}

func TestParseFormatB(t *testing.T) {
	parser := NewSimpleTextLogParser()
	year := 2024

	t.Run("valid MMM-DD format", func(t *testing.T) {
		matches := []string{"", "Dec", "25", "22:13:59", "Tag", "Info", "Message"}
		entry, err := parser.parseFormatB(matches, year)
		if err != nil {
			t.Fatalf("parseFormatB() error = %v", err)
		}
		if entry.Header.Tag != "Tag" {
			t.Errorf("Tag = %q, want %q", entry.Header.Tag, "Tag")
		}
		if entry.Header.LogLevel != "INFO" {
			t.Errorf("LogLevel = %q, want %q", entry.Header.LogLevel, "INFO")
		}
	})

	t.Run("invalid month returns error", func(t *testing.T) {
		matches := []string{"", "Xyz", "25", "22:13:59", "Tag", "Info", "Message"}
		_, err := parser.parseFormatB(matches, year)
		if err == nil {
			t.Error("parseFormatB() expected error for invalid month, got nil")
		}
	})

	t.Run("case insensitive month names", func(t *testing.T) {
		matches := []string{"", "JAN", "01", "00:00:00", "Tag", "Info", "Message"}
		entry, err := parser.parseFormatB(matches, year)
		if err != nil {
			t.Fatalf("parseFormatB() error = %v", err)
		}
		if entry.Header.Tag != "Tag" {
			t.Errorf("Tag = %q, want %q", entry.Header.Tag, "Tag")
		}
	})
}

func TestNormalizeLevelCharSimple(t *testing.T) {
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
			if got := normalizeLevelCharSimple(tt.input); got != tt.expected {
				t.Errorf("normalizeLevelCharSimple(%q) = %q, want %q", tt.input, got, tt.expected)
			}
		})
	}
}
