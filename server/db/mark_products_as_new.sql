-- Migration: Mark recent products as new arrivals to populate the New Arrivals section
-- This runs once to set up initial new arrivals

-- Mark the 6 most recently created products as new arrivals
UPDATE products 
SET is_new = true 
WHERE id IN (
  SELECT id FROM products 
  ORDER BY id DESC 
  LIMIT 6
);

-- Verify the update
-- SELECT id, name, is_new FROM products WHERE is_new = true ORDER BY id DESC;

