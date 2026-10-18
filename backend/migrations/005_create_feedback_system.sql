-- Migration: Create Feedback/Testimonials System
-- Description: Allows guests to submit feedback, testimonials, and improvement suggestions

-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,

  -- Submitter Information
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(50),

  -- Feedback Type & Content
  feedback_type VARCHAR(50) DEFAULT 'general', -- 'testimonial', 'general', 'suggestion', 'complaint'
  rating INTEGER CHECK (rating >= 1 AND rating <= 5), -- Overall rating (1-5 stars)

  -- Testimonial specific (if they want it public)
  testimonial_text TEXT, -- What they want to say publicly
  role VARCHAR(255), -- e.g., "Business Traveler", "Tourist", "Local Resident"
  allow_public_display BOOLEAN DEFAULT false, -- Do they allow us to show their testimonial publicly?

  -- General Feedback
  what_went_well TEXT, -- Positive feedback
  areas_for_improvement TEXT, -- Constructive criticism
  additional_comments TEXT, -- Any other comments

  -- Admin Management
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'reviewed', 'approved', 'rejected'
  is_featured BOOLEAN DEFAULT false, -- Highlight on homepage
  admin_notes TEXT, -- Internal notes from admin

  -- Photo/Avatar
  image_url VARCHAR(500), -- Optional uploaded photo or avatar

  -- Audit fields
  reviewed_by INTEGER REFERENCES users(id), -- Admin who reviewed
  reviewed_at TIMESTAMP,
  approved_by INTEGER REFERENCES users(id), -- Admin who approved for public display
  approved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_feedback_status ON feedback(status);
CREATE INDEX idx_feedback_type ON feedback(feedback_type);
CREATE INDEX idx_feedback_created_at ON feedback(created_at DESC);
CREATE INDEX idx_feedback_public_display ON feedback(allow_public_display, status) WHERE allow_public_display = true AND status = 'approved';

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feedback_updated_at_trigger
  BEFORE UPDATE ON feedback
  FOR EACH ROW
  EXECUTE FUNCTION update_feedback_updated_at();

-- Insert some sample approved testimonials for initial display
INSERT INTO feedback (name, email, role, rating, testimonial_text, feedback_type, allow_public_display, status, approved_at)
VALUES
  ('Sarah Johnson', 'sarah.j@example.com', 'Business Traveler', 5,
   'The smart access system made check-in so easy! I arrived late at night and had no issues getting in. The apartment was immaculate and the Smart TV had everything I needed.',
   'testimonial', true, 'approved', CURRENT_TIMESTAMP),

  ('David Mbah', 'david.m@example.com', 'Local Resident', 5,
   'I stayed for 3 months while my house was being renovated. The gym and pool made it feel like a luxury resort. Best long-term rental experience in Cameroon!',
   'testimonial', true, 'approved', CURRENT_TIMESTAMP),

  ('Marie Dubois', 'marie.d@example.com', 'Tourist', 5,
   'Faysha exceeded all expectations. The location, amenities, and service were perfect. I especially loved having a full kitchen and the concierge helped with all my restaurant bookings.',
   'testimonial', true, 'approved', CURRENT_TIMESTAMP);

COMMENT ON TABLE feedback IS 'Stores customer feedback, testimonials, and improvement suggestions';
COMMENT ON COLUMN feedback.feedback_type IS 'Type of feedback: testimonial, general, suggestion, complaint';
COMMENT ON COLUMN feedback.allow_public_display IS 'Whether customer allows their testimonial to be displayed publicly';
COMMENT ON COLUMN feedback.status IS 'pending (new), reviewed (admin read), approved (live on site), rejected (not suitable)';
