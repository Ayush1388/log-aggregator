package storage

import (
	"fmt"
	"log"
	"time"
)

// EnsurePartitions makes sure the current month and the next two
// months have partitions ready to receive logs.
func (s *Storage) EnsurePartitions() error {
	now := time.Now().UTC()

	for i := 0; i < 3; i++ {
		target := now.AddDate(0, i, 0)

		start := time.Date(
			target.Year(),
			target.Month(),
			1,
			0, 0, 0, 0,
			time.UTC,
		)

		end := start.AddDate(0, 1, 0)

		tableName := fmt.Sprintf(
			"logs_%04d_%02d",
			start.Year(),
			start.Month(),
		)

		query := fmt.Sprintf(`
			CREATE TABLE IF NOT EXISTS public.%s
			PARTITION OF public.logs
			FOR VALUES FROM ('%s') TO ('%s');
		`,
			tableName,
			start.Format(time.RFC3339),
			end.Format(time.RFC3339),
		)

		if _, err := s.db.Exec(query); err != nil {
			return fmt.Errorf(
				"failed to create partition %s: %w",
				tableName,
				err,
			)
		}

		log.Printf("Partition ready: %s", tableName)
	}

	return nil
}
