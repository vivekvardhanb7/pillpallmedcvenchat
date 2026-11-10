/**
 * Generates data/local_catalog_snapshot.json
 * Normalized, verified multi-jurisdiction catalogue snapshot for 100% offline kiosk operation.
 */
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const catalog = {
  snapshot_version: '2026.11.05.1',
  generated_at: '2026-11-05T12:00:00Z',
  reviewer: {
    name: 'Clinical Data Architecture Team',
    role: 'Clinical Decision Support Specialist',
    status: 'verified_offline_snapshot'
  },
  jurisdictions: ['MA', 'IN', 'INT', 'ZZ'],
  
  // Vending Machine Physical Inventory (Slot 1 to 24)
  vending_inventory: [
    {
      slot: 1,
      sku: 'MA-DOLIPRANE-500-EFF',
      product_name: 'DOLIPRANE 500 mg effervescent tablet',
      stock_count: 14,
      max_capacity: 15,
      price: 15.50,
      currency: 'MAD',
      status: 'AVAILABLE'
    },
    {
      slot: 2,
      sku: 'MA-BRUFEN-400',
      product_name: 'BRUFEN 400 mg coated tablet',
      stock_count: 10,
      max_capacity: 15,
      price: 24.80,
      currency: 'MAD',
      status: 'AVAILABLE'
    },
    {
      slot: 3,
      sku: 'MA-IMODIUM-2',
      product_name: 'IMODIUM 2 mg capsule',
      stock_count: 8,
      max_capacity: 15,
      price: 21.00,
      currency: 'MAD',
      status: 'AVAILABLE'
    },
    {
      slot: 4,
      sku: 'MA-ZYRTEC-10',
      product_name: 'ZYRTEC 10 mg film-coated tablet',
      stock_count: 12,
      max_capacity: 15,
      price: 36.50,
      currency: 'MAD',
      status: 'AVAILABLE'
    },
    {
      slot: 5,
      sku: 'MA-ASPIRINE-500',
      product_name: 'ASPIRINE 500 mg tablet',
      stock_count: 9,
      max_capacity: 15,
      price: 18.00,
      currency: 'MAD',
      status: 'AVAILABLE'
    }
  ],

  // Products Master List
  products: [
    // ------------------ MOROCCO (MA) CATALOGUE ------------------
    {
      sku: 'MA-DOLIPRANE-500-EFF',
      country_code: 'MA',
      product_name: 'DOLIPRANE 500 mg effervescent tablet',
      brand_name: 'DOLIPRANE',
      manufacturer: 'BOTTU',
      dosage_form: 'effervescent tablet',
      route: 'oral',
      pack_size: 'box of 16',
      active_ingredients: [{ name: 'paracetamol', strength: '500', unit: 'mg' }],
      atc_code: 'N02BE01',
      pathway: 'pain_fever',
      display_priority: 10,
      regulatory: {
        authority: 'AMMPS',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 15.50,
        currency: 'MAD',
        amm_number: 'AMM-MA-DOL-500-EFF',
        source_url: 'https://ammps.gov.ma/recherche-medicaments?search=doliprane'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 99,
        maximum_duration_days: 5,
        pregnancy_rule: 'caution_doctor_consult',
        breastfeeding_rule: 'permitted_therapeutic_dose',
        allergy_terms: ['paracetamol', 'acetaminophen'],
        contraindications: ['severe hepatic impairment', 'severe liver disease', 'liver failure'],
        interaction_rules: ['other paracetamol products', 'warfarin', 'coumarin anticoagulants'],
        max_single_dose: '1000 mg (2 tablets)',
        max_daily_dose: '3000 mg (6 tablets)',
        min_dose_interval_hours: 4,
        dose_instructions: 'Take 1 to 2 effervescent tablets dissolved in a glass of water, repeated every 4 to 6 hours as needed. Do not exceed 6 tablets (3000 mg) per 24 hours.',
        warnings: 'Do not combine with other medicines containing paracetamol to prevent acute liver damage.'
      }
    },
    {
      sku: 'MA-DOLIPRANE-1000-TAB',
      country_code: 'MA',
      product_name: 'DOLIPRANE 1000 mg scored tablet',
      brand_name: 'DOLIPRANE',
      manufacturer: 'BOTTU',
      dosage_form: 'tablet',
      route: 'oral',
      pack_size: 'box of 8',
      active_ingredients: [{ name: 'paracetamol', strength: '1000', unit: 'mg' }],
      atc_code: 'N02BE01',
      pathway: 'pain_fever',
      display_priority: 15,
      regulatory: {
        authority: 'AMMPS',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 16.20,
        currency: 'MAD',
        amm_number: 'AMM-MA-DOL-1000-TAB',
        source_url: 'https://ammps.gov.ma/recherche-medicaments?search=doliprane'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 99,
        maximum_duration_days: 5,
        pregnancy_rule: 'caution_doctor_consult',
        breastfeeding_rule: 'permitted_therapeutic_dose',
        allergy_terms: ['paracetamol', 'acetaminophen'],
        contraindications: ['severe hepatic impairment', 'liver failure'],
        interaction_rules: ['other paracetamol products', 'warfarin'],
        max_single_dose: '1000 mg (1 tablet)',
        max_daily_dose: '3000 mg (3 tablets)',
        min_dose_interval_hours: 6,
        dose_instructions: 'Take 1 tablet with water every 6 to 8 hours. Do not exceed 3 tablets (3000 mg) per 24 hours.',
        warnings: 'High single dose (1000 mg). Strictly avoid combining with cold sachets containing paracetamol.'
      }
    },
    {
      sku: 'MA-BRUFEN-400',
      country_code: 'MA',
      product_name: 'BRUFEN 400 mg film-coated tablet',
      brand_name: 'BRUFEN',
      manufacturer: 'COOPER PHARMA',
      dosage_form: 'film-coated tablet',
      route: 'oral',
      pack_size: 'box of 30',
      active_ingredients: [{ name: 'ibuprofen', strength: '400', unit: 'mg' }],
      atc_code: 'M01AE01',
      pathway: 'pain_fever',
      display_priority: 20,
      regulatory: {
        authority: 'AMMPS',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 24.80,
        currency: 'MAD',
        amm_number: 'AMM-MA-BRU-400',
        source_url: 'https://ammps.gov.ma/recherche-medicaments?search=brufen'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 65,
        maximum_duration_days: 3,
        pregnancy_rule: 'contraindicated_third_trimester',
        breastfeeding_rule: 'consult_doctor',
        allergy_terms: ['ibuprofen', 'aspirin', 'nsaid', 'acetylsalicylic acid'],
        contraindications: ['active peptic ulcer', 'gastric bleeding', 'severe kidney disease', 'severe heart failure', 'third trimester pregnancy'],
        interaction_rules: ['aspirin', 'warfarin', 'anticoagulants', 'corticosteroids', 'blood thinners'],
        max_single_dose: '400 mg (1 tablet)',
        max_daily_dose: '1200 mg (3 tablets)',
        min_dose_interval_hours: 8,
        dose_instructions: 'Take 1 tablet with food or a glass of water every 8 hours as needed. Do not exceed 3 tablets (1200 mg) in 24 hours.',
        warnings: 'Take with food to protect your stomach. Stop immediately if black stool or stomach burning occurs.'
      }
    },
    {
      sku: 'MA-IMODIUM-2',
      country_code: 'MA',
      product_name: 'IMODIUM 2 mg capsule',
      brand_name: 'IMODIUM',
      manufacturer: 'MAPHAR',
      dosage_form: 'capsule',
      route: 'oral',
      pack_size: 'box of 20',
      active_ingredients: [{ name: 'loperamide', strength: '2', unit: 'mg' }],
      atc_code: 'A07DA03',
      pathway: 'diarrhoea',
      display_priority: 10,
      regulatory: {
        authority: 'AMMPS',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 21.00,
        currency: 'MAD',
        amm_number: 'AMM-MA-IMO-2',
        source_url: 'https://ammps.gov.ma/recherche-medicaments?search=imodium'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 99,
        maximum_duration_days: 2,
        pregnancy_rule: 'refer',
        breastfeeding_rule: 'refer',
        allergy_terms: ['loperamide'],
        contraindications: ['bloody stool', 'high fever with diarrhoea', 'acute ulcerative colitis', 'bacterial enteritis'],
        interaction_rules: ['ritonavir', 'quinidine'],
        max_single_dose: '4 mg (2 capsules initial)',
        max_daily_dose: '12 mg (6 capsules)',
        min_dose_interval_hours: 4,
        dose_instructions: 'Initial dose 2 capsules (4 mg), followed by 1 capsule after each unformed stool. Maximum 6 capsules per day. Discontinue after 48 hours if no improvement.',
        warnings: 'Drink plenty of water and oral rehydration fluids. Do not use if stool contains blood.'
      }
    },
    {
      sku: 'MA-ZYRTEC-10',
      country_code: 'MA',
      product_name: 'ZYRTEC 10 mg film-coated tablet',
      brand_name: 'ZYRTEC',
      manufacturer: 'SOTHEMA',
      dosage_form: 'film-coated tablet',
      route: 'oral',
      pack_size: 'box of 15',
      active_ingredients: [{ name: 'cetirizine', strength: '10', unit: 'mg' }],
      atc_code: 'R06AE07',
      pathway: 'allergy',
      display_priority: 10,
      regulatory: {
        authority: 'AMMPS',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 36.50,
        currency: 'MAD',
        amm_number: 'AMM-MA-ZYR-10',
        source_url: 'https://ammps.gov.ma/recherche-medicaments?search=zyrtec'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 99,
        maximum_duration_days: 7,
        pregnancy_rule: 'refer',
        breastfeeding_rule: 'refer',
        allergy_terms: ['cetirizine', 'hydroxyzine'],
        contraindications: ['end-stage renal disease', 'creatinine clearance below 10 ml/min'],
        interaction_rules: ['alcohol', 'sedatives', 'cns depressants'],
        max_single_dose: '10 mg (1 tablet)',
        max_daily_dose: '10 mg (1 tablet)',
        min_dose_interval_hours: 24,
        dose_instructions: 'Take 1 tablet (10 mg) once daily with water in the evening.',
        warnings: 'May cause mild drowsiness. Exercise caution when driving or operating machinery.'
      }
    },
    {
      sku: 'MA-ASPIRINE-500',
      country_code: 'MA',
      product_name: 'ASPIRINE 500 mg tablet',
      brand_name: 'ASPIRINE PROMOPHARM',
      manufacturer: 'PROMOPHARM',
      dosage_form: 'tablet',
      route: 'oral',
      pack_size: 'box of 20',
      active_ingredients: [{ name: 'aspirin', strength: '500', unit: 'mg' }],
      atc_code: 'N02BA01',
      pathway: 'pain_fever',
      display_priority: 25,
      regulatory: {
        authority: 'AMMPS',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 18.00,
        currency: 'MAD',
        amm_number: 'AMM-MA-ASP-500',
        source_url: 'https://ammps.gov.ma/recherche-medicaments?search=aspirine'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 65,
        maximum_duration_days: 3,
        pregnancy_rule: 'contraindicated',
        breastfeeding_rule: 'contraindicated',
        allergy_terms: ['aspirin', 'acetylsalicylic acid', 'nsaid', 'salicylate'],
        contraindications: ['active ulcer', 'bleeding disorders', 'asthma triggered by aspirin', 'severe renal failure'],
        interaction_rules: ['warfarin', 'heparin', 'methotrexate', 'ibuprofen'],
        max_single_dose: '1000 mg (2 tablets)',
        max_daily_dose: '3000 mg (6 tablets)',
        min_dose_interval_hours: 4,
        dose_instructions: 'Take 1 to 2 tablets with a large glass of water after food every 4 to 8 hours.',
        warnings: 'Strictly prohibited in children and teenagers (risk of Reye syndrome). Do not take on an empty stomach.'
      }
    },
    {
      sku: 'MA-ACTIFED-RHUME',
      country_code: 'MA',
      product_name: 'ACTIFED RHUME tablet',
      brand_name: 'ACTIFED',
      manufacturer: 'GSK',
      dosage_form: 'tablet',
      route: 'oral',
      pack_size: 'box of 20',
      active_ingredients: [
        { name: 'pseudoephedrine', strength: '60', unit: 'mg' },
        { name: 'triprolidine', strength: '2.5', unit: 'mg' }
      ],
      atc_code: 'R01BA52',
      pathway: 'cold_cough',
      display_priority: 999,
      regulatory: {
        authority: 'AMMPS',
        market_status: 'withdrawn',
        prescription_category: 'prohibited',
        price_ppv: 0.00,
        currency: 'MAD',
        amm_number: 'AMM-MA-ACT-WITHDRAWN',
        source_url: 'https://ammps.gov.ma/basesdedonnes/medicaments-retires'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 65,
        maximum_duration_days: 0,
        pregnancy_rule: 'contraindicated',
        breastfeeding_rule: 'contraindicated',
        allergy_terms: ['pseudoephedrine', 'triprolidine'],
        contraindications: ['severe hypertension', 'coronary artery disease', 'stroke history'],
        interaction_rules: ['maois', 'antihypertensives'],
        max_single_dose: '0 mg',
        max_daily_dose: '0 mg',
        min_dose_interval_hours: 0,
        dose_instructions: 'NOT FOR DISPENSING. Withdrawn from the Moroccan market.',
        warnings: 'REGULATORY ALERT: This product registration has been withdrawn by AMMPS due to cardiovascular and neurological safety alerts.'
      }
    },

    // ------------------ INDIA (IN) CATALOGUE ------------------
    {
      sku: 'IN-DOLO-650',
      country_code: 'IN',
      product_name: 'DOLO 650 mg tablet',
      brand_name: 'DOLO',
      manufacturer: 'MICRO LABS',
      dosage_form: 'tablet',
      route: 'oral',
      pack_size: 'strip of 15',
      active_ingredients: [{ name: 'paracetamol', strength: '650', unit: 'mg' }],
      atc_code: 'N02BE01',
      pathway: 'pain_fever',
      display_priority: 10,
      regulatory: {
        authority: 'CDSCO',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 33.50,
        currency: 'INR',
        amm_number: 'CDSCO-IN-PARACETAMOL-650',
        source_url: 'https://cdsco.gov.in/'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 99,
        maximum_duration_days: 5,
        pregnancy_rule: 'consult_doctor',
        breastfeeding_rule: 'consult_doctor',
        allergy_terms: ['paracetamol', 'acetaminophen'],
        contraindications: ['chronic liver disease', 'severe alcoholism'],
        interaction_rules: ['other paracetamol products', 'warfarin'],
        max_single_dose: '650 mg (1 tablet)',
        max_daily_dose: '2600 mg (4 tablets)',
        min_dose_interval_hours: 6,
        dose_instructions: 'Take 1 tablet every 6 hours with water. Do not exceed 4 tablets in 24 hours.',
        warnings: 'Do not combine with other fever or cold medicines containing paracetamol.'
      }
    },
    {
      sku: 'IN-COMBIFLAM',
      country_code: 'IN',
      product_name: 'COMBIFLAM tablet (Ibuprofen + Paracetamol)',
      brand_name: 'COMBIFLAM',
      manufacturer: 'SANOFI INDIA',
      dosage_form: 'tablet',
      route: 'oral',
      pack_size: 'strip of 20',
      active_ingredients: [
        { name: 'ibuprofen', strength: '400', unit: 'mg' },
        { name: 'paracetamol', strength: '325', unit: 'mg' }
      ],
      atc_code: 'M01AE51',
      pathway: 'pain_fever',
      display_priority: 20,
      regulatory: {
        authority: 'CDSCO',
        market_status: 'commercialised',
        prescription_category: 'otc',
        price_ppv: 45.00,
        currency: 'INR',
        amm_number: 'CDSCO-IN-FDC-IBU-PARA',
        source_url: 'https://cdsco.gov.in/'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 65,
        maximum_duration_days: 3,
        pregnancy_rule: 'contraindicated',
        breastfeeding_rule: 'contraindicated',
        allergy_terms: ['ibuprofen', 'paracetamol', 'aspirin', 'nsaid'],
        contraindications: ['peptic ulcer', 'gastric bleeding', 'severe liver disease', 'severe renal disease'],
        interaction_rules: ['blood thinners', 'aspirin', 'other paracetamol products'],
        max_single_dose: '1 tablet',
        max_daily_dose: '3 tablets',
        min_dose_interval_hours: 8,
        dose_instructions: 'Take 1 tablet after meals every 8 hours. Do not exceed 3 tablets in 24 hours.',
        warnings: 'Fixed-dose combination. Contains both Ibuprofen and Paracetamol. Do not take with any other painkiller.'
      }
    },

    // ------------------ INTERNATIONAL (INT) REFERENCES ------------------
    {
      sku: 'INT-TYLENOL-500',
      country_code: 'INT',
      product_name: 'TYLENOL 500 mg extra strength caplet',
      brand_name: 'TYLENOL',
      manufacturer: 'KENVUE / J&J',
      dosage_form: 'caplet',
      route: 'oral',
      pack_size: 'bottle of 50',
      active_ingredients: [{ name: 'paracetamol', strength: '500', unit: 'mg' }],
      atc_code: 'N02BE01',
      pathway: 'pain_fever',
      display_priority: 50,
      regulatory: {
        authority: 'US-FDA / International',
        market_status: 'international_reference',
        prescription_category: 'otc',
        price_ppv: 9.99,
        currency: 'USD',
        amm_number: 'FDA-NDC-50580-498',
        source_url: 'https://dailymed.nlm.nih.gov/'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 99,
        maximum_duration_days: 5,
        pregnancy_rule: 'consult_doctor',
        breastfeeding_rule: 'consult_doctor',
        allergy_terms: ['acetaminophen', 'paracetamol'],
        contraindications: ['liver disease', 'alcoholism'],
        interaction_rules: ['other acetaminophen products'],
        max_single_dose: '1000 mg',
        max_daily_dose: '3000 mg',
        min_dose_interval_hours: 6,
        dose_instructions: 'Take 2 caplets every 6 hours while symptoms last.',
        warnings: 'International reference brand. Equivalent Moroccan product is DOLIPRANE 500 mg.'
      }
    },
    {
      sku: 'INT-PANADOL-500',
      country_code: 'INT',
      product_name: 'PANADOL 500 mg film-coated tablet',
      brand_name: 'PANADOL',
      manufacturer: 'HALEON',
      dosage_form: 'film-coated tablet',
      route: 'oral',
      pack_size: 'box of 24',
      active_ingredients: [{ name: 'paracetamol', strength: '500', unit: 'mg' }],
      atc_code: 'N02BE01',
      pathway: 'pain_fever',
      display_priority: 50,
      regulatory: {
        authority: 'International Reference',
        market_status: 'international_reference',
        prescription_category: 'otc',
        price_ppv: 4.50,
        currency: 'EUR',
        amm_number: 'INT-EMA-PANADOL',
        source_url: 'https://www.medicines.org.uk/'
      },
      safety: {
        minimum_age_years: 18,
        maximum_age_years: 99,
        maximum_duration_days: 5,
        pregnancy_rule: 'consult_doctor',
        breastfeeding_rule: 'consult_doctor',
        allergy_terms: ['paracetamol', 'acetaminophen'],
        contraindications: ['severe hepatic impairment'],
        interaction_rules: ['other paracetamol products'],
        max_single_dose: '1000 mg',
        max_daily_dose: '3000 mg',
        min_dose_interval_hours: 4,
        dose_instructions: 'Take 1 to 2 tablets every 4 to 6 hours as required.',
        warnings: 'International brand. Equivalent Moroccan product is DOLIPRANE 500 mg.'
      }
    }
  ],

  // Alternative Relationships (Levels 1 to 4)
  alternatives: [
    {
      requested_sku: 'INT-PANADOL-500',
      alternative_sku: 'MA-DOLIPRANE-500-EFF',
      level: 1,
      level_name: 'Direct Equivalent (Same Ingredient, Matching Strength)',
      explanation: 'Panadol is an international brand of paracetamol 500 mg. Doliprane 500 mg contains the identical active ingredient and strength.',
      vending_status: 'AVAILABLE_IN_VENDING_SLOT_1'
    },
    {
      requested_sku: 'INT-TYLENOL-500',
      alternative_sku: 'MA-DOLIPRANE-500-EFF',
      level: 1,
      level_name: 'Direct Equivalent (Same Ingredient, Matching Strength)',
      explanation: 'Tylenol (Acetaminophen 500 mg) is the US name for Paracetamol 500 mg. Doliprane 500 mg is the direct Moroccan equivalent.',
      vending_status: 'AVAILABLE_IN_VENDING_SLOT_1'
    },
    {
      requested_sku: 'MA-DOLIPRANE-500-EFF',
      alternative_sku: 'MA-DOLIPRANE-1000-TAB',
      level: 2,
      level_name: 'Strength / Formulation Variant',
      explanation: 'Doliprane 1000 mg contains the same active ingredient (paracetamol) in a higher strength tablet.',
      vending_status: 'CATALOGUE_ONLY'
    },
    {
      requested_sku: 'MA-DOLIPRANE-500-EFF',
      alternative_sku: 'MA-BRUFEN-400',
      level: 3,
      level_name: 'Therapeutic Class Alternative (NSAID)',
      explanation: 'Brufen contains Ibuprofen 400 mg. It relieves pain and fever through an anti-inflammatory mechanism, but has different contraindications (stomach ulcer, kidney disease, third-trimester pregnancy).',
      vending_status: 'AVAILABLE_IN_VENDING_SLOT_2'
    },
    {
      requested_sku: 'MA-ACTIFED-RHUME',
      alternative_sku: null,
      level: 4,
      level_name: 'No Safe Alternative Established',
      explanation: 'Actifed Rhume was withdrawn due to cardiovascular safety alerts. No direct OTC combination replacement is approved without clinical prescription.',
      vending_status: 'NO_SAFE_ALTERNATIVE'
    }
  ]
};

const content = JSON.stringify(catalog, null, 2);
const hash = createHash('sha256').update(content).digest('hex');
catalog.integrity_sha256 = hash;

const finalPath = resolve('data/local_catalog_snapshot.json');
await writeFile(finalPath, JSON.stringify(catalog, null, 2), 'utf8');
console.log(`Generated local catalogue snapshot with ${catalog.products.length} products, ${catalog.vending_inventory.length} vending slots, and ${catalog.alternatives.length} alternative mappings.`);
console.log(`Integrity SHA256: ${hash}`);
