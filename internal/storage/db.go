package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/Ayush1388/log-aggregator/internal/models"
	_ "github.com/lib/pq"
)

type Storage struct {
	db *sql.DB
}

func NewStorage(dsn string) (*Storage, error) {
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)

	log.Println("Connected to the database successfully")
	return &Storage{db: db}, nil
}

// bulk insert
func (s *Storage) BulkInsert(logs []models.LogPayload) error {
	if len(logs) == 0 {
		return nil
	}
	valueStrings := make([]string, 0, len(logs))
	valueArgs := make([]any, 0, len(logs)*5)

	i := 1
	for _, logItem := range logs {
		placeholder := fmt.Sprintf("($%d, $%d, $%d, $%d,$%d)", i, i+1, i+2, i+3, i+4)
		valueStrings = append(valueStrings, placeholder)

		// CRITICAL FIX: Convert the Go map into a JSON byte array for PostgreSQL JSONB
		metadataBytes, err := json.Marshal(logItem.Metadata)
		if err != nil || logItem.Metadata == nil {
			metadataBytes = []byte("{}") // Fallback to an empty JSON object if empty or failing
		}
		valueArgs = append(valueArgs, logItem.ServiceID, logItem.Level, logItem.Message, logItem.Timestamp, metadataBytes)
		i += 5
	}
	// strings.Join takes ["($1,$2,$3,$4)","($5,$6,$7,$8)"] and joins them into a single string
	stmt := fmt.Sprintf("INSERT INTO logs (service_id, level, message, timestamp,metadata) VALUES %s",
		strings.Join(valueStrings, ","))
	//execute the massive query in one trip of network
	_, err := s.db.Exec(stmt, valueArgs...)
	if err != nil {
		return fmt.Errorf("failed to execute bulk insert: %w", err)
	}
	return nil
}

// to read from the database filter by service_id and level and limit and offset for pagination
// so we dont crash our server by returning too many logs at once
// GetLogs fetches logs with optional filtering and pagination
func (s *Storage) GetLogs(serviceID string, level string, limit int, offset int) ([]models.LogPayload, error) {
	// 1=1 is a SQL trick that makes appending dynamic AND clauses much easier
	query := "SELECT service_id, level, message, timestamp,metadata FROM logs WHERE 1=1"
	args := []any{}
	argID := 1

	if serviceID != "" {
		query += fmt.Sprintf(" AND service_id = $%d", argID)
		args = append(args, serviceID)
		argID++
	}

	if level != "" {
		query += fmt.Sprintf(" AND level = $%d", argID)
		args = append(args, level)
		argID++
	}

	// Always sort by newest logs first
	query += fmt.Sprintf(" ORDER BY timestamp DESC LIMIT $%d OFFSET $%d", argID, argID+1)
	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute query: %w", err)
	}
	defer rows.Close()

	var logs []models.LogPayload
	for rows.Next() {
		var log models.LogPayload
		var rawMetadata []byte
		if err := rows.Scan(&log.ServiceID, &log.Level, &log.Message, &log.Timestamp, &rawMetadata); err != nil {
			return nil, fmt.Errorf("failed to scan row: %w", err)
		}
		if len(rawMetadata) > 0 {
			if err := json.Unmarshal(rawMetadata, &log.Metadata); err != nil {
				fmt.Printf("Warning: failed to unmarshal metadata for log: %v\n", err)
			}
		}
		logs = append(logs, log)
	}

	// Return an empty array instead of 'null' if there are no logs
	if logs == nil {
		logs = []models.LogPayload{}
	}

	return logs, nil
}
