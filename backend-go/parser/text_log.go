package parser

import (
	"errors"
	"logvue/models"
	"regexp"
	"strings"
	"time"
)

// TextLogParser parses detailed text logs with thread brackets
// Format: HH:MM:SS.mmm [threadName] LEVEL tag - message
type TextLogParser struct{}

func NewTextLogParser() *TextLogParser {
	return &TextLogParser{}
}

var textLogPattern = regexp.MustCompile(`^(\d{2}:\d{2}:\d{2}\.\d{3})\s+\[([^\]]+)\]\s+([A-Z]+)\s+([^\s-]+)\s+-\s+(.*)$`)

func (p *TextLogParser) Parse(bytes []byte, fileName string) (*ParseResult, error) {
	lines := strings.Split(string(bytes), "\n")
	entries := make([]models.LogEntry, 0)

	today := time.Now().Truncate(24 * time.Hour)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		matches := textLogPattern.FindStringSubmatch(line)
		if len(matches) < 6 {
			continue
		}

		timeStr := matches[1]
		threadName := matches[2]
		levelStr := matches[3]
		tag := matches[4]
		message := matches[5]

		fullTime, err := parseTimeOfDay(today, timeStr)
		if err != nil {
			continue
		}

		entries = append(entries, models.LogEntry{
			ID: len(entries),
			Header: models.LogHeader{
				LogLevel:    normalizeLevel(levelStr),
				PID:         0,
				TID:         0,
				Tag:         tag,
				ThreadName:  threadName,
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
		return nil, errors.New("no entries parsed in text log format")
	}

	var timeRange models.TimeRange
	timeRange = models.TimeRange{
		StartTimestamp: entries[0].Timestamp,
		EndTimestamp:   entries[len(entries)-1].Timestamp,
	}

	metadata := models.LogFileMetadata{
		DeviceName: "Text Log",
		LogCount:   len(entries),
		TimeRange:  timeRange,
	}

	return &ParseResult{Metadata: metadata, Entries: entries}, nil
}

func parseTimeOfDay(base time.Time, timeStr string) (time.Time, error) {
	parsed, err := time.Parse("15:04:05.000", timeStr)
	if err != nil {
		return time.Time{}, err
	}
	return time.Date(base.Year(), base.Month(), base.Day(),
		parsed.Hour(), parsed.Minute(), parsed.Second(), parsed.Nanosecond(), base.Location()), nil
}

func normalizeLevel(level string) string {
	switch strings.ToUpper(level) {
	case "I", "INFO", "INFORMATION":
		return "INFO"
	case "W", "WARN", "WARNING":
		return "WARN"
	case "E", "ERROR", "ERR":
		return "ERROR"
	case "D", "DEBUG", "DBG":
		return "DEBUG"
	case "V", "VERBOSE", "TRACE":
		return "VERBOSE"
	case "A", "ASSERT", "FATAL":
		return "ASSERT"
	default:
		return level
	}
}
