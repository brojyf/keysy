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
		Where("members.user_id = ?", userID).
		Order("orgs.name ASC").Order("orgs.id ASC").Find(&memberships).Error
	return memberships, err
}
