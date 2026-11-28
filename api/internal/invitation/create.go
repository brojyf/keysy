package invitation

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

var (
	ErrOrgNotFound      = errors.New("organization not found")
	ErrForbidden        = errors.New("invitation forbidden")
	ErrAlreadyMember    = errors.New("email already belongs to a member")
	ErrInvitationExists = errors.New("pending invitation exists")
	ErrLimitReached     = errors.New("invitation limit reached")
)

// The Owner invites Admins and Developers. Admins invite only Developers.
// The upsert in Create repeats this rule for renewals: Admins cannot renew an Admin invitation.
func canInvite(callerRole, role string) bool {
	return callerRole == "owner" || callerRole == "admin" && role == "developer"
}

type invitationEmail struct {
	To       string `json:"to"`
	Template struct {
		ID        string            `json:"id"`
		Variables map[string]string `json:"variables"`
	} `json:"template"`
}

// Create invites email to the org, or renews its expired invitation, and queues the invitation email.
// Its only explicit lock is FOR KEY SHARE on the org row, taken first: org deletion waits for the invite,
// so the two never lock the org and invitation rows in opposite orders. The unique (org_id, email) key and
// the conditional window update make concurrent requests wait for each other, and READ COMMITTED gives each
// statement a new snapshot.
func (s Store) Create(ctx context.Context, callerID, orgID, email, role string) (Invitation, error) {
	var created Invitation
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var caller struct{ Role, DisplayName, Email, OrgName string }
		if err := tx.Raw(`SELECT members.role, profiles.display_name, profiles.email, orgs.name AS org_name
			FROM public.members AS members
			JOIN public.orgs AS orgs ON orgs.id = members.org_id
			JOIN public.profiles AS profiles ON profiles.id = members.user_id AND profiles.deleted_at IS NULL
			WHERE members.org_id = ? AND members.user_id = ?
			FOR KEY SHARE OF orgs`, orgID, callerID).Scan(&caller).Error; err != nil {
			return err
		}
		if caller.Role == "" {
			return ErrOrgNotFound
		}
		if !canInvite(caller.Role, role) {
			return ErrForbidden
		}

		// A new email inserts a row. An expired invitation is renewed in place with the same ID,
		// unless an Admin tries to renew an Admin invitation. A pending invitation is left unchanged.
		var row struct {
			ID        string
			StartedAt time.Time
		}
		if err := tx.Raw(`INSERT INTO public.invitations AS invitations (org_id, email, role, invited_by_email)
			VALUES (?, ?, ?, ?)
			ON CONFLICT (org_id, email) DO UPDATE
			SET role = excluded.role, started_at = now(), last_sent_at = now(), invited_by_email = excluded.invited_by_email
			WHERE invitations.started_at + interval '7 days' <= now()
			AND (? = 'owner' OR invitations.role = 'developer')
			RETURNING invitations.id, invitations.started_at`, orgID, email, role, caller.Email, caller.Role).Scan(&row).Error; err != nil {
			return err
		}
		if row.ID == "" {
			// ON CONFLICT locked the existing row, so this read sees the row that blocked the write.
			var expired bool
			if err := tx.Raw(`SELECT started_at + interval '7 days' <= now() FROM public.invitations
				WHERE org_id = ? AND email = ?`, orgID, email).Scan(&expired).Error; err != nil {
				return err
			}
			if expired {
				return ErrForbidden
			}
			return ErrInvitationExists
		}

		// Checked after the upsert: if the invitee is accepting an invitation right now, the upsert
		// waits for that commit, and this statement then sees the new member.
		var member bool
		if err := tx.Raw(`SELECT EXISTS (SELECT 1 FROM public.members AS members
			JOIN public.profiles AS profiles ON profiles.id = members.user_id
			WHERE members.org_id = ? AND lower(profiles.email) = ?)`, orgID, email).Scan(&member).Error; err != nil {
			return err
		}
		if member {
			return ErrAlreadyMember
		}

		// Last, so rejected requests do not use the org's 50 emails per 24-hour window.
		result := tx.Exec(`UPDATE public.orgs SET
			invitation_window_started_at = CASE WHEN invitation_window_started_at IS NULL
				OR invitation_window_started_at + interval '24 hours' <= now() THEN now() ELSE invitation_window_started_at END,
			invitation_window_sends = CASE WHEN invitation_window_started_at IS NULL
				OR invitation_window_started_at + interval '24 hours' <= now() THEN 1 ELSE invitation_window_sends + 1 END
			WHERE id = ? AND (invitation_window_started_at IS NULL
				OR invitation_window_started_at + interval '24 hours' <= now()
				OR invitation_window_sends < 50)`, orgID)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrLimitReached
		}

		message := invitationEmail{To: email}
		message.Template.ID = "invitation"
		message.Template.Variables = map[string]string{
			"ORG_NAME":       caller.OrgName,
			"INVITER_NAME":   caller.DisplayName,
			"INVITATION_URL": strings.TrimRight(s.WebAppURL, "/") + "/invitations/" + row.ID,
			"EXPIRY_DATE":    row.StartedAt.Add(7 * 24 * time.Hour).UTC().Format("January 2, 2006"),
		}
		payload, err := json.Marshal(message)
		if err != nil {
			return err
		}
		if err := tx.Exec(`INSERT INTO public.outbox (type, payload) VALUES ('email', CAST(? AS jsonb))`, string(payload)).Error; err != nil {
			return err
		}
		created = Invitation{ID: row.ID, Email: email, Role: role, Status: "pending"}
		return nil
	})
	return created, err
}
