package member

import (
	"context"

	"gorm.io/gorm"
)

type Member struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

type Store struct{ DB *gorm.DB }

// List returns no rows when the org is missing, deleted, or the caller is not a member or is deleted.
// Soft-deleted profiles are left out. The order is not specified; clients sort the list.
func (s Store) List(ctx context.Context, userID, orgID string) ([]Member, error) {
	members := make([]Member, 0)
	err := s.DB.WithContext(ctx).Raw(`SELECT members.user_id, profiles.display_name AS name, profiles.email, members.role
		FROM public.members AS members
		JOIN public.orgs AS orgs ON orgs.id = members.org_id AND orgs.deleted_at IS NULL
		JOIN public.profiles AS profiles ON profiles.id = members.user_id AND profiles.deleted_at IS NULL
		WHERE members.org_id = ? AND EXISTS (SELECT 1 FROM public.members AS caller
			JOIN public.profiles AS caller_profile ON caller_profile.id = caller.user_id AND caller_profile.deleted_at IS NULL
			WHERE caller.org_id = members.org_id AND caller.user_id = ?)`, orgID, userID).Scan(&members).Error
	return members, err
}
