package profile

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"
)

type Store struct{ DB *gorm.DB }

type Profile struct {
	DisplayName    string
	AgentAutoApply bool
	PurgeAt        *time.Time
}

func (s Store) Profile(ctx context.Context, userID string) (Profile, error) {
	var result Profile
	err := s.DB.WithContext(ctx).Raw("SELECT display_name, agent_auto_apply, deleted_at + interval '30 days' AS purge_at FROM public.profiles WHERE id = ?", userID).Take(&result).Error
	return result, err
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
