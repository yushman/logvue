package parser

import (
	"errors"
	"fmt"
	"logvue/models"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// SimpleTextLogParser parses simple text log formats
// Format A: DD-MM HH:MM:SS L Tag Message
// Format B: MMM-DD HH:MM:SS Tag Level Message
type SimpleTextLogParser struct{}

func NewSimpleTextLogParser() *SimpleTextLogParser {
	return &SimpleTextLogParser{}
}

var (
	patternFormatA = regexp.MustCompile(`^(\d{2})-(\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([A-Z])\s+([^\s]+)\s+(.*)$`)
	patternFormatB = regexp.MustCompile(`^([A-Za-z]{3})-(\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([^\s]+)\s+([A-Za-z_]+)\s+(.*)$`)
)

var monthMap = map[string]time.Month{
	"jan": time.January, "feb": time.February, "mar": time.March,
	"apr": time.April, "may": time.May, "jun": time.June,
	"jul": time.July, "aug": time.August, "sep": time.September,
	"oct": time.October, "nov": time.November, "dec": time.December,
}

func (p *SimpleTextLogParser) Parse(bytes []byte, fileName string) (*ParseResult, error) {
	lines := strings.Split(string(bytes), "\n")
	entries := make([]models.LogEntry, 0)

	currentYear := time.Now().Year()

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Try Format A first: DD-MM HH:MM:SS L Tag Message
		if matches := patternFormatA.FindStringSubmatch(line); len(matches) == 6 {
			entry, err := p.parseFormatA(matches, currentYear)
			if err == nil {
				entries = append(entries, *entry)
				continue
			}
		}

		// Try Format B: MMM-DD HH:MM:SS Tag Level Message
		if matches := patternFormatB.FindStringSubmatch(line); len(matches) == 6 {
			entry, err := p.parseFormatB(matches, currentYear)
			if err == nil {
				entries = append(entries, *entry)
			}
		}
	}

	if len(entries) == 0 {
		return nil, errors.New("no entries parsed in simple text format")
	}

	var timeRange models.TimeRange
	timeRange = models.TimeRange{
		StartTimestamp: entries[0].Timestamp,
		EndTimestamp:   entries[len(entries)-1].Timestamp,
	}

	metadata := models.LogFileMetadata{
		DeviceName: "Simple Text Log",
		LogCount:   len(entries),
		TimeRange:  timeRange,
	}

	return &ParseResult{Metadata: metadata, Entries: entries}, nil
}

func (p *SimpleTextLogParser) parseFormatA(matches []string, year int) (*models.LogEntry, error) {
	day, month := matches[1], matches[2]
	timeStr := matches[3]
	levelChar := matches[4]
	tag := matches[5]
	message := matches[6]

	monthNum := 0
	if _, err := fmt.Sscanf(month, "%d", &monthNum); err != nil {
		return nil, errors.New("invalid month")
	}

	dayInt, _ := strconv.Atoi(day)
	fullTime, err := time.Parse("2006-01-02 15:04:05", fmt.Sprintf("%04d-%02d-%02d %s", year, monthNum, dayInt, timeStr))
	if err != nil {
		return nil, err
	}

	return &models.LogEntry{
		ID: 0,
		Header: models.LogHeader{
			LogLevel: normalizeLevelCharSimple(string(levelChar[0])),
			PID:      0,
			TID:      0,
			Tag:      tag,
			Timestamp: models.Timestamp{
				Seconds: fullTime.Unix(),
				Nanos:   0,
			},
		},
		Message:   message,
		Timestamp: fullTime.UnixMilli(),
	}, nil
}

func (p *SimpleTextLogParser) parseFormatB(matches []string, year int) (*models.LogEntry, error) {
	monthStr, day := matches[1], matches[2]
	timeStr := matches[3]
	tag := matches[4]
	levelStr := matches[5]
	message := matches[6]

	month, ok := monthMap[strings.ToLower(monthStr)]
	if !ok {
		return nil, errors.New("invalid month")
	}

	dayNum := 0
	if _, err := fmt.Sscanf(day, "%d", &dayNum); err != nil {
		return nil, err
	}

	fullTime, err := time.Parse("2006-01-02 15:04:05", fmt.Sprintf("%04d-%02d-%02d %s", year, month, dayNum, timeStr))
	if err != nil {
		return nil, err
	}

	return &models.LogEntry{
		ID: 0,
		Header: models.LogHeader{
			LogLevel: normalizeLevel(levelStr),
			PID:      0,
			TID:      0,
			Tag:      tag,
			Timestamp: models.Timestamp{
				Seconds: fullTime.Unix(),
				Nanos:   0,
			},
		},
		Message:   message,
		Timestamp: fullTime.UnixMilli(),
	}, nil
}

func normalizeLevelCharSimple(c string) string {
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
