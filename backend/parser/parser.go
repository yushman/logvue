package parser

import "logvue/models"

// LogParser is the interface all parsers must implement
type LogParser interface {
	Parse(bytes []byte, fileName string) (*ParseResult, error)
}

// ParseResult contains parsed log entries and metadata
type ParseResult struct {
	Metadata models.LogFileMetadata
	Entries  []models.LogEntry
}
