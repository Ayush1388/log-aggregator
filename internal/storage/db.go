package storage

import (
	"database/sql"
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
	db,err := sql.Open("postgres",dsn)
	if err !=nil{
		return nil,err
	}
	if err := db.Ping(); err!=nil{
		return nil,err
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(25)
	
	log.Println("Connected to the database successfully")
	return &Storage{db: db},nil
}
//bulk insert
func(s *Storage) BulkInsert(logs []models.LogPayload) error{
	if len(logs)==0{
		return nil
	}
	valueStrings := make([]string,0,len(logs))
	valueArgs:= make([]any,0,len(logs)*4)

	i:=1
	for _,logItem :=range logs {
	placeholder := fmt.Sprintf("($%d, $%d, $%d, $%d)", i, i+1, i+2, i+3)
		valueStrings = append(valueStrings, placeholder)
		valueArgs = append(valueArgs, logItem.ServiceID, logItem.Level, logItem.Message, logItem.Timestamp)
		i += 4
	}	
	// strings.Join takes ["($1,$2,$3,$4)","($5,$6,$7,$8)"] and joins them into a single string
		stmt := fmt.Sprintf("INSERT INTO logs (service_id, level, message, timestamp) VALUES %s",
		strings.Join(valueStrings, ","))
	//execute the massive query in one trip of network
	_,err := s.db.Exec(stmt,valueArgs...)
	if err !=nil{
		return fmt.Errorf("failed to execute bulk insert: %w",err)
	}
	return nil
}