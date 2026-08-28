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

// BulkInsert inserts a batch of logs in a single database request.
func (s *Storage) BulkInsert(logs []models.LogPayload) error {
	if len(logs) == 0 {
		return nil
	}

	valueStrings := make([]string, 0, len(logs))
	valueArgs := make([]any, 0, len(logs)*5)

	i := 1
	for _, logItem := range logs {
		placeholder := fmt.Sprintf(
			"($%d, $%d, $%d, $%d, $%d)",
			i, i+1, i+2, i+3, i+4,
		)
		valueStrings = append(valueStrings, placeholder)

		metadataBytes, err := json.Marshal(logItem.Metadata)
		if err != nil || logItem.Metadata == nil {
			metadataBytes = []byte("{}")
		}

		valueArgs = append(
			valueArgs,
			logItem.ServiceID,
			logItem.Level,
			logItem.Message,
			logItem.Timestamp,
			metadataBytes,
		)

		i += 5
	}

	stmt := fmt.Sprintf(
		"INSERT INTO logs (service_id, level, message, timestamp, metadata) VALUES %s",
		strings.Join(valueStrings, ","),
	)

	if _, err := s.db.Exec(stmt, valueArgs...); err != nil {
		return fmt.Errorf("failed to execute bulk insert: %w", err)
	}

	return nil
}

// LogStats contains global counts for the dashboard cards.
type LogStats struct {
	Total int `json:"total"`
	Error int `json:"error"`
	Warn  int `json:"warn"`
	Info  int `json:"info"`
	Debug int `json:"debug"`
}

// LogsPage contains the paginated table data plus dashboard statistics.
// LogsPage contains the paginated logs plus dashboard statistics.
type LogsPage struct {
	Logs        []models.LogPayload `json:"logs"`
	Total       int                 `json:"total"`
	GlobalStats LogStats            `json:"global_stats"`
}

// GetLogs returns one page of logs, the filtered total,
// and global ERROR/WARN/INFO/DEBUG counts.
func (s *Storage) GetLogs(serviceID string, level string, limit int, offset int) (LogsPage, error) {
	if limit < 1 {
		limit = 50
	}

	if offset < 0 {
		offset = 0
	}

	// ------------------------------------------------------------
	// 1. Fetch the requested page
	// ------------------------------------------------------------

	query := `
		SELECT service_id, level, message, timestamp, metadata
		FROM logs
		WHERE 1=1
	`

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

	query += fmt.Sprintf(
		" ORDER BY timestamp DESC LIMIT $%d OFFSET $%d",
		argID,
		argID+1,
	)

	args = append(args, limit, offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return LogsPage{}, fmt.Errorf("failed to execute logs query: %w", err)
	}
	defer rows.Close()

	logs := make([]models.LogPayload, 0, limit)

	for rows.Next() {
		var logItem models.LogPayload
		var rawMetadata []byte

		if err := rows.Scan(
			&logItem.ServiceID,
			&logItem.Level,
			&logItem.Message,
			&logItem.Timestamp,
			&rawMetadata,
		); err != nil {
			return LogsPage{}, fmt.Errorf("failed to scan log row: %w", err)
		}

		if len(rawMetadata) > 0 {
			if err := json.Unmarshal(rawMetadata, &logItem.Metadata); err != nil {
				return LogsPage{}, fmt.Errorf(
					"failed to decode log metadata: %w",
					err,
				)
			}
		}

		// logItem is used INSIDE the loop where it is declared.
		logs = append(logs, logItem)
	}

	if err := rows.Err(); err != nil {
		return LogsPage{}, fmt.Errorf(
			"failed while reading log rows: %w",
			err,
		)
	}

	// ------------------------------------------------------------
	// 2. Count logs matching the current filter
	// ------------------------------------------------------------

	countQuery := `SELECT COUNT(*) FROM logs WHERE 1=1`
	countArgs := []any{}
	countArgID := 1

	if serviceID != "" {
		countQuery += fmt.Sprintf(" AND service_id = $%d", countArgID)
		countArgs = append(countArgs, serviceID)
		countArgID++
	}

	if level != "" {
		countQuery += fmt.Sprintf(" AND level = $%d", countArgID)
		countArgs = append(countArgs, level)
	}

	var filteredTotal int

	if err := s.db.QueryRow(
		countQuery,
		countArgs...,
	).Scan(&filteredTotal); err != nil {
		return LogsPage{}, fmt.Errorf(
			"failed to count filtered logs: %w",
			err,
		)
	}

	// ------------------------------------------------------------
	// 3. Global dashboard statistics
	//
	// These counts intentionally ignore the current level/service
	// filter so the top dashboard cards always show global totals.
	// ------------------------------------------------------------

	var stats LogStats

	statsQuery := `
		SELECT
			COUNT(*) AS total,
			COUNT(*) FILTER (WHERE UPPER(level) = 'ERROR') AS error,
			COUNT(*) FILTER (WHERE UPPER(level) = 'WARN') AS warn,
			COUNT(*) FILTER (WHERE UPPER(level) = 'INFO') AS info,
			COUNT(*) FILTER (WHERE UPPER(level) = 'DEBUG') AS debug
		FROM logs
	`

	if err := s.db.QueryRow(statsQuery).Scan(
		&stats.Total,
		&stats.Error,
		&stats.Warn,
		&stats.Info,
		&stats.Debug,
	); err != nil {
		return LogsPage{}, fmt.Errorf(
			"failed to calculate global log statistics: %w",
			err,
		)
	}

	return LogsPage{
		Logs:        logs,
		Total:       filteredTotal,
		GlobalStats: stats,
	}, nil
}
