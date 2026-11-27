package invitation

import (
	"context"

	"gorm.io/gorm"
)

type Invitation struct {
	ID     string `json:"id"`
	Email  string `json:"email"`
	Role   string `json:"role"`
	Status string `json:"status"`
}

// WebAppURL is the dashboard origin. Invitation emails link to its /invitations/{id} page.
type Store struct {
	DB        *gorm.DB
	WebAppURL string
}

// List reports visibility separately so an authorized empty org returns an empty array.
// The order is not specified; clients sort the list.
func (s Store) List(ctx context.Context, userID, orgID string) ([]Invitation, bool, error) {
	invitations := make([]Invitation, 0)
	err := s.DB.WithContext(ctx).Raw(`SELECT invitations.id, invitations.email, invitations.role,
		CASE WHEN invitations.started_at + interval '7 days' <= now() THEN 'expired' ELSE 'pending' END AS status
		FROM public.orgs AS orgs
		JOIN public.members AS caller ON caller.org_id = orgs.id
		JOIN public.profiles AS caller_profile ON caller_profile.id = caller.user_id AND caller_profile.deleted_at IS NULL
		LEFT JOIN public.invitations AS invitations ON invitations.org_id = orgs.id
		WHERE orgs.id = ? AND caller.user_id = ?`, orgID, userID).Scan(&invitations).Error
	if err != nil || len(invitations) == 0 {
		return nil, false, err
	}
	// A visible org without invitations produces one row with a null invitation ID.
	if invitations[0].ID == "" {
		invitations = invitations[:0]
	}
	return invitations, true, nil
}
