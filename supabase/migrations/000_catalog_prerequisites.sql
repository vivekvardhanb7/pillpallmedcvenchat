-- Recovery/bootstrap step for projects where the main migration reports:
--   relation "public.products" does not exist
--
-- Run this complete file first, without selecting only part of it. Then run
-- 001_medical_chatbot_schema.sql from the beginning.

create extension if not exists pgcrypto;

create table if not exists public.countries (
  code text primary key check (code ~ '^[A-Z]{2}$'),
  name text not null,
  default_language_code text not null default 'en',
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references public.countries(code),
  sku text not null,
  barcode text,
  product_name text not null,
  brand_name text,
  active_ingredients jsonb not null default '[]'::jsonb
    check (jsonb_typeof(active_ingredients) = 'array'),
  strength_label text,
  dosage_form text,
  route text,
  pack_size text,
  manufacturer text,
  market_status text not null default 'unknown'
    check (market_status in ('unknown', 'commercialised', 'retired', 'noncommercialised')),
  sale_classification text,
  price numeric(12,2) check (price is null or price >= 0),
  currency_code text check (currency_code is null or currency_code ~ '^[A-Z]{3}$'),
  label_url text,
  label_version text,
  source_document text,
  source_page text,
  source_checked_at date,
  research_notes text,
  clinical_status text not null default 'draft'
    check (clinical_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  legal_status text not null default 'draft'
    check (legal_status in ('draft', 'in_review', 'approved', 'rejected', 'expired')),
  chatbot_enabled boolean not null default false,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (country_code, sku),
  unique (country_code, barcode),
  constraint product_enable_requires_approval check (
    not chatbot_enabled
    or (
      market_status = 'commercialised'
      and clinical_status = 'approved'
      and legal_status = 'approved'
      and label_url is not null
      and label_version is not null
    )
  )
);

select
  to_regclass('public.countries') as countries_created,
  to_regclass('public.products') as products_created;

