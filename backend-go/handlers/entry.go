package handlers

import (
	"encoding/json"
	"logvue/service"
	"net/http"
	"strconv"
)

type EntryHandler struct {
	logService *service.LogService
}

func NewEntryHandler(ls *service.LogService) *EntryHandler {
	return &EntryHandler{logService: ls}
}

func (h *EntryHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	fileID := r.URL.Query().Get("fileId")
	if fileID == "" {
		http.Error(w, "fileId is required", http.StatusBadRequest)
		return
	}

	entryIDStr := r.URL.Query().Get("entryId")
	if entryIDStr == "" {
		http.Error(w, "entryId is required", http.StatusBadRequest)
		return
	}

	entryID, err := strconv.Atoi(entryIDStr)
	if err != nil {
		http.Error(w, "invalid entryId", http.StatusBadRequest)
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

	entry := h.logService.GetEntry(sessionID, fileID, entryID)
	if entry == nil {
		http.Error(w, "Entry not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(entry)
}
