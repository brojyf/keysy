package member

import (
	"context"
	"errors"

	"gorm.io/gorm"
)

type Member struct {
	UserID   string `json:"userId"`
	Name     string `json:"name"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	Deleting bool   `json:"deleting"`
}

type Store struct{ DB *gorm.DB }

// List returns no rows when the org is missing, deleted, or the caller is not a member or is deleted.
// Members with profiles scheduled for deletion are returned with Deleting true.
// The order is not specified; clients sort the list.
func (s Store) List(ctx context.Context, userID, orgID string) ([]Member, error) {
	members := make([]Member, 0)
	err := s.DB.WithContext(ctx).Raw(`SELECT members.user_id, profiles.display_name AS name, profiles.email, members.role,
		profiles.deleted_at IS NOT NULL AS deleting
		FROM public.members AS members
		JOIN public.orgs AS orgs ON orgs.id = members.org_id
		JOIN public.profiles AS profiles ON profiles.id = members.user_id
		WHERE members.org_id = ? AND EXISTS (SELECT 1 FROM public.members AS caller
			JOIN public.profiles AS caller_profile ON caller_profile.id = caller.user_id AND caller_profile.deleted_at IS NULL
			WHERE caller.org_id = members.org_id AND caller.user_id = ?)`, orgID, userID).Scan(&members).Error
	return members, err
}

var (
	ErrOrgNotFound     = errors.New("organization not found")
	ErrMemberNotFound  = errors.New("member not found")
	ErrRemoveForbidden = errors.New("member removal forbidden")
)

func canRemove(callerRole, targetRole string) bool {
	return callerRole == "owner" && (targetRole == "admin" || targetRole == "developer") || callerRole == "admin" && targetRole == "developer"
}

func (s Store) Remove(ctx context.Context, callerID, orgID, targetID string) error {
	return s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var members []struct{ UserID, Role string }
		// Consistent order prevents deadlocks. Lock rows because deletion and future role or owner changes write them.
		if err := tx.Raw(`SELECT members.user_id, members.role
			FROM public.members AS members
			JOIN public.profiles AS profiles ON profiles.id = members.user_id
			WHERE members.org_id = ? AND members.user_id IN (?, ?)
			AND (members.user_id <> ? OR profiles.deleted_at IS NULL)
			ORDER BY members.user_id FOR UPDATE OF members`, orgID, callerID, targetID, callerID).Scan(&members).Error; err != nil {
			return err
		}
		var callerRole, targetRole string
		for _, member := range members {
			if member.UserID == callerID {
				callerRole = member.Role
			}
			if member.UserID == targetID {
				targetRole = member.Role
			}
		}
		if callerRole == "" {
			return ErrOrgNotFound
		}
		if callerID == targetID {
			return ErrRemoveForbidden
		}
		if targetRole == "" {
			return ErrMemberNotFound
		}
		if !canRemove(callerRole, targetRole) {
			return ErrRemoveForbidden
		}
		return tx.Exec("DELETE FROM public.members WHERE org_id = ? AND user_id = ?", orgID, targetID).Error
	})
}
