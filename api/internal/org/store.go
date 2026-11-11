package org

import (
	"context"

	"gorm.io/gorm"
)

type Organization struct {
	ID   string `json:"id" gorm:"default:gen_random_uuid()"`
	Name string `json:"name"`
}

type Membership struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Role        string `json:"role"`
	MemberCount int    `json:"memberCount"`
}

type Member struct {
	UserID string `json:"userId"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

type Store struct{ DB *gorm.DB }

func (s Store) Create(ctx context.Context, userID, name string) (Organization, error) {
	organization := Organization{Name: name}
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Table("public.orgs").Create(&organization).Error; err != nil {
			return err
		}
		membership := struct{ OrgID, UserID, Role string }{organization.ID, userID, "owner"}
		return tx.Table("public.members").Create(&membership).Error
	})
	if err != nil {
		return Organization{}, err
	}
	return organization, nil
}

func (s Store) List(ctx context.Context, userID string) ([]Membership, error) {
	memberships := make([]Membership, 0)
	err := s.DB.WithContext(ctx).Table("public.orgs AS orgs").
		Select("orgs.id, orgs.name, members.role, (SELECT count(*) FROM public.members AS org_members WHERE org_members.org_id = orgs.id) AS member_count").
		Joins("JOIN public.members AS members ON members.org_id = orgs.id").
		Where("members.user_id = ? AND orgs.deleted_at IS NULL", userID).
		Order("orgs.name ASC").Order("orgs.id ASC").Find(&memberships).Error
	return memberships, err
}

func (s Store) Delete(ctx context.Context, userID, orgID string) (bool, error) {
	var completed bool
	// Lock before checking deleted_at so concurrent retries do not repeat the write.
	err := s.DB.WithContext(ctx).Raw(`WITH owned_org AS (
		SELECT orgs.id, orgs.deleted_at FROM public.orgs AS orgs
		WHERE orgs.id = ? AND EXISTS (SELECT 1 FROM public.members AS members
			WHERE members.org_id = orgs.id AND members.user_id = ? AND members.role = 'owner')
		FOR UPDATE OF orgs
	), deleted_org AS (
		UPDATE public.orgs AS orgs SET deleted_at = CURRENT_TIMESTAMP
		FROM owned_org WHERE orgs.id = owned_org.id AND owned_org.deleted_at IS NULL
		RETURNING orgs.id
	)
	SELECT EXISTS (SELECT 1 FROM owned_org)`, orgID, userID).Scan(&completed).Error
	return completed, err
}

// Rename reports false when the org is missing, deleted, or the caller is not its owner.
func (s Store) Rename(ctx context.Context, userID, orgID, name string) (bool, error) {
	result := s.DB.WithContext(ctx).Exec(`UPDATE public.orgs SET name = ? WHERE id = ? AND deleted_at IS NULL AND EXISTS (SELECT 1 FROM public.members AS members
		WHERE members.org_id = orgs.id AND members.user_id = ? AND members.role = 'owner')`, name, orgID, userID)
	return result.RowsAffected == 1, result.Error
}

// Members returns no rows when the org is missing, deleted, or the caller is not a member.
// Soft-deleted profiles are left out. The order is not specified; clients sort the list.
func (s Store) Members(ctx context.Context, userID, orgID string) ([]Member, error) {
	members := make([]Member, 0)
	err := s.DB.WithContext(ctx).Raw(`SELECT members.user_id, profiles.display_name AS name, profiles.email, members.role
		FROM public.members AS members
		JOIN public.orgs AS orgs ON orgs.id = members.org_id AND orgs.deleted_at IS NULL
		JOIN public.profiles AS profiles ON profiles.id = members.user_id AND profiles.deleted_at IS NULL
		WHERE members.org_id = ? AND EXISTS (SELECT 1 FROM public.members AS caller
			WHERE caller.org_id = members.org_id AND caller.user_id = ?)`, orgID, userID).Scan(&members).Error
	return members, err
}
