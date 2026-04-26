package handlers

import (
	"encoding/json"
	"logvue/service"
	"net/http"
)

type SessionHandler struct {
	logService *service.LogService
}

func NewSessionHandler(ls *service.LogService) *SessionHandler {
	return &SessionHandler{logService: ls}
}

func (h *SessionHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var sessionID string
	if cookie, err := r.Cookie("sessionId"); err == nil {
		sessionID = cookie.Value
	}

	session := h.logService.GetOrCreateSession(sessionID)

	http.SetCookie(w, &http.Cookie{
		Name:     "sessionId",
		Value:    session.ID,
		Path:     "/",
		MaxAge:   86400,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"sessionId": session.ID})
}
