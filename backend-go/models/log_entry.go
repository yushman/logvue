package models

// Timestamp represents structured time with seconds and nanos
type Timestamp struct {
	Seconds int64 `json:"seconds"`
	Nanos   int   `json:"nanos"`
}

// LogHeader contains metadata for each log entry
type LogHeader struct {
	LogLevel     string    `json:"logLevel"`
	PID          int       `json:"pid"`
	TID          int       `json:"tid"`
	ApplicationID string   `json:"applicationId,omitempty"`
	ProcessName  string   `json:"processName,omitempty"`
	Tag          string   `json:"tag,omitempty"`
	Timestamp    Timestamp `json:"timestamp"`
	ThreadName   string   `json:"threadName,omitempty"`
}

// LogEntry represents a single log entry
type LogEntry struct {
	ID        int       `json:"id"`
	Header    LogHeader `json:"header"`
	Message   string    `json:"message"`
	Timestamp int64     `json:"timestamp"`
}

// TagCount represents tag usage statistics
type TagCount struct {
	Tag   string `json:"tag"`
	Count int    `json:"count"`
}

// FilterRequest is the request object for filtering logs
type FilterRequest struct {
	FileID             string   `json:"fileId"`
	Levels             []string `json:"levels"`
	TagPattern         string   `json:"tagPattern"`
	TagRegex           bool     `json:"tagRegex"`
	ContentFilter      string   `json:"contentFilter"`
	SearchQuery        string   `json:"searchQuery,omitempty"`
	SearchCaseSensitive bool   `json:"searchCaseSensitive"`
	SearchRegex        bool     `json:"searchRegex"`
	TimeFrom           *int64   `json:"timeFrom,omitempty"`
	TimeTo             *int64   `json:"timeTo,omitempty"`
	HiddenTags         string   `json:"hiddenTags"`
	Offset             int      `json:"offset"`
	Limit              int      `json:"limit"`
}

// FilterResponse is the response object from filtering
type FilterResponse struct {
	Entries               []LogEntry                       `json:"entries"`
	Total                 int                             `json:"total"`
	HasMore               bool                            `json:"hasMore"`
	SearchHighlightRanges map[string][][]int              `json:"searchHighlightRanges"`
	LevelCounts           map[string]int                  `json:"levelCounts"`
	TagCounts             []TagCount                      `json:"tagCounts"`
}
