# DATABASE_SCHEMA.md — Normalized Pharmaceutical & Clinical Database Schema

**Date:** 2026-11-05  
**Audience:** Database Architects, Clinical Decision Support Engineers  
**Target:** PostgreSQL 15+ / Supabase & Local SQLite Engine

---

## 1. Entity-Relationship Overview

```
                      ┌──────────────────────┐
                      │  active_ingredients  │
                      └──────────┬───────────┘
                                 │ 1:N
           ┌─────────────────────┼─────────────────────┐
           │ 1:N                 │ 1:N                 │ 1:N
           ▼                     ▼                     ▼
┌─────────────────────┐ ┌──────────────────┐ ┌──────────────────────┐
│ ingredient_synonyms │ │product_ingredients││  drug_interactions   │
└─────────────────────┘ └────────┬─────────┘ └──────────────────────┘
                                 │ N:1
                                 ▼
                      ┌──────────────────────┐
                      │  medicine_products   │
                      └──────────┬───────────┘
           ┌─────────────────────┼─────────────────────┐
           │ 1:N                 │ 1:N                 │ 1:N
           ▼                     ▼                     ▼
┌──────────────────────┐┌──────────────────┐ ┌──────────────────────┐
│country_registrations ││ medicine_labels  │ │  vending_inventory   │
└──────────────────────┘└──────────────────┘ └──────────────────────┘
```

---

## 2. Table Specifications

### 2.1 Core Active Ingredients & Formulations
```sql
-- 1. Standardized Active Ingredients
CREATE TABLE public.active_ingredients (
    id VARCHAR(64) PRIMARY KEY, -- e.g. 'ING-PARACETAMOL'
    inn_name VARCHAR(255) NOT NULL, -- International Nonproprietary Name
    atc_code VARCHAR(16), -- e.g. 'N02BE01'
    therapeutic_category VARCHAR(128) NOT NULL, -- e.g. 'Analgesic / Antipyretic'
    max_single_dose_mg NUMERIC(8,2), -- e.g. 1000.00
    max_daily_dose_mg NUMERIC(8,2), -- e.g. 4000.00
    min_dose_interval_hours NUMERIC(4,2), -- e.g. 4.00
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ingredient Synonyms (Multilingual & Colloquial)
CREATE TABLE public.ingredient_synonyms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id VARCHAR(64) REFERENCES public.active_ingredients(id),
    synonym_name VARCHAR(255) NOT NULL, -- e.g. 'acetaminophen', 'paracetamolum', 'APAP'
    language_code VARCHAR(8) NOT NULL -- 'en', 'fr', 'ar', 'de'
);

-- 3. Standardized Dosage Forms
CREATE TABLE public.dosage_forms (
    id VARCHAR(64) PRIMARY KEY, -- 'FORM-EFF-TAB'
    form_name VARCHAR(128) NOT NULL, -- 'Effervescent Tablet'
    route VARCHAR(64) NOT NULL, -- 'oral', 'topical', 'rectal', 'nasal'
    is_solid BOOLEAN NOT NULL DEFAULT TRUE,
    requires_water BOOLEAN NOT NULL DEFAULT TRUE
);
```

### 2.2 Medicine Products & Multi-Country Registration
```sql
-- 4. Medicine Products (Master Catalog)
CREATE TABLE public.medicine_products (
    id VARCHAR(64) PRIMARY KEY, -- 'PROD-MA-DOLIPRANE-500-EFF'
    brand_name VARCHAR(255) NOT NULL, -- 'DOLIPRANE'
    full_name VARCHAR(255) NOT NULL, -- 'DOLIPRANE 500 mg effervescent tablet'
    dosage_form_id VARCHAR(64) REFERENCES public.dosage_forms(id),
    manufacturer VARCHAR(255), -- 'BOTTU'
    pack_size VARCHAR(128), -- 'box of 16'
    is_combination BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Product Ingredients (Normalized Linking Table)
CREATE TABLE public.product_ingredients (
    product_id VARCHAR(64) REFERENCES public.medicine_products(id),
    ingredient_id VARCHAR(64) REFERENCES public.active_ingredients(id),
    strength_value NUMERIC(8,2) NOT NULL, -- 500.00
    strength_unit VARCHAR(16) NOT NULL, -- 'mg', 'g', 'mcg', 'ml'
    PRIMARY KEY (product_id, ingredient_id)
);

-- 6. Country Registrations (Jurisdiction Isolation)
CREATE TABLE public.country_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id VARCHAR(64) REFERENCES public.medicine_products(id),
    country_code VARCHAR(4) NOT NULL, -- 'MA', 'IN', 'INT'
    registration_number VARCHAR(128), -- Moroccan AMM Number / CDSCO Number
    regulatory_authority VARCHAR(64) NOT NULL, -- 'AMMPS', 'CDSCO', 'FDA'
    market_status VARCHAR(64) NOT NULL, -- 'commercialised', 'withdrawn', 'unregistered'
    prescription_category VARCHAR(64) NOT NULL, -- 'otc', 'prescription_only', 'hospital_only'
    retail_price NUMERIC(10,2), -- Price in local currency
    currency_code VARCHAR(4) NOT NULL, -- 'MAD', 'INR', 'EUR'
    verified_at TIMESTAMPTZ,
    reviewer_name VARCHAR(128)
);
```

### 2.3 Clinical Rules, Safety & Interlocks
```sql
-- 7. Drug-Drug Interactions
CREATE TABLE public.drug_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_a_id VARCHAR(64) REFERENCES public.active_ingredients(id),
    ingredient_b_id VARCHAR(64) REFERENCES public.active_ingredients(id),
    severity VARCHAR(32) NOT NULL, -- 'severe', 'moderate', 'minor'
    clinical_effect TEXT NOT NULL,
    action_required VARCHAR(64) NOT NULL -- 'block_recommendation', 'warn_user'
);

-- 8. Contraindications & Disease Exclusions
CREATE TABLE public.contraindications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ingredient_id VARCHAR(64) REFERENCES public.active_ingredients(id),
    condition_code VARCHAR(64) NOT NULL, -- 'severe_hepatic_impairment', 'active_peptic_ulcer'
    severity VARCHAR(32) NOT NULL, -- 'absolute', 'relative'
    explanation TEXT NOT NULL
);

-- 9. Alternative Rules (Levels 1 to 4)
CREATE TABLE public.alternative_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_product_id VARCHAR(64) REFERENCES public.medicine_products(id),
    alternative_product_id VARCHAR(64) REFERENCES public.medicine_products(id),
    equivalence_level INTEGER NOT NULL CHECK (equivalence_level BETWEEN 1 AND 4),
    -- Level 1: Exact equivalent active ingredient, strength, and route
    -- Level 2: Same active ingredient, different strength or dosage form
    -- Level 3: Different active ingredient, same therapeutic indication
    -- Level 4: No safe alternative established
    clinical_precautions TEXT
);

-- 10. Physical Vending Machine Inventory
CREATE TABLE public.vending_inventory (
    slot_number INTEGER PRIMARY KEY, -- 1 to 24
    product_id VARCHAR(64) REFERENCES public.medicine_products(id),
    current_quantity INTEGER NOT NULL DEFAULT 0,
    max_capacity INTEGER NOT NULL DEFAULT 15,
    lot_number VARCHAR(64),
    expiry_date DATE,
    is_operational BOOLEAN NOT NULL DEFAULT TRUE
);
```
