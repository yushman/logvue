package models

// TimeRange represents time boundaries
type TimeRange struct {
	StartTimestamp int64 `json:"startTimestamp"`
	EndTimestamp   int64 `json:"endTimestamp"`
}

// LogFileMetadata contains metadata about an uploaded log file
type LogFileMetadata struct {
	DeviceName    string   `json:"deviceName"`
	AVDPath       string   `json:"avdPath,omitempty"`
	Release       string   `json:"release,omitempty"`
	APILevel      int      `json:"apiLevel,omitempty"`
	ApplicationIDs []string `json:"applicationIds,omitempty"`
	Filter        string   `json:"filter,omitempty"`
	LogCount      int      `json:"logCount"`
	TimeRange     TimeRange `json:"timeRange"`
}

// LogUploadResponse is the response after uploading
type LogUploadResponse struct {
	FileID     string    `json:"fileId"`
	LogCount   int       `json:"logCount"`
	DeviceName string    `json:"deviceName"`
	TimeRange  TimeRange `json:"timeRange"`
}
