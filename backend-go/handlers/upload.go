package handlers

import (
	"encoding/json"
	"logvue/models"
	"logvue/service"
	"net/http"
)

type UploadHandler struct {
	logService *service.LogService
}

func NewUploadHandler(ls *service.LogService) *UploadHandler {
	return &UploadHandler{logService: ls}
}

func (h *UploadHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := r.ParseMultipartForm(500 * 1024 * 1024); err != nil {
		http.Error(w, "File too large or invalid request", http.StatusRequestEntityTooLarge)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "No file provided", http.StatusBadRequest)
		return
	}
	defer file.Close()

	bytes := make([]byte, service.MaxFileSize+1)
	n, err := file.Read(bytes)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}
	bytes = bytes[:n]

	fileName := r.FormValue("fileName")
	if fileName == "" {
		fileName = "unknown"
	}

	response, err := h.logService.UploadLogFile(bytes, fileName)
	if err != nil {
		if _, ok := err.(*models.FileTooLargeException); ok {
			http.Error(w, err.Error(), http.StatusRequestEntityTooLarge)
			return
		}
		if _, ok := err.(*models.MalformedJsonException); ok {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		http.Error(w, "Failed to parse log file", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
