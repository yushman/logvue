package parser

import (
	"testing"
)

func TestAndroidLogcatParser_Parse(t *testing.T) {
	parser := NewAndroidLogcatParser()

	t.Run("new format with logcatMessages", func(t *testing.T) {
		input := `{
			"metadata": {
				"device": {
					"emulatorDevice": {
						"avdName": "test_device",
						"avdPath": "/path/to/avd",
						"release": "14",
						"apiLevel": { "number": 34 }
					}
				},
				"projectApplicationIds": ["com.example.app"],
				"filter": "tag:ActivityManager"
			},
			"logcatMessages": [
				{
					"header": {
						"timestamp": { "seconds": 1710000000, "nanos": 123000000 },
						"logLevel": "INFO",
						"pid": 1234,
						"tid": 5678,
						"applicationId": "com.example.app",
						"processName": "com.example.app",
						"tag": "ActivityManager"
					},
					"message": "Application started"
				},
				{
					"header": {
						"timestamp": { "seconds": 1710000001, "nanos": 0 },
						"logLevel": "DEBUG",
						"pid": 1234,
						"tid": 5678,
						"applicationId": "com.example.app",
						"processName": "com.example.app",
						"tag": "MyApp"
					},
					"message": "Processing request"
				}
			]
		}`
		result, err := parser.Parse([]byte(input), "test.json")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 2 {
			t.Errorf("len(Entries) = %d, want 2", len(result.Entries))
		}
		if result.Metadata.DeviceName != "test_device" {
			t.Errorf("DeviceName = %q, want %q", result.Metadata.DeviceName, "test_device")
		}
		if result.Metadata.LogCount != 2 {
			t.Errorf("LogCount = %d, want 2", result.Metadata.LogCount)
		}
		if result.Entries[0].Header.LogLevel != "INFO" {
			t.Errorf("Entries[0].Header.LogLevel = %q, want %q", result.Entries[0].Header.LogLevel, "INFO")
		}
	})

	t.Run("new format with empty logcatMessages", func(t *testing.T) {
		input := `{
			"metadata": {
				"device": {
					"emulatorDevice": {
						"avdName": "test_device",
						"avdPath": "/path/to/avd",
						"release": "14",
						"apiLevel": { "number": 34 }
					}
				}
			},
			"logcatMessages": []
		}`
		result, err := parser.Parse([]byte(input), "test.json")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 0 {
			t.Errorf("len(Entries) = %d, want 0", len(result.Entries))
		}
	})

	t.Run("new format missing optional fields", func(t *testing.T) {
		input := `{
			"metadata": {
				"device": {
					"emulatorDevice": {}
				}
			},
			"logcatMessages": [
				{
					"header": {
						"timestamp": { "seconds": 1710000000, "nanos": 0 },
						"logLevel": "INFO",
						"tag": "TestTag"
					},
					"message": "test"
				}
			]
		}`
		result, err := parser.Parse([]byte(input), "test.json")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 1 {
			t.Errorf("len(Entries) = %d, want 1", len(result.Entries))
		}
		if result.Metadata.AVDPath != "" {
			t.Errorf("AVDPath = %q, want %q", result.Metadata.AVDPath, "")
		}
	})

	t.Run("legacy format with events", func(t *testing.T) {
		input := `{
			"log": {
				"event": [
					{
						"header": {
							"timestamp": { "seconds": 1710000000, "nanos": 500000000 },
							"logLevel": "WARN",
							"pid": 1000,
							"tid": 2000,
							"applicationId": "com.test.app",
							"processName": "test",
							"tag": "LegacyTag"
						},
						"message": "Warning message"
					}
				],
				"device": {
					"name": "Legacy Device",
					"avdPath": "/legacy/path",
					"release": "13",
					"apiLevel": 33
				},
				"applicationId": ["com.test.app"],
				"filter": "*:V"
			}
		}`
		result, err := parser.Parse([]byte(input), "legacy.json")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if len(result.Entries) != 1 {
			t.Errorf("len(Entries) = %d, want 1", len(result.Entries))
		}
		if result.Metadata.DeviceName != "Legacy Device" {
			t.Errorf("DeviceName = %q, want %q", result.Metadata.DeviceName, "Legacy Device")
		}
		if result.Entries[0].Header.LogLevel != "WARN" {
			t.Errorf("LogLevel = %q, want %q", result.Entries[0].Header.LogLevel, "WARN")
		}
	})

	t.Run("legacy format with empty device name uses Unknown Device", func(t *testing.T) {
		input := `{
			"log": {
				"event": [
					{
						"header": {
							"timestamp": { "seconds": 1710000000, "nanos": 0 },
							"logLevel": "INFO",
							"tag": "Tag"
						},
						"message": "test"
					}
				],
				"device": { "name": "" }
			}
		}`
		result, err := parser.Parse([]byte(input), "legacy.json")
		if err != nil {
			t.Fatalf("Parse() error = %v", err)
		}
		if result.Metadata.DeviceName != "Unknown Device" {
			t.Errorf("DeviceName = %q, want %q", result.Metadata.DeviceName, "Unknown Device")
		}
	})

	t.Run("invalid JSON returns error", func(t *testing.T) {
		_, err := parser.Parse([]byte("not json"), "test.json")
		if err == nil {
			t.Error("Parse() expected error for invalid JSON, got nil")
		}
	})

	t.Run("neither new nor legacy format returns error", func(t *testing.T) {
		input := `{"some": "other format"}`
		_, err := parser.Parse([]byte(input), "test.json")
		if err == nil {
			t.Error("Parse() expected error for unrecognized format, got nil")
		}
	})

	t.Run("empty input returns error", func(t *testing.T) {
		_, err := parser.Parse([]byte(""), "test.json")
		if err == nil {
			t.Error("Parse() expected error for empty input, got nil")
		}
	})
}

func TestGetIntOrDefault(t *testing.T) {
	apiLevelType := func(n int) *struct {
		Number int `json:"number"`
	} {
		return &struct {
			Number int `json:"number"`
		}{Number: n}
	}

	t.Run("non-nil apiLevel returns number", func(t *testing.T) {
		if got := getIntOrDefault(apiLevelType(34)); got != 34 {
			t.Errorf("getIntOrDefault() = %d, want 34", got)
		}
	})

	t.Run("nil apiLevel returns zero", func(t *testing.T) {
		if got := getIntOrDefault(nil); got != 0 {
			t.Errorf("getIntOrDefault(nil) = %d, want 0", got)
		}
	})
}

func TestAndroidLogcatParser_Timestamp(t *testing.T) {
	parser := NewAndroidLogcatParser()
	input := `{
		"metadata": {
			"device": { "emulatorDevice": { "avdName": "d" } }
		},
		"logcatMessages": [
			{
				"header": {
					"timestamp": { "seconds": 1710000000, "nanos": 123456789 },
					"logLevel": "INFO",
					"tag": "T"
				},
				"message": "m"
			}
		]
	}`
	result, err := parser.Parse([]byte(input), "test.json")
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	// Timestamp = seconds*1000 + nanos/1_000_000 = 1710000000000 + 123
	wantMs := int64(1710000000*1000 + 123)
	if result.Entries[0].Timestamp != wantMs {
		t.Errorf("Timestamp = %d, want %d", result.Entries[0].Timestamp, wantMs)
	}
}

func TestAndroidLogcatParser_TimeRange(t *testing.T) {
	parser := NewAndroidLogcatParser()
	input := `{
		"metadata": { "device": { "emulatorDevice": { "avdName": "d" } } },
		"logcatMessages": [
			{
				"header": { "timestamp": { "seconds": 1710000000, "nanos": 0 }, "logLevel": "INFO", "tag": "T" },
				"message": "first"
			},
			{
				"header": { "timestamp": { "seconds": 1710000100, "nanos": 0 }, "logLevel": "DEBUG", "tag": "T" },
				"message": "second"
			}
		]
	}`
	result, err := parser.Parse([]byte(input), "test.json")
	if err != nil {
		t.Fatalf("Parse() error = %v", err)
	}
	if result.Metadata.TimeRange.StartTimestamp != 1710000000000 {
		t.Errorf("StartTimestamp = %d, want 1710000000000", result.Metadata.TimeRange.StartTimestamp)
	}
	if result.Metadata.TimeRange.EndTimestamp != 1710000100000 {
		t.Errorf("EndTimestamp = %d, want 1710000100000", result.Metadata.TimeRange.EndTimestamp)
	}
}

