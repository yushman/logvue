package handlers

import (
	"encoding/json"
	"logvue/models"
	"logvue/service"
	"net/http"
	"strconv"
)

type TimelineHandler struct {
	logService *service.LogService
}

func NewTimelineHandler(ls *service.LogService) *TimelineHandler {
	return &TimelineHandler{logService: ls}
}

func (h *TimelineHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fileID := r.URL.Query().Get("fileId")
	if fileID == "" {
		http.Error(w, "fileId is required", http.StatusBadRequest)
		return
	}

	numBucketsStr := r.URL.Query().Get("numBuckets")
	var numBuckets *int
	if numBucketsStr != "" {
		if nb, err := strconv.Atoi(numBucketsStr); err == nil {
			numBuckets = &nb
		}
	}

	timeFromStr := r.URL.Query().Get("timeFrom")
	var timeFrom *int64
	if timeFromStr != "" {
		if tf, err := strconv.ParseInt(timeFromStr, 10, 64); err == nil {
			timeFrom = &tf
		}
	}

	timeToStr := r.URL.Query().Get("timeTo")
	var timeTo *int64
	if timeToStr != "" {
		if tt, err := strconv.ParseInt(timeToStr, 10, 64); err == nil {
			timeTo = &tt
		}
	}

	request := models.TimelineRequest{
		FileID:     fileID,
		NumBuckets: numBuckets,
		TimeFrom:   timeFrom,
		TimeTo:     timeTo,
	}

	sessionID := ""
	if cookie, err := r.Cookie("sessionId"); err == nil {
		sessionID = cookie.Value
	}

	if !h.logService.ValidateSessionFileAccess(sessionID, fileID) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	response := h.logService.GetTimeline(sessionID, request)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
