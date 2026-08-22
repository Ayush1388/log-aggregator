package models

import "time"

//LogPayload repesents the structure of the incoming JSON log
type LogPayload struct {
	ServiceName string         `json:"service_name"`
	LogLevel    string         `json:"log_level"`
	Message     string         `json:"message"`
	Timestamp   time.Time      `json:"timestamp"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}
