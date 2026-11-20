-- Baseline migration. citext gives case-insensitive text for names that must be unique per Learner (e.g. Topic names).
CREATE EXTENSION IF NOT EXISTS citext;
