package session

import (
	"context"
	"time"

	"gorm.io/gorm"
)

type Session struct {
	ID         string
	UserAgent  string
	LastUsedAt time.Time
}

type Store struct{ DB *gorm.DB }

// List and Revoke use SECURITY DEFINER functions because the api role cannot access schema auth.
func (s Store) List(ctx context.Context, userID string) ([]Session, error) {
	sessions := make([]Session, 0)
	err := s.DB.WithContext(ctx).Raw(`SELECT id, coalesce(user_agent, '') AS user_agent, last_used_at
		FROM public.list_user_sessions(?)`, userID).Scan(&sessions).Error
	return sessions, err
}

func (s Store) Revoke(ctx context.Context, userID, sessionID string) (bool, error) {
	var revoked bool
	err := s.DB.WithContext(ctx).Raw(`SELECT public.revoke_user_session(?, ?)`, userID, sessionID).Scan(&revoked).Error
	return revoked, err
}
