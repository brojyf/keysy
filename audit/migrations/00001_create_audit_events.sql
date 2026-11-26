-- +goose Up
CREATE TABLE audit_events (
  event_id uuid PRIMARY KEY,
  org_id uuid NOT NULL
);
