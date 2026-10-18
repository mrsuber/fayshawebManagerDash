-- NOTE: superseded by 020_create_manager_operations.sql, which creates or extends
-- these tables idempotently. Run 020; this file is kept for history.
-- =====================================================
-- Guest 360 Comprehensive Management System
-- =====================================================
-- This migration creates a complete guest management ecosystem
-- for tracking all guest interactions, preferences, and activities
-- =====================================================

-- =====================================================
-- 1. SERVICE REQUESTS
-- =====================================================
-- Tracks all guest service requests (housekeeping, maintenance, concierge, dining, transport)

CREATE TYPE request_type AS ENUM ('housekeeping', 'maintenance', 'concierge', 'dining', 'transport', 'wellness', 'experience', 'other');
CREATE TYPE request_priority AS ENUM ('low', 'normal', 'high', 'urgent');
CREATE TYPE request_status AS ENUM ('pending', 'acknowledged', 'in_progress', 'completed', 'cancelled');

CREATE TABLE service_requests (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(50) NOT NULL UNIQUE, -- SRQ-YYYYMMDD-XXX

    -- Guest & Booking Info
    guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,
    apartment_id INTEGER REFERENCES apartments(id) ON DELETE SET NULL,

    -- Request Details
    request_type request_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority request_priority DEFAULT 'normal',
    status request_status DEFAULT 'pending',

    -- Assignment & Handling
    assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL, -- Staff member assigned
    department VARCHAR(100), -- housekeeping, maintenance, etc.
    estimated_completion TIMESTAMP,

    -- Location Details
    location VARCHAR(255), -- Specific location in apartment/property
    access_required BOOLEAN DEFAULT false,

    -- Attachments & Media
    attachments JSONB DEFAULT '[]', -- Array of {url, type, name, uploaded_at}

    -- Resolution
    resolution_notes TEXT,
    resolution_attachments JSONB DEFAULT '[]',

    -- Ratings & Feedback
    guest_rating INTEGER CHECK (guest_rating >= 1 AND guest_rating <= 5),
    guest_feedback TEXT,

    -- Timestamps
    acknowledged_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Metadata
    metadata JSONB DEFAULT '{}', -- Additional flexible data

    CONSTRAINT valid_completion_time CHECK (estimated_completion IS NULL OR estimated_completion > created_at)
);

CREATE INDEX idx_service_requests_guest ON service_requests(guest_id);
CREATE INDEX idx_service_requests_booking ON service_requests(booking_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_type ON service_requests(request_type);
CREATE INDEX idx_service_requests_priority ON service_requests(priority);
CREATE INDEX idx_service_requests_assigned ON service_requests(assigned_to);
CREATE INDEX idx_service_requests_created ON service_requests(created_at DESC);

-- =====================================================
-- 2. GUEST MESSAGES (Manager-Guest Direct Communication)
-- =====================================================
-- Separate from concierge chat - for manager/staff direct messaging

CREATE TYPE message_channel AS ENUM ('sms', 'email', 'in_app', 'whatsapp');
CREATE TYPE message_status AS ENUM ('draft', 'sent', 'delivered', 'read', 'failed');

CREATE TABLE guest_messages (
    id SERIAL PRIMARY KEY,

    -- Participants
    guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    staff_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,

    -- Message Details
    subject VARCHAR(255),
    message TEXT NOT NULL,
    channel message_channel DEFAULT 'in_app',
    status message_status DEFAULT 'sent',

    -- Direction
    is_from_guest BOOLEAN DEFAULT false, -- true if guest sent, false if staff sent

    -- Threading
    parent_message_id INTEGER REFERENCES guest_messages(id) ON DELETE SET NULL,
    thread_id VARCHAR(100), -- Group messages into conversations

    -- Attachments
    attachments JSONB DEFAULT '[]', -- {url, type, name, size}

    -- Delivery Tracking
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    read_at TIMESTAMP,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guest_messages_guest ON guest_messages(guest_id);
CREATE INDEX idx_guest_messages_staff ON guest_messages(staff_id);
CREATE INDEX idx_guest_messages_thread ON guest_messages(thread_id);
CREATE INDEX idx_guest_messages_created ON guest_messages(created_at DESC);

-- =====================================================
-- 3. GUEST PREFERENCES
-- =====================================================
-- Stores detailed guest preferences across all categories

CREATE TABLE guest_preferences (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Wellness Preferences
    wellness_preferences JSONB DEFAULT '{
        "preferred_treatments": [],
        "health_goals": [],
        "dietary_restrictions": [],
        "allergies": [],
        "fitness_level": "",
        "preferred_schedule": ""
    }',

    -- Dining Preferences
    dining_preferences JSONB DEFAULT '{
        "dietary_type": "",
        "cuisine_preferences": [],
        "allergies": [],
        "dislikes": [],
        "preferred_dining_time": {},
        "special_requests": ""
    }',

    -- Experience Preferences
    experience_preferences JSONB DEFAULT '{
        "interests": [],
        "activity_level": "",
        "preferred_experiences": [],
        "bucket_list": []
    }',

    -- Residence Preferences
    residence_preferences JSONB DEFAULT '{
        "temperature": 22,
        "lighting": "warm",
        "pillow_type": "medium",
        "room_fragrance": "",
        "minibar_preferences": [],
        "turndown_service": true,
        "do_not_disturb_hours": {}
    }',

    -- Communication Preferences
    communication_preferences JSONB DEFAULT '{
        "preferred_channel": "in_app",
        "language": "en",
        "contact_times": [],
        "newsletter": true,
        "promotional_messages": true,
        "sms_enabled": false
    }',

    -- Special Occasions
    special_occasions JSONB DEFAULT '{
        "birthday": null,
        "anniversary": null,
        "celebrations": []
    }',

    -- Accessibility Requirements
    accessibility_requirements JSONB DEFAULT '{
        "mobility_assistance": false,
        "visual_impairment": false,
        "hearing_impairment": false,
        "other_requirements": []
    }',

    -- Privacy Settings
    privacy_settings JSONB DEFAULT '{
        "share_preferences": true,
        "personalized_marketing": true,
        "data_retention": "standard"
    }',

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(guest_id)
);

CREATE INDEX idx_guest_preferences_guest ON guest_preferences(guest_id);

-- =====================================================
-- 4. GUEST NOTES
-- =====================================================
-- Staff observations, special requirements, important information

CREATE TYPE note_category AS ENUM ('general', 'preference', 'observation', 'incident', 'compliment', 'complaint', 'medical', 'vip', 'alert');
CREATE TYPE note_visibility AS ENUM ('private', 'staff_only', 'management_only', 'all_staff');

CREATE TABLE guest_notes (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Note Details
    category note_category DEFAULT 'general',
    title VARCHAR(255),
    note TEXT NOT NULL,
    visibility note_visibility DEFAULT 'staff_only',

    -- Author & Context
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,

    -- Importance & Flags
    is_important BOOLEAN DEFAULT false,
    is_alert BOOLEAN DEFAULT false, -- Shows prominently in guest profile
    alert_expires_at TIMESTAMP, -- Alert auto-hides after this date

    -- Attachments
    attachments JSONB DEFAULT '[]',

    -- Tags for categorization
    tags TEXT[], -- ['vip', 'allergy', 'special-request']

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Soft delete
    deleted_at TIMESTAMP
);

CREATE INDEX idx_guest_notes_guest ON guest_notes(guest_id);
CREATE INDEX idx_guest_notes_category ON guest_notes(category);
CREATE INDEX idx_guest_notes_created_by ON guest_notes(created_by);
CREATE INDEX idx_guest_notes_important ON guest_notes(is_important) WHERE is_important = true;
CREATE INDEX idx_guest_notes_alert ON guest_notes(is_alert) WHERE is_alert = true;
CREATE INDEX idx_guest_notes_created ON guest_notes(created_at DESC);

-- =====================================================
-- 5. GUEST TAGS
-- =====================================================
-- Flexible tagging system for guests (VIP, Wellness Enthusiast, etc.)

CREATE TABLE guest_tags (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    tag_name VARCHAR(100) NOT NULL,
    tag_color VARCHAR(7) DEFAULT '#3fd283', -- Hex color
    tag_category VARCHAR(50), -- 'behavior', 'preference', 'vip', 'alert'

    -- Auto-applied or manual
    is_auto_generated BOOLEAN DEFAULT false,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE(guest_id, tag_name)
);

CREATE INDEX idx_guest_tags_guest ON guest_tags(guest_id);
CREATE INDEX idx_guest_tags_name ON guest_tags(tag_name);

-- =====================================================
-- 6. GUEST INSIGHTS (AI-Generated & Analytics)
-- =====================================================
-- Stores AI-generated insights, predictions, and analytics about guests

CREATE TYPE insight_type AS ENUM ('behavioral', 'preference', 'spending', 'satisfaction', 'prediction', 'recommendation', 'alert');

CREATE TABLE guest_insights (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Insight Details
    insight_type insight_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    confidence_score DECIMAL(3,2), -- 0.00 to 1.00

    -- Data & Evidence
    supporting_data JSONB DEFAULT '{}', -- Raw data that supports this insight

    -- Actionable Recommendations
    recommendations JSONB DEFAULT '[]', -- Suggested actions based on insight

    -- Validity & Expiration
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,

    -- Impact & Priority
    priority INTEGER DEFAULT 50, -- 0-100, higher = more important

    -- Source
    generated_by VARCHAR(100), -- 'ai_model_v1', 'analytics_engine', 'manual'

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guest_insights_guest ON guest_insights(guest_id);
CREATE INDEX idx_guest_insights_type ON guest_insights(insight_type);
CREATE INDEX idx_guest_insights_active ON guest_insights(is_active) WHERE is_active = true;
CREATE INDEX idx_guest_insights_priority ON guest_insights(priority DESC);

-- =====================================================
-- 7. GUEST ACTIVITIES (Timeline/Journey Tracking)
-- =====================================================
-- Comprehensive timeline of all guest interactions and activities

CREATE TYPE activity_type AS ENUM (
    'booking_created', 'booking_confirmed', 'check_in', 'check_out',
    'wellness_booking', 'dining_reservation', 'experience_booked',
    'service_request', 'message_sent', 'message_received',
    'preference_updated', 'note_added', 'payment_made',
    'feedback_submitted', 'journey_started', 'journey_completed',
    'smart_home_action', 'concierge_interaction', 'staff_interaction',
    'custom'
);

CREATE TABLE guest_activities (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,

    -- Activity Details
    activity_type activity_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,

    -- Related Entities (polymorphic references)
    related_entity_type VARCHAR(50), -- 'service_request', 'wellness_booking', etc.
    related_entity_id INTEGER,

    -- Actor (who performed the action)
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_automated BOOLEAN DEFAULT false,

    -- Location & Context
    location VARCHAR(255),

    -- Activity Data
    activity_data JSONB DEFAULT '{}', -- Flexible data storage

    -- Display & UI
    icon VARCHAR(50), -- Material icon name
    color VARCHAR(7), -- Hex color for timeline display

    -- Timestamps
    activity_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_guest_activities_guest ON guest_activities(guest_id);
CREATE INDEX idx_guest_activities_booking ON guest_activities(booking_id);
CREATE INDEX idx_guest_activities_type ON guest_activities(activity_type);
CREATE INDEX idx_guest_activities_timestamp ON guest_activities(activity_timestamp DESC);

-- =====================================================
-- 8. GUEST METRICS (Analytics & Performance Tracking)
-- =====================================================
-- Aggregated metrics for guest value, satisfaction, and behavior

CREATE TABLE guest_metrics (
    id SERIAL PRIMARY KEY,
    guest_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

    -- Financial Metrics
    total_revenue DECIMAL(10,2) DEFAULT 0,
    total_revenue_ytd DECIMAL(10,2) DEFAULT 0,
    average_booking_value DECIMAL(10,2) DEFAULT 0,
    lifetime_value DECIMAL(10,2) DEFAULT 0,

    -- Stay Metrics
    total_stays INTEGER DEFAULT 0,
    total_nights INTEGER DEFAULT 0,
    average_stay_duration DECIMAL(5,2) DEFAULT 0,

    -- Engagement Metrics
    total_service_requests INTEGER DEFAULT 0,
    total_wellness_bookings INTEGER DEFAULT 0,
    total_dining_reservations INTEGER DEFAULT 0,
    total_experiences_booked INTEGER DEFAULT 0,

    -- Satisfaction Metrics
    average_satisfaction_score DECIMAL(3,2) DEFAULT 0, -- 0.00 to 5.00
    nps_score INTEGER, -- Net Promoter Score -100 to 100
    last_feedback_date DATE,

    -- Behavioral Metrics
    booking_frequency_days INTEGER, -- Average days between bookings
    preferred_season VARCHAR(20),
    preferred_day_of_week VARCHAR(20),
    cancellation_rate DECIMAL(3,2) DEFAULT 0, -- 0.00 to 1.00

    -- Loyalty Metrics
    loyalty_tier VARCHAR(50), -- 'bronze', 'silver', 'gold', 'platinum'
    loyalty_points INTEGER DEFAULT 0,
    referral_count INTEGER DEFAULT 0,

    -- Last Activity
    last_stay_date DATE,
    last_booking_date DATE,
    last_interaction_date DATE,

    -- Risk & Flags
    risk_score DECIMAL(3,2) DEFAULT 0, -- 0.00 to 1.00 (1 = high risk)
    is_vip BOOLEAN DEFAULT false,
    is_blacklisted BOOLEAN DEFAULT false,

    -- Timestamps
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(guest_id)
);

CREATE INDEX idx_guest_metrics_guest ON guest_metrics(guest_id);
CREATE INDEX idx_guest_metrics_vip ON guest_metrics(is_vip) WHERE is_vip = true;
CREATE INDEX idx_guest_metrics_lifetime_value ON guest_metrics(lifetime_value DESC);

-- =====================================================
-- 9. DINING RESERVATIONS (Enhanced from existing system)
-- =====================================================

CREATE TYPE dining_status AS ENUM ('pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show');

CREATE TABLE dining_reservations (
    id SERIAL PRIMARY KEY,
    reservation_number VARCHAR(50) NOT NULL UNIQUE, -- DIN-YYYYMMDD-XXX

    -- Guest Info
    guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,

    -- Reservation Details
    restaurant_name VARCHAR(255) NOT NULL,
    reservation_date DATE NOT NULL,
    reservation_time TIME NOT NULL,
    number_of_guests INTEGER NOT NULL,

    -- Preferences
    seating_preference VARCHAR(100), -- 'window', 'private', 'outdoor'
    dietary_requirements TEXT,
    special_occasion VARCHAR(100), -- 'birthday', 'anniversary'
    special_requests TEXT,

    -- Status
    status dining_status DEFAULT 'pending',

    -- Assignment
    table_number VARCHAR(20),
    server_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Timestamps
    confirmed_at TIMESTAMP,
    seated_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dining_reservations_guest ON dining_reservations(guest_id);
CREATE INDEX idx_dining_reservations_date ON dining_reservations(reservation_date, reservation_time);
CREATE INDEX idx_dining_reservations_status ON dining_reservations(status);

-- =====================================================
-- 10. EXPERIENCE BOOKINGS (Tours, Activities, Excursions)
-- =====================================================

CREATE TYPE experience_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');

CREATE TABLE experience_bookings (
    id SERIAL PRIMARY KEY,
    booking_number VARCHAR(50) NOT NULL UNIQUE, -- EXP-YYYYMMDD-XXX

    -- Guest Info
    guest_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    booking_id INTEGER REFERENCES bookings(id) ON DELETE SET NULL,

    -- Experience Details
    experience_name VARCHAR(255) NOT NULL,
    experience_type VARCHAR(100), -- 'tour', 'adventure', 'cultural', 'culinary'
    description TEXT,

    -- Booking Details
    experience_date DATE NOT NULL,
    experience_time TIME NOT NULL,
    duration_minutes INTEGER,
    number_of_participants INTEGER NOT NULL,

    -- Pricing
    price_per_person DECIMAL(10,2),
    total_price DECIMAL(10,2),

    -- Requirements
    fitness_level_required VARCHAR(50),
    age_restriction VARCHAR(50),
    special_requirements TEXT,

    -- Status & Assignment
    status experience_status DEFAULT 'pending',
    guide_id INTEGER REFERENCES users(id) ON DELETE SET NULL,

    -- Meeting Point
    meeting_location VARCHAR(255),
    pickup_required BOOLEAN DEFAULT false,
    pickup_location VARCHAR(255),
    pickup_time TIME,

    -- Timestamps
    confirmed_at TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_experience_bookings_guest ON experience_bookings(guest_id);
CREATE INDEX idx_experience_bookings_date ON experience_bookings(experience_date);
CREATE INDEX idx_experience_bookings_status ON experience_bookings(status);

-- =====================================================
-- TRIGGERS FOR AUTOMATIC TIMESTAMP UPDATES
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_service_requests_updated_at BEFORE UPDATE ON service_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_messages_updated_at BEFORE UPDATE ON guest_messages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_preferences_updated_at BEFORE UPDATE ON guest_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_notes_updated_at BEFORE UPDATE ON guest_notes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_insights_updated_at BEFORE UPDATE ON guest_insights FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guest_metrics_updated_at BEFORE UPDATE ON guest_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dining_reservations_updated_at BEFORE UPDATE ON dining_reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_experience_bookings_updated_at BEFORE UPDATE ON experience_bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS FOR EASY DATA ACCESS
-- =====================================================

-- Complete guest profile view
CREATE OR REPLACE VIEW guest_profile_view AS
SELECT
    u.id as guest_id,
    u.username,
    u.email,
    u.full_name,
    u.phone AS phone_number,
    u.profile_image_url AS profile_picture,
    u.created_at as member_since,

    -- Current booking
    b.id as current_booking_id,
    b.booking_number,
    b.status as booking_status,
    b.check_in_date,
    b.check_out_date,
    b.number_of_nights,

    -- Apartment
    a.unit_number,
    a.building,
    ac.display_name as apartment_type,

    -- Metrics
    gm.total_revenue,
    gm.total_stays,
    gm.average_satisfaction_score,
    gm.loyalty_tier,
    gm.is_vip,

    -- Preferences exist
    CASE WHEN gp.id IS NOT NULL THEN true ELSE false END as has_preferences

FROM users u
LEFT JOIN bookings b ON u.id = b.user_id AND b.status IN ('confirmed', 'checked_in')
LEFT JOIN apartments a ON b.apartment_id = a.id
LEFT JOIN apartment_categories ac ON a.category_id = ac.id
LEFT JOIN guest_metrics gm ON u.id = gm.guest_id
LEFT JOIN guest_preferences gp ON u.id = gp.guest_id
WHERE u.role_id = (SELECT id FROM roles WHERE name = 'guest');

-- Active service requests view
CREATE OR REPLACE VIEW active_service_requests_view AS
SELECT
    sr.*,
    u.full_name as guest_name,
    u.email as guest_email,
    a.unit_number,
    staff.full_name as assigned_to_name
FROM service_requests sr
JOIN users u ON sr.guest_id = u.id
LEFT JOIN apartments a ON sr.apartment_id = a.id
LEFT JOIN users staff ON sr.assigned_to = staff.id
WHERE sr.status NOT IN ('completed', 'cancelled')
ORDER BY
    CASE sr.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
    END,
    sr.created_at;

-- =====================================================
-- SEED DATA FOR TESTING
-- =====================================================

-- This will be populated by the API when guests are created
-- Initial setup creates empty preferences for all existing guests
INSERT INTO guest_preferences (guest_id)
SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'guest')
ON CONFLICT (guest_id) DO NOTHING;

-- Initialize metrics for existing guests
INSERT INTO guest_metrics (guest_id)
SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'guest')
ON CONFLICT (guest_id) DO NOTHING;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE service_requests IS 'Comprehensive service request tracking system for all guest requests across all departments';
COMMENT ON TABLE guest_messages IS 'Direct messaging between staff/managers and guests, separate from concierge chat';
COMMENT ON TABLE guest_preferences IS 'Detailed guest preferences across wellness, dining, experiences, residence, and communication';
COMMENT ON TABLE guest_notes IS 'Staff observations, alerts, and important information about guests';
COMMENT ON TABLE guest_tags IS 'Flexible tagging system for categorizing and flagging guests';
COMMENT ON TABLE guest_insights IS 'AI-generated insights, predictions, and recommendations about guest behavior';
COMMENT ON TABLE guest_activities IS 'Complete timeline of all guest interactions and activities throughout their journey';
COMMENT ON TABLE guest_metrics IS 'Aggregated analytics and performance metrics for each guest';
COMMENT ON TABLE dining_reservations IS 'Restaurant and dining reservation management system';
COMMENT ON TABLE experience_bookings IS 'Tours, activities, and experience booking management';

-- Migration complete!
