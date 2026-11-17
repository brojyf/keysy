package profile

import (
	"context"
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

// OwnedOrg is an org the user owns.
type OwnedOrg struct{ ID, Name string }

// OrgOwnerError blocks account deletion and lists the orgs to hand over first.
type OrgOwnerError struct{ Orgs []OwnedOrg }

func (*OrgOwnerError) Error() string { return "user owns an organization" }

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
		var owned []OwnedOrg
		if err := tx.Raw("SELECT orgs.id, orgs.name FROM public.members AS members JOIN public.orgs AS orgs ON orgs.id = members.org_id WHERE members.user_id = ? AND members.role = 'owner' ORDER BY orgs.name, orgs.id", userID).Scan(&owned).Error; err != nil {
			return err
		}
		if len(owned) > 0 {
			return &OrgOwnerError{Orgs: owned}
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
