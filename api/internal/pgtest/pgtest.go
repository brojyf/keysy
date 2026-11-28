// Package pgtest opens the database for store integration tests.
// .github/scripts/test-api-postgres.sh starts it with the real migrations applied.
package pgtest

import (
	"os"
	"testing"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Open connects to KEYSY_TEST_DATABASE_URL and deletes all rows, so each test starts from the migrated schema.
// It skips the test when the variable is not set.
func Open(t *testing.T) *gorm.DB {
	t.Helper()
	url := os.Getenv("KEYSY_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("KEYSY_TEST_DATABASE_URL is not set; run .github/scripts/test-api-postgres.sh")
	}
	db, err := gorm.Open(postgres.Open(url), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	if err != nil {
		t.Fatal(err)
	}
	connection, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = connection.Close() })
	// auth.users cascades to profiles, members, and auth.sessions.
	if err := db.Exec(`DO $$ BEGIN
		EXECUTE (SELECT 'TRUNCATE auth.users, ' || string_agg(format('public.%I', tablename), ', ') || ' CASCADE'
			FROM pg_tables WHERE schemaname = 'public');
		END $$`).Error; err != nil {
		t.Fatal(err)
	}
	return db
}
