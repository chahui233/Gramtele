-- Run once against yytf_support before deploying the updated application.
-- Existing plaintext passwords are upgraded to PBKDF2 after the next successful login.
ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE chat_messages ADD COLUMN deleted TINYINT(1) NOT NULL DEFAULT 0;
CREATE INDEX idx_chat_public_time ON chat_messages (receiver_id, timestamp);
CREATE INDEX idx_chat_private_time ON chat_messages (user_id, receiver_id, timestamp);
CREATE INDEX idx_friends_pair ON friends (user_id, friend_id);
