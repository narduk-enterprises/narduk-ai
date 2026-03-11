-- Add JSON attributes column to prompt_elements for structured storage
ALTER TABLE prompt_elements ADD COLUMN attributes TEXT;

-- Add lineage column to generations for structured generation tracking
ALTER TABLE generations ADD COLUMN lineage TEXT;
