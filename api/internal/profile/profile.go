package profile

import (
	"context"
	"errors"

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

var ErrOrgOwner = errors.New("user owns an organization")

func (s Store) ScheduleDeletion(ctx context.Context, userID string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var locked int
		result := tx.Raw("SELECT 1 FROM public.profiles WHERE id = ? FOR UPDATE", userID).Scan(&locked)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		var owner bool
		if err := tx.Raw("SELECT EXISTS (SELECT 1 FROM public.members WHERE user_id = ? AND role = 'owner')", userID).Scan(&owner).Error; err != nil {
			return err
		}
		if owner {
			return ErrOrgOwner
		}
		if err := tx.Exec("UPDATE public.profiles SET deleted_at = now() WHERE id = ? AND deleted_at IS NULL", userID).Error; err != nil {
			return err
		}
		return tx.Exec("SELECT public.revoke_all_user_sessions(?)", userID).Error
	})
}

func (s Store) CancelDeletion(ctx context.Context, userID string) error {
	return s.DB.WithContext(ctx).Exec("UPDATE public.profiles SET deleted_at = NULL WHERE id = ? AND deleted_at IS NOT NULL", userID).Error
}
