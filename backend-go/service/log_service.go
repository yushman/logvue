package service

import (
	"logvue/models"
	"logvue/parser"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/google/uuid"
)

const MaxFileSize = 500 * 1024 * 1024 // 500 MB

var tagPalette = []string{
	"#e41a1c", "#377eb8", "#4daf4a", "#984ea3",
	"#ff7f00", "#a65628", "#f781bf", "#999999",
	"#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3",
	"#a6d854", "#ffd92f", "#e5c494", "#b3b3b3",
}

// LogService provides in-memory log storage and filtering
type LogService struct {
	mu     sync.Mutex
	files  map[string]*parser.ParseResult
	parser parser.LogParser
}

// NewLogService creates a new LogService with the given parser
func NewLogService(p parser.LogParser) *LogService {
	return &LogService{
		files:  make(map[string]*parser.ParseResult),
		parser: p,
	}
}

// UploadLogFile parses and stores a log file
func (s *LogService) UploadLogFile(bytes []byte, fileName string) (*models.LogUploadResponse, error) {
	if int64(len(bytes)) > MaxFileSize {
		return nil, &models.FileTooLargeException{ActualSize: int64(len(bytes)), MaxSize: MaxFileSize}
	}

	result, err := s.parser.Parse(bytes, fileName)
	if err != nil {
		return nil, &models.MalformedJsonException{Message: err.Error()}
	}

	fileID := generateUUID()

	s.mu.Lock()
	s.files[fileID] = result
	s.mu.Unlock()

	return &models.LogUploadResponse{
		FileID:     fileID,
		LogCount:   result.Metadata.LogCount,
		DeviceName: result.Metadata.DeviceName,
		TimeRange:  result.Metadata.TimeRange,
	}, nil
}

// GetLogFile retrieves the full parse result by file ID
func (s *LogService) GetLogFile(fileID string) *parser.ParseResult {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.files[fileID]
}

// FilterLogs applies filters and returns paginated results
func (s *LogService) FilterLogs(request models.FilterRequest) models.FilterResponse {
	s.mu.Lock()
	result := s.files[request.FileID]
	s.mu.Unlock()

	if result == nil || result.Entries == nil {
		return models.FilterResponse{Entries: []models.LogEntry{}}
	}

	entries := result.Entries
	if entries == nil {
		entries = []models.LogEntry{}
	}
	filtered := make([]models.LogEntry, 0, len(entries))

	// Filter by levels
	if len(request.Levels) > 0 {
		levelSet := make(map[string]bool)
		for _, l := range request.Levels {
			levelSet[strings.ToUpper(l)] = true
		}
		for _, e := range entries {
			if levelSet[strings.ToUpper(e.Header.LogLevel)] {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
		filtered = make([]models.LogEntry, 0, len(entries))
	}

	// Filter by tag pattern
	if request.TagPattern != "" {
		var tagMatcher func(string) bool
		if request.TagRegex {
			re, err := regexp.Compile(request.TagPattern)
			if err == nil {
				tagMatcher = func(tag string) bool {
					return re.MatchString(tag)
				}
			}
		} else {
			tags := strings.Split(request.TagPattern, "|")
			tagSet := make(map[string]bool)
			for _, t := range tags {
				tagSet[strings.ToLower(strings.TrimSpace(t))] = true
			}
			tagMatcher = func(tag string) bool {
				return tagSet[strings.ToLower(tag)]
			}
		}
		for _, e := range entries {
			if tagMatcher(e.Header.Tag) {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
		filtered = make([]models.LogEntry, 0, len(entries))
	}

	// Filter by hidden tags
	if request.HiddenTags != "" {
		hiddenSet := make(map[string]bool)
		for _, t := range strings.Split(request.HiddenTags, "|") {
			hiddenSet[strings.ToLower(strings.TrimSpace(t))] = true
		}
		for _, e := range entries {
			if !hiddenSet[strings.ToLower(e.Header.Tag)] {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
		filtered = make([]models.LogEntry, 0, len(entries))
	}

	// Filter by content
	if request.ContentFilter != "" {
		lowerFilter := strings.ToLower(request.ContentFilter)
		for _, e := range entries {
			if strings.Contains(strings.ToLower(e.Message), lowerFilter) {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
		filtered = make([]models.LogEntry, 0, len(entries))
	}

	// Filter by time range
	if request.TimeFrom != nil {
		for _, e := range entries {
			if e.Timestamp >= *request.TimeFrom {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
		filtered = make([]models.LogEntry, 0, len(entries))
	}
	if request.TimeTo != nil {
		for _, e := range entries {
			if e.Timestamp <= *request.TimeTo {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
		filtered = make([]models.LogEntry, 0, len(entries))
	}

	// Filter by search query
	if request.SearchQuery != "" {
		for _, e := range entries {
			if matchesSearch(e.Message, request.SearchQuery, request.SearchCaseSensitive, request.SearchRegex) {
				filtered = append(filtered, e)
			}
		}
		entries = filtered
		filtered = make([]models.LogEntry, 0, len(entries))
	}

	// Compute level counts
	levelCounts := make(map[string]int)
	for _, e := range entries {
		levelCounts[e.Header.LogLevel]++
	}

	// Compute tag counts
	tagCountMap := make(map[string]int)
	for _, e := range entries {
		tagCountMap[e.Header.Tag]++
	}
	tagCounts := make([]models.TagCount, 0, len(tagCountMap))
	for tag, count := range tagCountMap {
		tagCounts = append(tagCounts, models.TagCount{Tag: tag, Count: count})
	}
	// Sort by count descending
	for i := 0; i < len(tagCounts)-1; i++ {
		for j := i + 1; j < len(tagCounts); j++ {
			if tagCounts[j].Count > tagCounts[i].Count {
				tagCounts[i], tagCounts[j] = tagCounts[j], tagCounts[i]
			}
		}
	}

	// Search highlighting
	highlightRanges := make(map[string][][]int)
	if request.SearchQuery != "" {
		for _, e := range entries {
			ranges := computeHighlightRanges(e.Message, request.SearchQuery, request.SearchCaseSensitive, request.SearchRegex)
			if len(ranges) > 0 {
				highlightRanges[strconv.Itoa(e.ID)] = ranges
			}
		}
	}

	total := len(entries)

	// Pagination
	if request.Limit <= 0 {
		request.Limit = 200
	}
	offset := request.Offset
	if offset < 0 {
		offset = 0
	}
	end := offset + request.Limit
	if end > len(entries) {
		end = len(entries)
	}
	if offset >= len(entries) {
		entries = []models.LogEntry{}
	} else {
		entries = entries[offset:end]
	}

	return models.FilterResponse{
		Entries:               entries,
		Total:                 total,
		HasMore:               end < total,
		SearchHighlightRanges: highlightRanges,
		LevelCounts:           levelCounts,
		TagCounts:             tagCounts,
	}
}

// GetTimeline generates timeline buckets
func (s *LogService) GetTimeline(request models.TimelineRequest) models.TimelineResponse {
	s.mu.Lock()
	result := s.files[request.FileID]
	s.mu.Unlock()

	if result == nil {
		return models.TimelineResponse{}
	}

	numBuckets := 20
	if request.NumBuckets != nil && *request.NumBuckets > 0 {
		numBuckets = *request.NumBuckets
	}

	timeRange := result.Metadata.TimeRange
	if request.TimeFrom != nil {
		timeRange.StartTimestamp = *request.TimeFrom
	}
	if request.TimeTo != nil {
		timeRange.EndTimestamp = *request.TimeTo
	}

	bucketSize := (timeRange.EndTimestamp - timeRange.StartTimestamp) / int64(numBuckets)
	if bucketSize <= 0 {
		bucketSize = 1
	}

	buckets := make([]models.TimelineBucket, 0, numBuckets)
	for i := 0; i < numBuckets; i++ {
		bucketStart := timeRange.StartTimestamp + int64(i)*bucketSize
		bucketEnd := bucketStart + bucketSize
		tags := make(map[string]int)

		for _, e := range result.Entries {
			if e.Timestamp >= bucketStart && e.Timestamp < bucketEnd {
				tags[e.Header.Tag]++
			}
		}

		count := 0
		for _, c := range tags {
			count += c
		}

		buckets = append(buckets, models.TimelineBucket{
			Timestamp: bucketStart,
			Count:     count,
			Tags:      tags,
		})
	}

	// Compute tag colors
	tagColors := make(map[string]string)
	for _, e := range result.Entries {
		if _, ok := tagColors[e.Header.Tag]; !ok {
			tagColors[e.Header.Tag] = tagPalette[hashString(e.Header.Tag)%len(tagPalette)]
		}
	}

	return models.TimelineResponse{
		TimeRange: timeRange,
		Buckets:   buckets,
		TagColors: tagColors,
	}
}

// GetEntry retrieves a single entry by fileID and entryID
func (s *LogService) GetEntry(fileID string, entryID int) *models.LogEntry {
	s.mu.Lock()
	result := s.files[fileID]
	s.mu.Unlock()

	if result == nil {
		return nil
	}

	for _, e := range result.Entries {
		if e.ID == entryID {
			return &e
		}
	}
	return nil
}

// GetMetadata returns tag-to-color mapping for a file
func (s *LogService) GetMetadata(fileID string) map[string]string {
	s.mu.Lock()
	result := s.files[fileID]
	s.mu.Unlock()

	if result == nil {
		return nil
	}

	tagColors := make(map[string]string)
	for _, e := range result.Entries {
		if _, ok := tagColors[e.Header.Tag]; !ok {
			tagColors[e.Header.Tag] = tagPalette[hashString(e.Header.Tag)%len(tagPalette)]
		}
	}
	return tagColors
}

func hashString(str string) int {
	hash := 0
	for _, c := range str {
		hash = hash*31 + int(c)
	}
	return hash & 0x7FFFFFFF
}

func computeHighlightRanges(message, query string, caseSensitive, isRegex bool) [][]int {
	var ranges [][]int

	if isRegex {
		flags := ""
		if !caseSensitive {
			flags = "(?i)"
		}
		re, err := regexp.Compile(flags + query)
		if err != nil {
			return nil
		}
		matches := re.FindAllStringIndex(message, -1)
		for _, m := range matches {
			ranges = append(ranges, []int{m[0], m[1]})
		}
	} else {
		start := 0
		msg := message
		if !caseSensitive {
			msg = strings.ToLower(msg)
			query = strings.ToLower(query)
		}
		for {
			idx := strings.Index(msg[start:], query)
			if idx == -1 {
				break
			}
			actualIdx := start + idx
			ranges = append(ranges, []int{actualIdx, actualIdx + len(query)})
			start = actualIdx + 1
		}
	}

	return ranges
}

func matchesSearch(message, query string, caseSensitive, isRegex bool) bool {
	if isRegex {
		flags := ""
		if !caseSensitive {
			flags = "(?i)"
		}
		re, err := regexp.Compile(flags + query)
		if err != nil {
			return false
		}
		return re.MatchString(message)
	}
	if caseSensitive {
		return strings.Contains(message, query)
	}
	return strings.Contains(strings.ToLower(message), strings.ToLower(query))
}

// generateUUID generates a UUID for a new log file
func generateUUID() string {
	return uuid.New().String()
}
