/**
 * Sample data for working on the site without a backend (REACT_APP_USE_MOCKS=true, development only).
 * Categories mirror the seed rows in backend/migrations/004_create_booking_system.sql.
 */
export const categories = [
  {
    id: 1, name: 'studio', display_name: 'Studio Apartment', description: 'Modern studio with open-plan living space',
    base_price: 28000, max_guests: 2, size_sqm: 35, bedrooms: 0, bathrooms: 1, apartment_count: 3, is_active: true,
    features: ['WiFi', 'Smart TV', 'Air Conditioning', 'Kitchenette', 'Work Desk'],
    amenities: ['Pool Access', 'Gym Access', 'Smart Access', 'Housekeeping'],
  },
  {
    id: 2, name: '1br', display_name: 'One Bedroom Apartment', description: 'Spacious one bedroom with separate living area',
    base_price: 45000, max_guests: 3, size_sqm: 50, bedrooms: 1, bathrooms: 1, apartment_count: 4, is_active: true,
    features: ['WiFi', 'Smart TV', 'Air Conditioning', 'Full Kitchen', 'Balcony', 'Work Desk'],
    amenities: ['Pool Access', 'Gym Access', 'Smart Access', 'Housekeeping', 'Concierge'],
  },
  {
    id: 3, name: '2br', display_name: 'Two Bedroom Apartment', description: 'Family-friendly two bedroom apartment',
    base_price: 65000, max_guests: 5, size_sqm: 75, bedrooms: 2, bathrooms: 2, apartment_count: 3, is_active: true,
    features: ['WiFi', '2 Smart TVs', 'Air Conditioning', 'Full Kitchen', 'Balcony', 'Dining Area', 'Work Desk'],
    amenities: ['Pool Access', 'Gym Access', 'Smart Access', 'Housekeeping', 'Concierge', 'Parking'],
  },
  {
    id: 4, name: 'executive', display_name: 'Executive Suite', description: 'Luxury executive suite with premium amenities',
    base_price: 95000, max_guests: 4, size_sqm: 90, bedrooms: 2, bathrooms: 2, apartment_count: 3, is_active: true,
    features: ['WiFi', '2 Smart TVs', 'Premium Air Conditioning', 'Gourmet Kitchen', 'Terrace', 'Premium Furnishing', 'Executive Work Space'],
    amenities: ['Private Pool Access', 'Gym Access', 'Smart Access', 'Daily Housekeeping', '24/7 Concierge', 'Parking', 'Priority Services'],
  },
];

const units = [
  ['S101', 1, 1, 'Block A'], ['S201', 1, 2, 'Block A'], ['S301', 1, 3, 'Block A'],
  ['1B101', 2, 1, 'Block B'], ['1B102', 2, 1, 'Block B', 46000], ['1B201', 2, 2, 'Block B'], ['1B202', 2, 2, 'Block B'],
  ['2B101', 3, 1, 'Block C'], ['2B201', 3, 2, 'Block C', 68000], ['2B301', 3, 3, 'Block C'],
  ['EX101', 4, 1, 'Executive Wing'], ['EX201', 4, 2, 'Executive Wing', 98000], ['EX301', 4, 3, 'Executive Wing'],
];

export function availability() {
  return units.map(([unit, categoryId, floor, building, custom], i) => {
    const c = categories.find((x) => x.id === categoryId);
    return {
      id: i + 1,
      unit_number: unit,
      floor,
      building,
      category_id: categoryId,
      max_guests: c.max_guests,
      price_per_night: custom || c.base_price,
      // One unit per category is shown as taken so the UI's "sold out" paths can be seen.
      is_available: i % 4 !== 2,
      primary_image: null,
      panorama_360_url: null,
    };
  });
}

let nextBooking = 1040;
export function createBooking(payload) {
  const unit = availability().find((u) => u.id === payload.apartment_id);
  const nights = Math.max(1, Math.round((new Date(payload.check_out_date) - new Date(payload.check_in_date)) / 86400000));
  const total = (unit?.price_per_night || 0) * nights;
  nextBooking += 1;
  return {
    id: nextBooking,
    booking_number: `FAY-2026-${nextBooking}`,
    status: 'pending',
    price_per_night: unit?.price_per_night,
    number_of_nights: nights,
    total_price: total,
    final_price: total,
    unit_number: unit?.unit_number,
  };
}

export const jobs = [
  {
    id: 1, title: 'Guest Experience Host', department_name: 'Front of House', employment_type: 'full-time', location: 'Cameroon',
    description: 'Welcome residents, look after their stay from arrival to departure, and work hand in hand with the concierge team.',
    requirements: 'Hospitality experience · English and French',
  },
  {
    id: 2, title: 'Spa Therapist', department_name: 'Wellness', employment_type: 'full-time', location: 'Cameroon',
    description: 'Deliver massage and recovery treatments in the Faysha wellness club.',
    requirements: 'Certified massage therapist',
  },
];
