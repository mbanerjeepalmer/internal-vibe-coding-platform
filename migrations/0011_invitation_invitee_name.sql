-- Lets an inviter tell us who they're inviting up front, so the invitation
-- email and the invitee's own sign-in/account-creation form can be
-- addressed to them by name instead of a bare email address. Optional: the
-- inviter may not know it, and existing invitations predate this column.
ALTER TABLE invitations ADD COLUMN invitee_name TEXT;
