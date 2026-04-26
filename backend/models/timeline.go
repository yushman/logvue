package models

// TimelineRequest is the request for timeline buckets
type TimelineRequest struct {
	FileID      string `json:"fileId"`
	NumBuckets  *int   `json:"numBuckets,omitempty"`
	TimeFrom    *int64 `json:"timeFrom,omitempty"`
	TimeTo      *int64 `json:"timeTo,omitempty"`
}

// TimelineBucket represents a single time bucket
type TimelineBucket struct {
	Timestamp int64          `json:"timestamp"`
	Count     int            `json:"count"`
	Tags      map[string]int `json:"tags"`
}

// TimelineResponse is the timeline with buckets and colors
type TimelineResponse struct {
	TimeRange TimeRange            `json:"timeRange"`
	Buckets   []TimelineBucket     `json:"buckets"`
	TagColors map[string]string   `json:"tagColors"`
}
