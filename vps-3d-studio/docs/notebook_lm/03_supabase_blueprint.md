# 03: Supabase Integration Blueprint

This document provides the technical roadmap for connecting the **SignFabricator OS** frontend to a **Supabase** backend.

## 1. Database Schema (PostgreSQL)

Create a table to store configurations and their associated metadata.

```sql
-- Table for storing sign designs and quotes
CREATE TABLE sign_quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id),
  
  -- The "Cartridge"
  config_json JSONB NOT NULL,
  
  -- Calculated Metadata (for easy filtering/reporting)
  project_name TEXT,
  total_price NUMERIC(12, 2),
  status TEXT DEFAULT 'draft', -- draft, quoted, ordered, completed
  
  -- Assets
  preview_image_url TEXT -- URL to Supabase Storage
);

-- Enable Row Level Security
ALTER TABLE sign_quotes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own quotes
CREATE POLICY "Users can manage their own quotes" 
ON sign_quotes FOR ALL 
USING (auth.uid() = user_id);
```

## 2. Storage Strategy

Use Supabase Storage to store high-resolution previews.

- **Bucket Name:** `sign-previews`
- **Structure:** `public/previews/{user_id}/{quote_id}.png`
- **Flow:**
    1. User saves a design.
    2. Frontend captures the `<canvas>` as a Blob.
    3. Frontend uploads Blob to Supabase Storage.
    4. Frontend saves the resulting URL to the `sign_quotes` table.

## 3. API Integration Layer

The frontend should use the `@supabase/supabase-js` client.

### Saving a Configuration
```typescript
const saveQuote = async (config: SignConfig, price: number, imageBlob: Blob) => {
  // 1. Upload Image
  const { data: imgData } = await supabase.storage
    .from('sign-previews')
    .upload(`previews/${userId}/${quoteId}.png`, imageBlob);

  // 2. Save Record
  const { data, error } = await supabase
    .from('sign_quotes')
    .insert({
      config_json: config,
      total_price: price,
      preview_image_url: imgData.path,
      user_id: supabase.auth.user().id
    });
};
```

### Loading a Configuration
```typescript
const loadQuote = async (id: string) => {
  const { data } = await supabase
    .from('sign_quotes')
    .select('config_json')
    .eq('id', id)
    .single();
    
  return data.config_json as SignConfig;
};
```

## 4. Real-time Collaboration (Optional)
Since the state is a single JSON object, you can use **Supabase Realtime** to sync the 3D viewer across multiple browsers. When one user changes a color, the `config_json` updates in the database, and all other connected clients receive the new "Cartridge" and re-render the 3D model instantly.

## Usage in NotebookLM
- Use this blueprint to configure your Supabase environment.
- Ask NotebookLM to "Generate a React hook for Supabase that syncs the SignConfig state in real-time."
