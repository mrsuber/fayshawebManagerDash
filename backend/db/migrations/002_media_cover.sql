-- The cover photo of a residence: the image marked as main, else the first image (uploads were never marked, so
-- residence lists showed no photo while the detail page showed them all). Unit photos win over category photos.
CREATE OR REPLACE FUNCTION media_cover(p_apartment INTEGER, p_category INTEGER)
RETURNS TEXT AS $$
  SELECT file_url FROM apartment_media
   WHERE media_type = 'image' AND (apartment_id = p_apartment OR category_id = p_category)
   ORDER BY apartment_id IS NOT NULL DESC, is_primary DESC, sort_order, id
   LIMIT 1
$$ LANGUAGE sql STABLE;

-- Unit photos in a category, for a category that has none of its own.
CREATE OR REPLACE FUNCTION category_cover(p_category INTEGER)
RETURNS TEXT AS $$
  SELECT COALESCE(
    media_cover(NULL, p_category),
    (SELECT m.file_url FROM apartment_media m JOIN apartments a ON a.id = m.apartment_id
      WHERE a.category_id = p_category AND m.media_type = 'image'
      ORDER BY m.is_primary DESC, m.sort_order, m.id LIMIT 1))
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE VIEW available_apartments_view AS
SELECT
  a.id, a.unit_number, a.floor, a.building, a.status, a.custom_price,
  c.id AS category_id, c.name AS category_name, c.display_name AS category_display_name,
  c.description AS category_description, c.base_price, COALESCE(a.custom_price, c.base_price) AS effective_price,
  c.max_guests, c.size_sqm, c.bedrooms, c.bathrooms, c.features, c.amenities,
  media_cover(a.id, a.category_id) AS primary_image,
  (SELECT COUNT(*) FROM apartment_media WHERE apartment_id = a.id) AS media_count
FROM apartments a
JOIN apartment_categories c ON a.category_id = c.id
WHERE a.is_active = true AND c.is_active = true;
