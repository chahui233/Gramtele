-- Run on yytf_support. Repeatable; preserves existing friendships and messages.
CREATE TABLE IF NOT EXISTS friend_requests (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id INT NOT NULL,
    recipient_id INT NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP NULL,
    INDEX idx_friend_request_inbox (recipient_id, status, id),
    INDEX idx_friend_request_pair (sender_id, recipient_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
