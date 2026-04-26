package parser

import (
	"encoding/json"
	"errors"
	"logvue/models"
)

// AndroidLogcatParser parses Android logcat JSON format (new + legacy)
type AndroidLogcatParser struct{}

func NewAndroidLogcatParser() *AndroidLogcatParser {
	return &AndroidLogcatParser{}
}

// NewFormat is the new Android logcat JSON format
type NewFormat struct {
	Metadata struct {
		Device struct {
			EmulatorDevice struct {
				AVDName string `json:"avdName"`
				AVDPath string `json:"avdPath"`
				Release string `json:"release"`
				APILevel *struct {
					Number int `json:"number"`
				} `json:"apiLevel"`
			} `json:"emulatorDevice"`
		} `json:"device"`
		ProjectApplicationIds []string `json:"projectApplicationIds"`
		Filter                string   `json:"filter"`
	} `json:"metadata"`
	LogcatMessages []struct {
		Header struct {
			Timestamp struct {
				Seconds int64 `json:"seconds"`
				Nanos   int    `json:"nanos"`
			} `json:"timestamp"`
			LogLevel     string `json:"logLevel"`
			PID          int    `json:"pid"`
			TID          int    `json:"tid"`
			ApplicationID string `json:"applicationId"`
			ProcessName string `json:"processName"`
			Tag          string `json:"tag"`
		} `json:"header"`
		Message string `json:"message"`
	} `json:"logcatMessages"`
}

// LegacyFormat is the legacy Android logcat JSON format
type LegacyFormat struct {
	Log struct {
		Event []struct {
			Header struct {
				Timestamp struct {
					Seconds int64 `json:"seconds"`
					Nanos   int    `json:"nanos"`
				} `json:"timestamp"`
				LogLevel     string `json:"logLevel"`
				PID          int    `json:"pid"`
				TID          int    `json:"tid"`
				ApplicationID string `json:"applicationId"`
				ProcessName string `json:"processName"`
				Tag          string `json:"tag"`
			} `json:"header"`
			Message string `json:"message"`
		} `json:"event"`
		Device struct {
			Name     string `json:"name"`
			AVDPath  string `json:"avdPath"`
			Release  string `json:"release"`
			APILevel int    `json:"apiLevel"`
		} `json:"device"`
		ApplicationID []string `json:"applicationId"`
		Filter        string   `json:"filter"`
	} `json:"log"`
}

func (p *AndroidLogcatParser) Parse(bytes []byte, fileName string) (*ParseResult, error) {
	// Try new format first
	var newFormat NewFormat
	if err := json.Unmarshal(bytes, &newFormat); err == nil {
		if len(newFormat.Metadata.Device.EmulatorDevice.AVDName) > 0 || len(newFormat.LogcatMessages) > 0 {
			return p.parseNewFormat(&newFormat)
		}
	}

	// Try legacy format
	var legacyFormat LegacyFormat
	if err := json.Unmarshal(bytes, &legacyFormat); err == nil {
		if len(legacyFormat.Log.Event) > 0 || len(legacyFormat.Log.Device.Name) > 0 {
			return p.parseLegacyFormat(&legacyFormat)
		}
	}

	return nil, errors.New("invalid Android JSON format")
}

func (p *AndroidLogcatParser) parseNewFormat(f *NewFormat) (*ParseResult, error) {
	device := f.Metadata.Device.EmulatorDevice
	entries := make([]models.LogEntry, 0, len(f.LogcatMessages))

	for i, msg := range f.LogcatMessages {
		entries = append(entries, models.LogEntry{
			ID: i,
			Header: models.LogHeader{
				LogLevel:     msg.Header.LogLevel,
				PID:          msg.Header.PID,
				TID:          msg.Header.TID,
				ApplicationID: msg.Header.ApplicationID,
				ProcessName:  msg.Header.ProcessName,
				Tag:          msg.Header.Tag,
				Timestamp: models.Timestamp{
					Seconds: msg.Header.Timestamp.Seconds,
					Nanos:   msg.Header.Timestamp.Nanos,
				},
			},
			Message:   msg.Message,
			Timestamp: msg.Header.Timestamp.Seconds*1000 + int64(msg.Header.Timestamp.Nanos/1_000_000),
		})
	}

	var timeRange models.TimeRange
	if len(entries) > 0 {
		timeRange = models.TimeRange{
			StartTimestamp: entries[0].Timestamp,
			EndTimestamp:   entries[len(entries)-1].Timestamp,
		}
	}

	metadata := models.LogFileMetadata{
		DeviceName:    device.AVDName,
		AVDPath:       device.AVDPath,
		Release:       device.Release,
		APILevel:      getIntOrDefault(device.APILevel),
		ApplicationIDs: f.Metadata.ProjectApplicationIds,
		Filter:        f.Metadata.Filter,
		LogCount:      len(entries),
		TimeRange:     timeRange,
	}

	return &ParseResult{Metadata: metadata, Entries: entries}, nil
}

func (p *AndroidLogcatParser) parseLegacyFormat(f *LegacyFormat) (*ParseResult, error) {
	entries := make([]models.LogEntry, 0, len(f.Log.Event))

	for i, event := range f.Log.Event {
		entries = append(entries, models.LogEntry{
			ID: i,
			Header: models.LogHeader{
				LogLevel:     event.Header.LogLevel,
				PID:          event.Header.PID,
				TID:          event.Header.TID,
				ApplicationID: event.Header.ApplicationID,
				ProcessName: event.Header.ProcessName,
				Tag:          event.Header.Tag,
				Timestamp: models.Timestamp{
					Seconds: event.Header.Timestamp.Seconds,
					Nanos:   event.Header.Timestamp.Nanos,
				},
			},
			Message:   event.Message,
			Timestamp: event.Header.Timestamp.Seconds*1000 + int64(event.Header.Timestamp.Nanos/1_000_000),
		})
	}

	var timeRange models.TimeRange
	if len(entries) > 0 {
		timeRange = models.TimeRange{
			StartTimestamp: entries[0].Timestamp,
			EndTimestamp:   entries[len(entries)-1].Timestamp,
		}
	}

	deviceName := f.Log.Device.Name
	if deviceName == "" {
		deviceName = "Unknown Device"
	}

	metadata := models.LogFileMetadata{
		DeviceName:    deviceName,
		AVDPath:       f.Log.Device.AVDPath,
		Release:       f.Log.Device.Release,
		APILevel:      f.Log.Device.APILevel,
		ApplicationIDs: f.Log.ApplicationID,
		Filter:        f.Log.Filter,
		LogCount:      len(entries),
		TimeRange:     timeRange,
	}

	return &ParseResult{Metadata: metadata, Entries: entries}, nil
}

func getIntOrDefault(apiLevel *struct {
	Number int `json:"number"`
}) int {
	if apiLevel != nil {
		return apiLevel.Number
	}
	return 0
}
