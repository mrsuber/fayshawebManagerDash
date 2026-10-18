-- Seed Wellness Journey Bookings for Testing
-- This creates completed bookings for user 'msiysinyuy' to test booking history UI
-- Created: 2026-09-18

-- ============================================
-- IMPORTANT: This script assumes:
-- 1. Migration 012 has been run (wellness journey tables exist)
-- 2. User 'msiysinyuy' exists in the database
-- ============================================

-- First, let's find the user ID for msiysinyuy
DO $$
DECLARE
  v_user_id INTEGER;
  v_restore_journey_id INTEGER;
  v_recharge_journey_id INTEGER;
  v_booking1_id INTEGER;
  v_booking2_id INTEGER;
  v_booking3_id INTEGER;
  v_stage_id INTEGER;
BEGIN

  -- Find user msiysinyuy
  SELECT id INTO v_user_id
  FROM users
  WHERE username = 'msiysinyuy' OR email LIKE '%msiysinyuy%'
  LIMIT 1;

  -- If user not found, show error message
  IF v_user_id IS NULL THEN
    RAISE NOTICE '============================================';
    RAISE NOTICE 'ERROR: User msiysinyuy not found!';
    RAISE NOTICE 'Available users:';
    FOR v_user_id IN
      SELECT id FROM users WHERE role_id = (SELECT id FROM roles WHERE name = 'guest') LIMIT 5
    LOOP
      RAISE NOTICE 'User ID: %', v_user_id;
    END LOOP;
    RAISE EXCEPTION 'User msiysinyuy not found. Please update the script with a valid user.';
  END IF;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Found user: msiysinyuy (ID: %)', v_user_id;
  RAISE NOTICE '============================================';

  -- Get journey IDs
  SELECT id INTO v_restore_journey_id FROM wellness_journeys WHERE slug = 'restore' LIMIT 1;
  SELECT id INTO v_recharge_journey_id FROM wellness_journeys WHERE slug = 'recharge' LIMIT 1;

  -- ============================================
  -- BOOKING 1: Completed RESTORE journey (1 week ago)
  -- ============================================
  INSERT INTO wellness_journey_bookings (
    user_id,
    journey_id,
    journey_name,
    booking_date,
    start_time,
    end_time,
    total_duration,
    status,
    current_stage,
    payment_status,
    payment_amount,
    completed_at,
    created_at
  ) VALUES (
    v_user_id,
    v_restore_journey_id,
    'RESTORE',
    CURRENT_DATE - INTERVAL '7 days',
    '09:00:00',
    '10:30:00',
    90,
    'completed',
    3,
    'paid',
    150.00,
    CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '2 hours',
    CURRENT_TIMESTAMP - INTERVAL '8 days'
  ) RETURNING id INTO v_booking1_id;

  -- Add stage 1: Massage Therapy (completed with rating)
  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 1;
  INSERT INTO wellness_journey_booking_stages (
    booking_id,
    stage_id,
    stage_number,
    stage_name,
    scheduled_start,
    scheduled_end,
    actual_start,
    actual_end,
    status,
    staff_notes,
    guest_rating,
    guest_feedback
  ) VALUES (
    v_booking1_id,
    v_stage_id,
    1,
    'Massage Therapy',
    '09:00:00',
    '10:00:00',
    CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '9 hours',
    CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '10 hours',
    'completed',
    'Guest requested deep tissue focus on shoulders',
    5,
    'Absolutely amazing! The therapist really worked out all the tension in my shoulders. Best massage I''ve ever had.'
  );

  -- Add stage 2: Steam Room (completed with rating)
  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 2;
  INSERT INTO wellness_journey_booking_stages (
    booking_id,
    stage_id,
    stage_number,
    stage_name,
    scheduled_start,
    scheduled_end,
    actual_start,
    actual_end,
    status,
    staff_notes,
    guest_rating,
    guest_feedback
  ) VALUES (
    v_booking1_id,
    v_stage_id,
    2,
    'Steam Room',
    '10:00:00',
    '10:20:00',
    CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '10 hours',
    CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '10 hours' + INTERVAL '20 minutes',
    'completed',
    'Guest enjoyed the eucalyptus infusion',
    4,
    'Very relaxing, though it was a bit hot. The eucalyptus scent was wonderful.'
  );

  -- Add stage 3: Cool Down & Tea (completed with rating)
  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 3;
  INSERT INTO wellness_journey_booking_stages (
    booking_id,
    stage_id,
    stage_number,
    stage_name,
    scheduled_start,
    scheduled_end,
    actual_start,
    actual_end,
    status,
    staff_notes,
    guest_rating,
    guest_feedback
  ) VALUES (
    v_booking1_id,
    v_stage_id,
    3,
    'Cool Down & Tea',
    '10:20:00',
    '10:30:00',
    CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '10 hours' + INTERVAL '20 minutes',
    CURRENT_TIMESTAMP - INTERVAL '7 days' + INTERVAL '10 hours' + INTERVAL '30 minutes',
    'completed',
    'Guest chose chamomile tea',
    5,
    'Perfect way to end the session. The tea was delicious and the quiet space was exactly what I needed.'
  );

  RAISE NOTICE '✓ Created completed RESTORE booking from 1 week ago (ID: %)', v_booking1_id;

  -- ============================================
  -- BOOKING 2: Completed RESTORE journey (2 days ago)
  -- ============================================
  INSERT INTO wellness_journey_bookings (
    user_id,
    journey_id,
    journey_name,
    booking_date,
    start_time,
    end_time,
    total_duration,
    status,
    current_stage,
    payment_status,
    payment_amount,
    special_requests,
    completed_at,
    created_at
  ) VALUES (
    v_user_id,
    v_restore_journey_id,
    'RESTORE',
    CURRENT_DATE - INTERVAL '2 days',
    '14:00:00',
    '15:30:00',
    90,
    'completed',
    3,
    'paid',
    150.00,
    'Please use lavender oil for the massage',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '6 hours',
    CURRENT_TIMESTAMP - INTERVAL '3 days'
  ) RETURNING id INTO v_booking2_id;

  -- Add stages for booking 2 (all completed with ratings)
  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 1;
  INSERT INTO wellness_journey_booking_stages (
    booking_id, stage_id, stage_number, stage_name,
    scheduled_start, scheduled_end,
    actual_start, actual_end,
    status, guest_rating, guest_feedback
  ) VALUES (
    v_booking2_id, v_stage_id, 1, 'Massage Therapy',
    '14:00:00', '15:00:00',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '14 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '15 hours',
    'completed', 5, 'The lavender oil was perfect. Felt so relaxed after this session.'
  );

  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 2;
  INSERT INTO wellness_journey_booking_stages (
    booking_id, stage_id, stage_number, stage_name,
    scheduled_start, scheduled_end,
    actual_start, actual_end,
    status, guest_rating, guest_feedback
  ) VALUES (
    v_booking2_id, v_stage_id, 2, 'Steam Room',
    '15:00:00', '15:20:00',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '15 hours',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '15 hours' + INTERVAL '20 minutes',
    'completed', 5, 'Temperature was perfect this time. Really helped with muscle recovery.'
  );

  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 3;
  INSERT INTO wellness_journey_booking_stages (
    booking_id, stage_id, stage_number, stage_name,
    scheduled_start, scheduled_end,
    actual_start, actual_end,
    status, guest_rating, guest_feedback
  ) VALUES (
    v_booking2_id, v_stage_id, 3, 'Cool Down & Tea',
    '15:20:00', '15:30:00',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '15 hours' + INTERVAL '20 minutes',
    CURRENT_TIMESTAMP - INTERVAL '2 days' + INTERVAL '15 hours' + INTERVAL '30 minutes',
    'completed', 5, 'Love the peaceful atmosphere. This is becoming my favorite part!'
  );

  RAISE NOTICE '✓ Created completed RESTORE booking from 2 days ago (ID: %)', v_booking2_id;

  -- ============================================
  -- BOOKING 3: Upcoming RESTORE journey (tomorrow)
  -- ============================================
  INSERT INTO wellness_journey_bookings (
    user_id,
    journey_id,
    journey_name,
    booking_date,
    start_time,
    end_time,
    total_duration,
    status,
    current_stage,
    payment_status,
    payment_amount,
    special_requests,
    created_at
  ) VALUES (
    v_user_id,
    v_restore_journey_id,
    'RESTORE',
    CURRENT_DATE + INTERVAL '1 day',
    '10:00:00',
    '11:30:00',
    90,
    'upcoming',
    1,
    'paid',
    150.00,
    'Looking forward to another relaxing session!',
    CURRENT_TIMESTAMP
  ) RETURNING id INTO v_booking3_id;

  -- Add stages for upcoming booking (all pending)
  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 1;
  INSERT INTO wellness_journey_booking_stages (
    booking_id, stage_id, stage_number, stage_name,
    scheduled_start, scheduled_end, status
  ) VALUES (
    v_booking3_id, v_stage_id, 1, 'Massage Therapy',
    '10:00:00', '11:00:00', 'pending'
  );

  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 2;
  INSERT INTO wellness_journey_booking_stages (
    booking_id, stage_id, stage_number, stage_name,
    scheduled_start, scheduled_end, status
  ) VALUES (
    v_booking3_id, v_stage_id, 2, 'Steam Room',
    '11:00:00', '11:20:00', 'pending'
  );

  SELECT id INTO v_stage_id FROM wellness_journey_stages WHERE journey_id = v_restore_journey_id AND stage_number = 3;
  INSERT INTO wellness_journey_booking_stages (
    booking_id, stage_id, stage_number, stage_name,
    scheduled_start, scheduled_end, status
  ) VALUES (
    v_booking3_id, v_stage_id, 3, 'Cool Down & Tea',
    '11:20:00', '11:30:00', 'pending'
  );

  RAISE NOTICE '✓ Created upcoming RESTORE booking for tomorrow (ID: %)', v_booking3_id;

  RAISE NOTICE '============================================';
  RAISE NOTICE 'Seed data created successfully!';
  RAISE NOTICE 'User: msiysinyuy (ID: %)', v_user_id;
  RAISE NOTICE '  - 2 completed RESTORE sessions with ratings';
  RAISE NOTICE '  - 1 upcoming RESTORE session';
  RAISE NOTICE '============================================';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: %', SQLERRM;
    RAISE;
END $$;
