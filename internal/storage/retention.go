package storage

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"time"
)

var monthlyPartitionPattern = regexp.MustCompile(`^logs_[0-9]{4}_[0-9]{2}$`)

// StartMaintenanceManager runs database maintenance immediately at startup
// and then once every 24 hours.
//
// Maintenance:
//   - creates the current month and next two monthly partitions
//   - removes partitions older than the retention period
func (s *Storage) StartMaintenanceManager(
	ctx context.Context,
	retentionMonths int,
) {
	// Run immediately on startup.
	s.runMaintenance(retentionMonths)

	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			s.runMaintenance(retentionMonths)

		case <-ctx.Done():
			log.Println("Maintenance manager stopped")
			return
		}
	}
}

func (s *Storage) runMaintenance(retentionMonths int) {
	if err := s.EnsurePartitions(); err != nil {
		log.Printf("Partition maintenance failed: %v", err)
	}

	if err := s.RemoveExpiredPartitions(retentionMonths); err != nil {
		log.Printf("Retention maintenance failed: %v", err)
	}
}

// RemoveExpiredPartitions drops monthly partitions older than the
// configured retention period.
func (s *Storage) RemoveExpiredPartitions(retentionMonths int) error {
	if retentionMonths < 1 {
		return fmt.Errorf("retention period must be at least 1 month")
	}

	now := time.Now().UTC()

	currentMonth := time.Date(
		now.Year(),
		now.Month(),
		1,
		0, 0, 0, 0,
		time.UTC,
	)

	cutoff := currentMonth.AddDate(0, -retentionMonths, 0)

	rows, err := s.db.Query(`
		SELECT child.relname
		FROM pg_inherits
		JOIN pg_class parent
			ON pg_inherits.inhparent = parent.oid
		JOIN pg_class child
			ON pg_inherits.inhrelid = child.oid
		JOIN pg_namespace parent_schema
			ON parent.relnamespace = parent_schema.oid
		JOIN pg_namespace child_schema
			ON child.relnamespace = child_schema.oid
		WHERE parent_schema.nspname = 'public'
		  AND parent.relname = 'logs'
		  AND child_schema.nspname = 'public'
	`)
	if err != nil {
		return fmt.Errorf("failed to find log partitions: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var partitionName string

		if err := rows.Scan(&partitionName); err != nil {
			return fmt.Errorf("failed to read partition name: %w", err)
		}

		// Never touch logs_default.
		if !monthlyPartitionPattern.MatchString(partitionName) {
			continue
		}

		partitionDate, err := time.Parse(
			"2006_01",
			partitionName[len("logs_"):],
		)
		if err != nil {
			log.Printf(
				"Skipping partition %s: invalid date: %v",
				partitionName,
				err,
			)
			continue
		}

		partitionStart := time.Date(
			partitionDate.Year(),
			partitionDate.Month(),
			1,
			0, 0, 0, 0,
			time.UTC,
		)

		if partitionStart.Before(cutoff) {
			// partitionName is validated against the strict
			// logs_YYYY_MM naming pattern above.
			query := fmt.Sprintf(
				`DROP TABLE IF EXISTS public.%s`,
				partitionName,
			)

			if _, err := s.db.Exec(query); err != nil {
				return fmt.Errorf(
					"failed to drop expired partition %s: %w",
					partitionName,
					err,
				)
			}

			log.Printf(
				"Dropped expired log partition: %s",
				partitionName,
			)
		}
	}

	if err := rows.Err(); err != nil {
		return fmt.Errorf("error while reading log partitions: %w", err)
	}

	return nil
}
