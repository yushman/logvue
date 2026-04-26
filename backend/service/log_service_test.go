package service

import (
	"errors"
	"logvue/models"
	"logvue/parser"
	"sync"
	"testing"
)

// mockParser implements parser.LogParser for testing
type mockParser struct {
	result *parser.ParseResult
	err    error
}

func (m *mockParser) Parse(bytes []byte, fileName string) (*parser.ParseResult, error) {
	return m.result, m.err
}

func makeTestEntries() []models.LogEntry {
	ts := int64(1710000000000)
	return []models.LogEntry{
		{ID: 0, Message: "Info message", Timestamp: ts, Header: models.LogHeader{LogLevel: "INFO", Tag: "TagA", PID: 100, TID: 200}},
		{ID: 1, Message: "Debug message", Timestamp: ts + 1000, Header: models.LogHeader{LogLevel: "DEBUG", Tag: "TagA", PID: 100, TID: 200}},
		{ID: 2, Message: "Warn message", Timestamp: ts + 2000, Header: models.LogHeader{LogLevel: "WARN", Tag: "TagB", PID: 101, TID: 201}},
		{ID: 3, Message: "Error message", Timestamp: ts + 3000, Header: models.LogHeader{LogLevel: "ERROR", Tag: "TagB", PID: 101, TID: 201}},
		{ID: 4, Message: "Verbose message", Timestamp: ts + 4000, Header: models.LogHeader{LogLevel: "VERBOSE", Tag: "TagC", PID: 102, TID: 202}},
	}
}

func makeTestParseResult() *parser.ParseResult {
	return &parser.ParseResult{
		Metadata: models.LogFileMetadata{
			DeviceName: "TestDevice",
			LogCount:   5,
			TimeRange: models.TimeRange{
				StartTimestamp: 1710000000000,
				EndTimestamp:   1710000004000,
			},
		},
		Entries: makeTestEntries(),
	}
}

func TestValidateSessionFileAccess(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, err := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	if err != nil {
		t.Fatalf("UploadLogFile() error = %v", err)
	}
	realFileID := resp.FileID

	t.Run("valid session and file returns true", func(t *testing.T) {
		if !svc.ValidateSessionFileAccess(session.ID, realFileID) {
			t.Error("ValidateSessionFileAccess() = false, want true")
		}
	})

	t.Run("invalid session returns false", func(t *testing.T) {
		if svc.ValidateSessionFileAccess("invalid-session", realFileID) {
			t.Error("ValidateSessionFileAccess() = true, want false for invalid session")
		}
	})

	t.Run("invalid file returns false", func(t *testing.T) {
		if svc.ValidateSessionFileAccess(session.ID, "invalid-file") {
			t.Error("ValidateSessionFileAccess() = true, want false for invalid file")
		}
	})

	t.Run("empty session returns false", func(t *testing.T) {
		if svc.ValidateSessionFileAccess("", realFileID) {
			t.Error("ValidateSessionFileAccess() = true, want false for empty session")
		}
	})
}

func TestFilterLogs_LevelFilter(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("filter by single level", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Levels: []string{"INFO"},
		})
		if result.Total != 1 {
			t.Errorf("Total = %d, want 1", result.Total)
		}
		if len(result.Entries) != 1 {
			t.Errorf("len(Entries) = %d, want 1", len(result.Entries))
		}
		if result.Entries[0].Header.LogLevel != "INFO" {
			t.Errorf("LogLevel = %q, want %q", result.Entries[0].Header.LogLevel, "INFO")
		}
	})

	t.Run("filter by multiple levels", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Levels: []string{"INFO", "DEBUG"},
		})
		if result.Total != 2 {
			t.Errorf("Total = %d, want 2", result.Total)
		}
	})

	t.Run("filter by lowercase level", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Levels: []string{"info"},
		})
		if result.Total != 1 {
			t.Errorf("Total = %d, want 1 (case insensitive)", result.Total)
		}
	})

	t.Run("filter by nonexistent level", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Levels: []string{"FATAL"},
		})
		if result.Total != 0 {
			t.Errorf("Total = %d, want 0", result.Total)
		}
	})
}

func TestFilterLogs_TagFilter(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("filter by tag pattern (pipe separated)", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:       fileID,
			TagPattern:   "TagA|TagB",
			TagRegex:     false,
		})
		if result.Total != 4 {
			t.Errorf("Total = %d, want 4", result.Total)
		}
	})

	t.Run("filter by tag regex", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:       fileID,
			TagPattern:   "Tag[AB]",
			TagRegex:     true,
		})
		if result.Total != 4 {
			t.Errorf("Total = %d, want 4", result.Total)
		}
	})

	t.Run("filter by hidden tags", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:      fileID,
			HiddenTags:  "TagA",
		})
		if result.Total != 3 {
			t.Errorf("Total = %d, want 3", result.Total)
		}
	})

	t.Run("tag filter is case insensitive", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:       fileID,
			TagPattern:   "taga|tagb",
			TagRegex:     false,
		})
		if result.Total != 4 {
			t.Errorf("Total = %d, want 4", result.Total)
		}
	})
}

func TestFilterLogs_ContentFilter(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("filter by content", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:         fileID,
			ContentFilter:  "message",
		})
		if result.Total != 5 {
			t.Errorf("Total = %d, want 5 (all contain 'message')", result.Total)
		}
	})

	t.Run("content filter is case insensitive", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:         fileID,
			ContentFilter:  "MESSAGE",
		})
		if result.Total != 5 {
			t.Errorf("Total = %d, want 5", result.Total)
		}
	})

	t.Run("content filter with no matches", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:         fileID,
			ContentFilter:  "nonexistent",
		})
		if result.Total != 0 {
			t.Errorf("Total = %d, want 0", result.Total)
		}
	})
}

func TestFilterLogs_TimeRange(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	baseTs := int64(1710000000000)
	timeFrom := baseTs + 1000
	timeTo := baseTs + 3000

	t.Run("filter by time range", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:   fileID,
			TimeFrom: &timeFrom,
			TimeTo:   &timeTo,
		})
		if result.Total != 3 {
			t.Errorf("Total = %d, want 3", result.Total)
		}
	})

	t.Run("filter by timeFrom only", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:   fileID,
			TimeFrom: &timeFrom,
		})
		if result.Total != 4 {
			t.Errorf("Total = %d, want 4", result.Total)
		}
	})

	t.Run("filter by timeTo only", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			TimeTo: &timeTo,
		})
		if result.Total != 4 {
			t.Errorf("Total = %d, want 4", result.Total)
		}
	})
}

func TestFilterLogs_Pagination(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("default limit is 200", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
		})
		if result.Total != 5 {
			t.Errorf("Total = %d, want 5", result.Total)
		}
	})

	t.Run("offset and limit", func(t *testing.T) {
		offset := 1
		limit := 2
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Offset: offset,
			Limit:  limit,
		})
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
		if result.Total != 5 {
			t.Errorf("Total = %d, want 5 (unchanged by pagination)", result.Total)
		}
	})

	t.Run("offset beyond length returns empty", func(t *testing.T) {
		offset := 100
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Offset: offset,
			Limit:  10,
		})
		if len(result.Entries) != 0 {
			t.Errorf("len(Entries) = %d, want 0", len(result.Entries))
		}
	})

	t.Run("negative offset treated as 0", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Offset: -1,
			Limit:  10,
		})
		if len(result.Entries) != 5 {
			t.Errorf("len(Entries) = %d, want 5", len(result.Entries))
		}
	})

	t.Run("HasMore is true when more entries exist", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Offset: 0,
			Limit:  2,
		})
		if !result.HasMore {
			t.Error("HasMore = false, want true")
		}
	})

	t.Run("HasMore is false at end", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID: fileID,
			Offset: 4,
			Limit:  2,
		})
		if result.HasMore {
			t.Error("HasMore = true, want false")
		}
	})
}

func TestFilterLogs_Search(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("search by query", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:       fileID,
			SearchQuery:  "Debug",
		})
		if result.Total != 1 {
			t.Errorf("Total = %d, want 1", result.Total)
		}
	})

	t.Run("search is case insensitive by default", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:       fileID,
			SearchQuery:  "debug",
		})
		if result.Total != 1 {
			t.Errorf("Total = %d, want 1", result.Total)
		}
	})

	t.Run("search with regex", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:       fileID,
			SearchQuery:  "Info|Error",
			SearchRegex:  true,
		})
		if result.Total != 2 {
			t.Errorf("Total = %d, want 2", result.Total)
		}
	})

	t.Run("search with case sensitivity", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:             fileID,
			SearchQuery:        "info",
			SearchCaseSensitive: true,
		})
		if result.Total != 0 {
			t.Errorf("Total = %d, want 0 (case sensitive, 'info' != 'Info')", result.Total)
		}
	})

	t.Run("search highlights ranges", func(t *testing.T) {
		result := svc.FilterLogs(session.ID, models.FilterRequest{
			FileID:       fileID,
			SearchQuery:  "message",
		})
		if len(result.SearchHighlightRanges) == 0 {
			t.Error("SearchHighlightRanges is empty, want non-empty")
		}
	})
}

func TestFilterLogs_LevelCounts(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	result := svc.FilterLogs(session.ID, models.FilterRequest{
		FileID: fileID,
		Levels: []string{"INFO", "DEBUG", "WARN", "ERROR"},
	})

	if result.LevelCounts["INFO"] != 1 {
		t.Errorf("LevelCounts[INFO] = %d, want 1", result.LevelCounts["INFO"])
	}
	if result.LevelCounts["DEBUG"] != 1 {
		t.Errorf("LevelCounts[DEBUG] = %d, want 1", result.LevelCounts["DEBUG"])
	}
	if result.LevelCounts["WARN"] != 1 {
		t.Errorf("LevelCounts[WARN] = %d, want 1", result.LevelCounts["WARN"])
	}
	if result.LevelCounts["ERROR"] != 1 {
		t.Errorf("LevelCounts[ERROR] = %d, want 1", result.LevelCounts["ERROR"])
	}
	if result.LevelCounts["VERBOSE"] != 0 {
		t.Errorf("LevelCounts[VERBOSE] = %d, want 0", result.LevelCounts["VERBOSE"])
	}
}

func TestFilterLogs_TagCounts(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	result := svc.FilterLogs(session.ID, models.FilterRequest{
		FileID: fileID,
	})

	if len(result.TagCounts) == 0 {
		t.Error("TagCounts is empty, want non-empty")
	}
}

func TestFilterLogs_NilSession(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	result := svc.FilterLogs("nonexistent-session", models.FilterRequest{
		FileID: "any-file",
	})
	if len(result.Entries) != 0 {
		t.Errorf("len(Entries) = %d, want 0 for nonexistent session", len(result.Entries))
	}
}

func TestGetTimeline(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("returns buckets", func(t *testing.T) {
		numBuckets := 5
		result := svc.GetTimeline(session.ID, models.TimelineRequest{
			FileID:     fileID,
			NumBuckets: &numBuckets,
		})
		if len(result.Buckets) != 5 {
			t.Errorf("len(Buckets) = %d, want 5", len(result.Buckets))
		}
	})

	t.Run("default numBuckets is 20", func(t *testing.T) {
		result := svc.GetTimeline(session.ID, models.TimelineRequest{
			FileID: fileID,
		})
		if len(result.Buckets) != 20 {
			t.Errorf("len(Buckets) = %d, want 20 (default)", len(result.Buckets))
		}
	})

	t.Run("nil session returns empty response", func(t *testing.T) {
		result := svc.GetTimeline("nonexistent-session", models.TimelineRequest{
			FileID: fileID,
		})
		if len(result.Buckets) != 0 {
			t.Errorf("len(Buckets) = %d, want 0 for nonexistent session", len(result.Buckets))
		}
	})

	t.Run("tag colors are assigned", func(t *testing.T) {
		result := svc.GetTimeline(session.ID, models.TimelineRequest{
			FileID: fileID,
		})
		if len(result.TagColors) == 0 {
			t.Error("TagColors is empty, want non-empty")
		}
		for tag, color := range result.TagColors {
			if color == "" {
				t.Errorf("TagColors[%q] is empty", tag)
			}
		}
	})

	t.Run("time range override", func(t *testing.T) {
		baseTs := int64(1710000000000)
		timeFrom := baseTs + 1000
		timeTo := baseTs + 3000
		result := svc.GetTimeline(session.ID, models.TimelineRequest{
			FileID:     fileID,
			TimeFrom:   &timeFrom,
			TimeTo:     &timeTo,
		})
		if result.TimeRange.StartTimestamp != timeFrom {
			t.Errorf("TimeRange.StartTimestamp = %d, want %d", result.TimeRange.StartTimestamp, timeFrom)
		}
	})
}

func TestGetEntry(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("valid entry", func(t *testing.T) {
		entry := svc.GetEntry(session.ID, fileID, 0)
		if entry == nil {
			t.Fatal("GetEntry() returned nil, want entry")
		}
		if entry.ID != 0 {
			t.Errorf("entry.ID = %d, want 0", entry.ID)
		}
	})

	t.Run("nonexistent entry returns nil", func(t *testing.T) {
		entry := svc.GetEntry(session.ID, fileID, 999)
		if entry != nil {
			t.Errorf("GetEntry() = %v, want nil", entry)
		}
	})

	t.Run("nonexistent session returns nil", func(t *testing.T) {
		entry := svc.GetEntry("nonexistent", fileID, 0)
		if entry != nil {
			t.Error("GetEntry() = non-nil, want nil for nonexistent session")
		}
	})

	t.Run("nonexistent file returns nil", func(t *testing.T) {
		entry := svc.GetEntry(session.ID, "nonexistent-file", 0)
		if entry != nil {
			t.Error("GetEntry() = non-nil, want nil for nonexistent file")
		}
	})
}

func TestGetMetadata(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	t.Run("returns tag colors", func(t *testing.T) {
		colors := svc.GetMetadata(session.ID, fileID)
		if colors == nil {
			t.Fatal("GetMetadata() returned nil, want map")
		}
		if len(colors) == 0 {
			t.Error("len(colors) = 0, want non-empty")
		}
	})

	t.Run("nil session returns nil", func(t *testing.T) {
		colors := svc.GetMetadata("nonexistent-session", fileID)
		if colors != nil {
			t.Error("GetMetadata() = non-nil, want nil for nonexistent session")
		}
	})
}

func TestUploadLogFile_Errors(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")

	t.Run("file too large returns error", func(t *testing.T) {
		tooLarge := make([]byte, MaxFileSize+1)
		_, err := svc.UploadLogFile(tooLarge, "test.json", session.ID)
		if err == nil {
			t.Error("UploadLogFile() expected error for file too large, got nil")
		}
		if _, ok := err.(*models.FileTooLargeException); !ok {
			t.Errorf("error type = %T, want *FileTooLargeException", err)
		}
	})

	t.Run("parser error returns MalformedJsonException", func(t *testing.T) {
		badParser := &mockParser{err: errors.New("parse failed")}
		badSvc := NewLogService(badParser)
		badSession := badSvc.GetOrCreateSession("")
		_, err := badSvc.UploadLogFile([]byte("bad data"), "test.json", badSession.ID)
		if err == nil {
			t.Error("UploadLogFile() expected error for parse failure, got nil")
		}
		if _, ok := err.(*models.MalformedJsonException); !ok {
			t.Errorf("error type = %T, want *MalformedJsonException", err)
		}
	})
}

func TestHashString(t *testing.T) {
	t.Run("consistent hash for same string", func(t *testing.T) {
		h1 := hashString("TagA")
		h2 := hashString("TagA")
		if h1 != h2 {
			t.Errorf("hashString() = %d and %d, want equal", h1, h2)
		}
	})

	t.Run("different hashes for different strings", func(t *testing.T) {
		h1 := hashString("TagA")
		h2 := hashString("TagB")
		if h1 == h2 {
			t.Errorf("hashString() = %d for both, want different", h1)
		}
	})

	t.Run("non-negative hash", func(t *testing.T) {
		h := hashString("any string")
		if h < 0 {
			t.Errorf("hashString() = %d, want non-negative", h)
		}
	})

	t.Run("empty string hash", func(t *testing.T) {
		h := hashString("")
		if h < 0 {
			t.Errorf("hashString() = %d, want non-negative", h)
		}
	})
}

func TestComputeHighlightRanges(t *testing.T) {
	t.Run("basic substring match", func(t *testing.T) {
		ranges := computeHighlightRanges("hello world hello", "hello", false, false)
		if len(ranges) != 2 {
			t.Errorf("len(ranges) = %d, want 2", len(ranges))
		}
		if ranges[0][0] != 0 || ranges[0][1] != 5 {
			t.Errorf("ranges[0] = %v, want [0 5]", ranges[0])
		}
		if ranges[1][0] != 12 || ranges[1][1] != 17 {
			t.Errorf("ranges[1] = %v, want [12 17]", ranges[1])
		}
	})

	t.Run("case insensitive match", func(t *testing.T) {
		ranges := computeHighlightRanges("Hello hello HELLO", "hello", false, false)
		if len(ranges) != 3 {
			t.Errorf("len(ranges) = %d, want 3", len(ranges))
		}
	})

	t.Run("case sensitive match", func(t *testing.T) {
		ranges := computeHighlightRanges("Hello hello", "Hello", true, false)
		if len(ranges) != 1 {
			t.Errorf("len(ranges) = %d, want 1", len(ranges))
		}
	})

	t.Run("regex match", func(t *testing.T) {
		ranges := computeHighlightRanges("hello world 123", "hello|world", false, true)
		if len(ranges) != 2 {
			t.Errorf("len(ranges) = %d, want 2", len(ranges))
		}
	})

	t.Run("no match returns empty", func(t *testing.T) {
		ranges := computeHighlightRanges("hello world", "xyz", false, false)
		if len(ranges) != 0 {
			t.Errorf("len(ranges) = %d, want 0", len(ranges))
		}
	})

	t.Run("invalid regex returns nil", func(t *testing.T) {
		ranges := computeHighlightRanges("hello world", "[", false, true)
		if ranges != nil {
			t.Errorf("ranges = %v, want nil for invalid regex", ranges)
		}
	})
}

func TestMatchesSearch(t *testing.T) {
	t.Run("basic substring match", func(t *testing.T) {
		if !matchesSearch("hello world", "hello", false, false) {
			t.Error("matchesSearch() = false, want true")
		}
	})

	t.Run("no match", func(t *testing.T) {
		if matchesSearch("hello world", "xyz", false, false) {
			t.Error("matchesSearch() = true, want false")
		}
	})

	t.Run("case insensitive by default", func(t *testing.T) {
		if !matchesSearch("Hello World", "hello", false, false) {
			t.Error("matchesSearch() = false, want true (case insensitive)")
		}
	})

	t.Run("case sensitive", func(t *testing.T) {
		if matchesSearch("Hello World", "hello", true, false) {
			t.Error("matchesSearch() = true, want false (case sensitive)")
		}
	})

	t.Run("regex match", func(t *testing.T) {
		if !matchesSearch("hello world 123", "hello|world", false, true) {
			t.Error("matchesSearch() = false, want true (regex)")
		}
	})

	t.Run("invalid regex returns false", func(t *testing.T) {
		if matchesSearch("hello world", "[", false, true) {
			t.Error("matchesSearch() = true, want false (invalid regex)")
		}
	})
}

func TestLogService_Concurrent(t *testing.T) {
	p := &mockParser{result: makeTestParseResult()}
	svc := NewLogService(p)

	session := svc.GetOrCreateSession("")
	resp, _ := svc.UploadLogFile([]byte(`{}`), "test.json", session.ID)
	fileID := resp.FileID

	var wg sync.WaitGroup
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			svc.FilterLogs(session.ID, models.FilterRequest{FileID: fileID, Levels: []string{"INFO"}})
			svc.ValidateSessionFileAccess(session.ID, fileID)
		}()
	}
	wg.Wait()
}

var _ = parser.LogParser(&mockParser{})
