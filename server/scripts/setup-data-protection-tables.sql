-- Data Protection Tables for GDPR/FERPA Compliance
-- This script creates the necessary tables for data protection compliance

-- Data Subject Requests table (GDPR Article 15-22)
CREATE TABLE IF NOT EXISTS data_subject_requests (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL CHECK (type IN ('access', 'rectification', 'erasure', 'portability', 'restriction', 'objection')),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    requester_email VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'processing', 'completed', 'rejected')),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    processed_by INTEGER REFERENCES users(id),
    details TEXT,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Consents table (GDPR compliance)
CREATE TABLE IF NOT EXISTS user_consents (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose VARCHAR(50) NOT NULL CHECK (purpose IN ('analytics', 'marketing', 'research', 'improvement')),
    granted BOOLEAN NOT NULL,
    version VARCHAR(10) DEFAULT '1.0',
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    withdrawn_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, purpose, version)
);

-- Data Audit Log table (GDPR/FERPA audit requirements)
CREATE TABLE IF NOT EXISTS data_audit_log (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    table_name VARCHAR(100),
    record_id INTEGER,
    action VARCHAR(50) NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    performed_by INTEGER REFERENCES users(id),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    details JSONB
);

-- Privacy Policy Acceptances table
CREATE TABLE IF NOT EXISTS privacy_policy_acceptances (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    policy_version VARCHAR(10) NOT NULL,
    accepted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    UNIQUE(user_id, policy_version)
);

-- Data Retention Policies table
CREATE TABLE IF NOT EXISTS data_retention_policies (
    id SERIAL PRIMARY KEY,
    data_type VARCHAR(100) NOT NULL UNIQUE,
    retention_period_days INTEGER NOT NULL,
    auto_archive_after_days INTEGER,
    anonymize_after_days INTEGER,
    description TEXT,
    legal_basis VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default data retention policies
INSERT INTO data_retention_policies (data_type, retention_period_days, auto_archive_after_days, anonymize_after_days, description, legal_basis) 
VALUES 
    ('student_submissions', 2555, 1095, 1825, 'Student assignment submissions and feedback', 'FERPA educational records requirement'),
    ('user_accounts', 2555, 1095, 1825, 'User account information and profiles', 'FERPA educational records requirement'),
    ('course_data', 2555, 365, 1825, 'Course information and enrollment data', 'FERPA educational records requirement'),
    ('analytics_logs', 730, 365, 365, 'System analytics and usage logs', 'Legitimate interest'),
    ('session_logs', 90, 30, 30, 'User session and authentication logs', 'Security and fraud prevention')
ON CONFLICT (data_type) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_user_id ON data_subject_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_status ON data_subject_requests(status);
CREATE INDEX IF NOT EXISTS idx_data_subject_requests_type ON data_subject_requests(type);
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_purpose ON user_consents(purpose);
CREATE INDEX IF NOT EXISTS idx_data_audit_log_user_id ON data_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_data_audit_log_timestamp ON data_audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_data_audit_log_event_type ON data_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_privacy_policy_acceptances_user_id ON privacy_policy_acceptances(user_id);