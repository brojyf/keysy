package profile

import (
	"context"

	"gorm.io/gorm"
)

type Store struct{ DB *gorm.DB }

func (s Store) DisplayName(ctx context.Context, userID string) (string, error) {
	var profile struct{ DisplayName string }
	err := s.DB.WithContext(ctx).Table("public.profiles").Select("display_name").Where("id = ?", userID).Take(&profile).Error
	return profile.DisplayName, err
}

func (s Store) UpdateDisplayName(ctx context.Context, userID, name string) error {
	result := s.DB.WithContext(ctx).Table("public.profiles").Where("id = ?", userID).Update("display_name", name)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (s Store) AgentAutoApply(ctx context.Context, userID string) (bool, error) {
	var profile struct{ AgentAutoApply bool }
	err := s.DB.WithContext(ctx).Table("public.profiles").Select("agent_auto_apply").Where("id = ?", userID).Take(&profile).Error
	return profile.AgentAutoApply, err
}

func (s Store) UpdateAgentAutoApply(ctx context.Context, userID string, enabled bool) error {
	result := s.DB.WithContext(ctx).Table("public.profiles").Where("id = ?", userID).Update("agent_auto_apply", enabled)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
