package parser

import (
	"bufio"
	"bytes"
	"regexp"
	"strings"
)

// LogType represents the detected format type
type LogType int

const (
	LogTypeUnknown LogType = iota
	LogTypeAndroidJSON
	LogTypeTextLogDetailed
	LogTypeTextLogSimple
	LogTypeTextLogMonthName
	LogTypeTextLogPlain
)

var (
	patternDetailed   = regexp.MustCompile(`^\d{2}:\d{2}:\d{2}\.\d{3}\s+\[[^\]]+\]\s+[A-Z_]+\s+.+\s+-\s+`)
	patternSimple     = regexp.MustCompile(`^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[A-Z]\s+[^\s]+\s+.*`)
	patternMonthName  = regexp.MustCompile(`^[A-Za-z]{3}-\d{2}\s+\d{2}:\d{2}:\d{2}\s+[^\s]+\s+[A-Za-z_]+\s+.*`)
	patternPlain      = regexp.MustCompile(`^\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3}\s+\d+\s+\d+(\s+\d+)?\s+[A-Z]\s+[^:\s]+:\s*.*`)
	patternJSONStart  = regexp.MustCompile(`^[\[{]`)
)

// DetectLogType scans the first 100 lines to determine the format
func DetectLogType(data []byte) LogType {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	var lines []string
	lineCount := 0
	for scanner.Scan() && lineCount < 100 {
		lines = append(lines, scanner.Text())
		lineCount++
	}

	var jsonScore, textScore int
	var detailedCount, simpleCount, monthNameCount, plainCount int

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if patternJSONStart.MatchString(line) {
			jsonScore++
		}
		if patternDetailed.MatchString(line) {
			detailedCount++
		}
		if patternSimple.MatchString(line) {
			simpleCount++
		}
		if patternMonthName.MatchString(line) {
			monthNameCount++
		}
		if patternPlain.MatchString(line) {
			plainCount++
		}
	}

	textScore = detailedCount + simpleCount + monthNameCount + plainCount

	if textScore > 0 && textScore >= jsonScore {
		// Text detection
		maxCount := detailedCount
		logType := LogTypeTextLogDetailed

		if simpleCount > maxCount {
			maxCount = simpleCount
			logType = LogTypeTextLogSimple
		}
		if monthNameCount > maxCount {
			maxCount = monthNameCount
			logType = LogTypeTextLogMonthName
		}
		if plainCount > maxCount {
			maxCount = plainCount
			logType = LogTypeTextLogPlain
		}

		if maxCount > 0 {
			return logType
		}
	}

	if jsonScore > 0 {
		return LogTypeAndroidJSON
	}

	return LogTypeUnknown
}
