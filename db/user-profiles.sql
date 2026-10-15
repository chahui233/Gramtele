-- Run in yytf_support before deploying. The existing table is users (not user).
-- Repeatable on MySQL 5.7/8.x; existing users and data are preserved.
SET @profile_ddl = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE users ADD COLUMN signature VARCHAR(200) NOT NULL DEFAULT ''''',
  'SELECT 1') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'signature');
PREPARE profile_statement FROM @profile_ddl;
EXECUTE profile_statement;
DEALLOCATE PREPARE profile_statement;

SET @profile_ddl = (SELECT IF(COUNT(*) = 0,
  'ALTER TABLE users ADD COLUMN ipaddress VARCHAR(45) NULL DEFAULT NULL',
  'SELECT 1') FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'ipaddress');
PREPARE profile_statement FROM @profile_ddl;
EXECUTE profile_statement;
DEALLOCATE PREPARE profile_statement;
