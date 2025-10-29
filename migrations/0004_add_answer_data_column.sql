-- Add answer_data column to questions table for storing structured answer data
-- Used by new question types: matching, fill_blank, ranking, odd_one_out, hotspot

ALTER TABLE questions ADD COLUMN answer_data TEXT;

-- answer_data will store JSON for different question types:
-- matching: { pairs: [{left, right, order}] }
-- fill_blank: { blanks: ['answer1', 'answer2'] }
-- ranking: { items: [{text, correctOrder}] }
-- odd_one_out: { items: ['item1', 'item2'], oddIndex: 2 }
-- hotspot: { imageUrl: 'url', regions: [{x, y, width, height, label}] }
