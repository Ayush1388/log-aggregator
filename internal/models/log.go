package models

import "time"

//LogPayload repesents the structure of the incoming JSON log
type LogPayload struct {
	ServiceID string         `json:"service_id"`
	Level    string         `json:"level"`
	Message     string         `json:"message"`
	Timestamp   time.Time      `json:"timestamp"`
	Metadata    map[string]any `json:"metadata,omitempty"`
}
