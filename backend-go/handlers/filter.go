package handlers

import (
	"encoding/json"
	"logvue/models"
	"logvue/service"
	"net/http"
)

type FilterHandler struct {
	logService *service.LogService
}

func NewFilterHandler(ls *service.LogService) *FilterHandler {
	return &FilterHandler{logService: ls}
}

func (h *FilterHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var request models.FilterRequest
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	sessionID := ""
	if cookie, err := r.Cookie("sessionId"); err == nil {
		sessionID = cookie.Value
	}

	if !h.logService.ValidateSessionFileAccess(sessionID, request.FileID) {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}

	response := h.logService.FilterLogs(sessionID, request)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
