package parser

import (
	"errors"
	"logvue/models"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// PlainTextLogcatParser parses plain Android logcat text output
// Format: MM-DD HH:MM:SS.mmm PID TID L Tag: Message
type PlainTextLogcatParser struct{}

func NewPlainTextLogcatParser() *PlainTextLogcatParser {
	return &PlainTextLogcatParser{}
}

var plainPattern = regexp.MustCompile(`^(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s+(\d+)\s+(\d+)\s+([A-Z])\s+([^:\s]+):\s*(.*)$`)
var sectionMarker = regexp.MustCompile(`^-+$`)

func (p *PlainTextLogcatParser) Parse(bytes []byte, fileName string) (*ParseResult, error) {
	lines := strings.Split(string(bytes), "\n")
	entries := make([]models.LogEntry, 0)

	currentYear := time.Now().Year()

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || sectionMarker.MatchString(line) {
			continue
		}

		matches := plainPattern.FindStringSubmatch(line)
		if len(matches) < 12 {
			continue
		}

		monthStr, dayStr := matches[1], matches[2]
		hourStr, minStr, secStr, msStr := matches[3], matches[4], matches[5], matches[6]
		pidStr, tidStr := matches[7], matches[8]
		levelChar := matches[9]
		tag := matches[10]
		message := matches[11]

		month, _ := strconv.Atoi(monthStr)
		day, _ := strconv.Atoi(dayStr)
		hour, _ := strconv.Atoi(hourStr)
		min, _ := strconv.Atoi(minStr)
		sec, _ := strconv.Atoi(secStr)
		ms, _ := strconv.Atoi(msStr)
		pid, _ := strconv.Atoi(pidStr)
		tid, _ := strconv.Atoi(tidStr)

		fullTime := time.Date(currentYear, time.Month(month), day, hour, min, sec, ms*1_000_000, time.Local)

		// If date is in the future, subtract 1 year
		if fullTime.After(time.Now()) {
			fullTime = fullTime.AddDate(-1, 0, 0)
		}

		entries = append(entries, models.LogEntry{
			ID: len(entries),
			Header: models.LogHeader{
				LogLevel: normalizeLevelChar(string(levelChar[0])),
				PID:      pid,
				TID:      tid,
				Tag:      tag,
				Timestamp: models.Timestamp{
					Seconds: fullTime.Unix(),
					Nanos:   0,
				},
			},
			Message:   message,
			Timestamp: fullTime.UnixMilli(),
		})
	}

	if len(entries) == 0 {
		return nil, errors.New("no entries parsed in plain text logcat format")
	}

	var timeRange models.TimeRange
	timeRange = models.TimeRange{
		StartTimestamp: entries[0].Timestamp,
		EndTimestamp:   entries[len(entries)-1].Timestamp,
	}

	metadata := models.LogFileMetadata{
		DeviceName: "Plain Text Logcat",
		LogCount:   len(entries),
		TimeRange:  timeRange,
	}

	return &ParseResult{Metadata: metadata, Entries: entries}, nil
}

func normalizeLevelChar(c string) string {
	switch c {
	case "V":
		return "VERBOSE"
	case "D":
		return "DEBUG"
	case "I":
		return "INFO"
	case "W":
		return "WARN"
	case "E":
		return "ERROR"
	case "A":
		return "ASSERT"
	default:
		return c
	}
}
