package handlers

import (
	"encoding/json"
	"logvue/service"
	"net/http"
)

type MetadataHandler struct {
	logService *service.LogService
}

func NewMetadataHandler(ls *service.LogService) *MetadataHandler {
	return &MetadataHandler{logService: ls}
}

func (h *MetadataHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fileID := r.URL.Query().Get("fileId")
	if fileID == "" {
		http.Error(w, "fileId is required", http.StatusBadRequest)
		return
	}

	sessionID := ""
	if cookie, err := r.Cookie("sessionId"); err == nil {
		sessionID = cookie.Value
	}

	if !h.logService.ValidateSessionFileAccess(sessionID, fileID) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	metadata := h.logService.GetMetadata(sessionID, fileID)
	if metadata == nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(metadata)
}
