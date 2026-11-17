package org

import (
	"context"
	"errors"

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

var ErrAccountDeleting = errors.New("account is being deleted")

type Store struct{ DB *gorm.DB }

func (s Store) Create(ctx context.Context, userID, name string) (Organization, error) {
	organization := Organization{Name: name}
	err := s.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var locked int
		result := tx.Raw("SELECT 1 FROM public.profiles WHERE id = ? AND deleted_at IS NULL FOR SHARE", userID).Scan(&locked)
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrAccountDeleting
		}
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
		Joins("JOIN public.profiles AS caller_profile ON caller_profile.id = members.user_id AND caller_profile.deleted_at IS NULL").
		Where("members.user_id = ?", userID).
		Order("orgs.name ASC").Order("orgs.id ASC").Find(&memberships).Error
	return memberships, err
}

func (s Store) Delete(ctx context.Context, userID, orgID string) (bool, error) {
	result := s.DB.WithContext(ctx).Exec(`DELETE FROM public.orgs AS orgs WHERE orgs.id = ? AND EXISTS (SELECT 1 FROM public.members AS members WHERE members.org_id = orgs.id AND members.user_id = ? AND members.role = 'owner')`, orgID, userID)
	return result.RowsAffected == 1, result.Error
}

// Rename reports false when the org is missing, deleted, or the caller is not its owner.
func (s Store) Rename(ctx context.Context, userID, orgID, name string) (bool, error) {
	result := s.DB.WithContext(ctx).Exec(`UPDATE public.orgs SET name = ? WHERE id = ? AND EXISTS (SELECT 1 FROM public.members AS members
		WHERE members.org_id = orgs.id AND members.user_id = ? AND members.role = 'owner')`, name, orgID, userID)
	return result.RowsAffected == 1, result.Error
}
