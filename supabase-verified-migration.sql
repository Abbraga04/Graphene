-- Add verification badge to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

-- Verify founding users
UPDATE profiles SET is_verified = TRUE WHERE id IN (
  '2a2c481e-e2e9-4552-b1c4-ba3a01595623',  -- Andre Braga
  'a30a0ccc-c489-4f40-b184-774576ebf639',  -- Alexzendor Misra
  '38f7301e-c64b-4ac6-87d5-eb75e8de578d',  -- Braiden Dishman
  '346d9ac7-d02f-4db4-ab5f-d9d6f599cf4a'   -- Lance Yan
);
