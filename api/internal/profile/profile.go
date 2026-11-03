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
