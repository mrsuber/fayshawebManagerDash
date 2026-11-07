-- Sign-up verification by a 6-digit code: count wrong guesses so a code cannot be brute-forced.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_code_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_code_sent_at TIMESTAMP;
