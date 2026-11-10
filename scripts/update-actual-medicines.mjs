import './load-env.mjs';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

// One-off demo-data rewrite. It puts real medicine names on synthetic ZZ rows,
// so it must never run by accident.
if (process.env.PILLPAL_ALLOW_DEMO_REWRITE !== '1') {
  console.error('Refusing to rewrite demo rows. Set PILLPAL_ALLOW_DEMO_REWRITE=1 only for the ZZ sandbox.');
  process.exit(2);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
  Prefer: 'return=representation',
};

const REAL_MEDICINES = [
  // 1. Pain & Fever
  {
    sku: 'ZZ-DEMO-PAINFEVER-500',
    brand_name: 'DOLIPRANE',
    product_name: 'DOLIPRANE 500 mg Pain & Fever Effervescent Tablets',
    strength_label: '500 mg',
    dosage_form: 'effervescent tablet',
    pack_size: '16 effervescent tablets',
    price: 15.50,
    currency_code: 'MAD',
    label_url: 'https://base-donnees-publique.medicaments.gouv.fr/medicament/63368332/extrait',
    active_ingredients: [{ name: 'paracetamol', strength: '500', unit: 'mg' }],
    safety: {
      dose_instructions: {
        display_text: 'Adults and adolescents from 15 years (over 50 kg): 1 to 2 tablets (500 to 1000 mg) every 4 to 6 hours as needed. Do not exceed 3000 mg (6 tablets) in 24 hours. Dissolve completely in a large glass of water and drink immediately.',
      },
      warnings: [
        'Do not combine with any other paracetamol-containing product (risk of severe liver toxicity).',
        'Wait at least 4 to 6 hours between doses.',
        'Consult a doctor or pharmacist if fever persists for more than 3 days or pain for more than 5 days.',
      ],
      allergy_terms: ['paracetamol', 'acetaminophen'],
      contraindications: ['severe liver disease', 'acute hepatitis', 'hypersensitivity to paracetamol'],
      interaction_rules: ['warfarin', 'other paracetamol products', 'flucloxacillin'],
    },
  },
  {
    sku: 'ZZ-DEMO-PAINFEVER-650',
    brand_name: 'BRUFEN',
    product_name: 'BRUFEN 400 mg Pain & Fever Coated Tablets',
    strength_label: '400 mg',
    dosage_form: 'coated tablet',
    pack_size: '20 tablets',
    price: 22.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/101282/smpc',
    active_ingredients: [{ name: 'ibuprofen', strength: '400', unit: 'mg' }],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children over 12 years: 1 tablet (400 mg) every 6 to 8 hours with or immediately after food. Maximum 1200 mg (3 tablets) in 24 hours. Swallow whole with a full glass of water.',
      },
      warnings: [
        'Take with or immediately after food to prevent stomach irritation.',
        'Do not combine with aspirin or any other anti-inflammatory / NSAID.',
        'Strictly contraindicated during the third trimester of pregnancy.',
      ],
      allergy_terms: ['ibuprofen', 'nsaid', 'aspirin'],
      contraindications: ['stomach ulcer', 'history of gastric bleeding', 'severe kidney disease', 'severe heart failure', 'third trimester of pregnancy', 'asthma exacerbated by NSAIDs'],
      interaction_rules: ['aspirin', 'ibuprofen', 'naproxen', 'blood thinners', 'methotrexate'],
    },
  },
  {
    sku: 'ZZ-DEMO-PAINFEVER-SYRP',
    brand_name: 'DOLIPRANE PÉDIATRIQUE',
    product_name: 'DOLIPRANE 2.4% Children\'s Pain & Fever Suspension',
    strength_label: '120 mg/5 mL',
    dosage_form: 'oral suspension',
    pack_size: '100 mL bottle with calibrated syringe',
    price: 18.00,
    currency_code: 'MAD',
    label_url: 'https://base-donnees-publique.medicaments.gouv.fr/medicament/63368332/extrait',
    active_ingredients: [{ name: 'paracetamol', strength: '120', unit: 'mg/5 mL' }],
    safety: {
      dose_instructions: {
        display_text: 'Children from 3 kg to 26 kg (approx. birth to 9 years): 15 mg/kg per dose using the calibrated oral syringe every 6 hours. Maximum 4 doses in 24 hours.',
      },
      warnings: [
        'Use only the enclosed calibrated measuring syringe.',
        'Do not administer with any other paracetamol-containing medicine.',
      ],
      allergy_terms: ['paracetamol', 'acetaminophen'],
      contraindications: ['severe liver disease', 'hypersensitivity to paracetamol'],
      interaction_rules: ['other paracetamol products'],
    },
  },

  // 2. Cold & Cough
  {
    sku: 'ZZ-DEMO-COUGH-SYRUP-5',
    brand_name: 'BISOLVON',
    product_name: 'BISOLVON Chesty Cough Mucolytic Syrup',
    strength_label: '8 mg/5 mL',
    dosage_form: 'syrup',
    pack_size: '200 mL bottle',
    price: 28.50,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/101491/smpc',
    active_ingredients: [{ name: 'bromhexine hydrochloride', strength: '8', unit: 'mg/5 mL' }],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children over 12 years: 10 mL (16 mg) three times daily. Drink plenty of water throughout the day to help thin and loosen bronchial secretions.',
      },
      warnings: [
        'Drink plenty of fluids to assist the mucolytic action.',
        'Consult a doctor if cough lasts longer than 7 days or is accompanied by high fever.',
      ],
      allergy_terms: ['bromhexine', 'ambroxol'],
      contraindications: ['gastric ulcer', 'hypersensitivity to bromhexine'],
      interaction_rules: ['antibiotics (erythromycin, ampicillin)'],
    },
  },
  {
    sku: 'ZZ-DEMO-LOZENGE-1',
    brand_name: 'STREPSILS',
    product_name: 'STREPSILS Honey & Lemon Sore Throat Lozenges',
    strength_label: '1.2 mg / 0.6 mg',
    dosage_form: 'lozenge',
    pack_size: '24 lozenges',
    price: 35.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/101491/smpc',
    active_ingredients: [
      { name: '2,4-dichlorobenzyl alcohol', strength: '1.2', unit: 'mg' },
      { name: 'amylmetacresol', strength: '0.6', unit: 'mg' },
    ],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children over 6 years: Dissolve one lozenge slowly in the mouth every 2 to 3 hours as needed. Do not exceed 12 lozenges in 24 hours.',
      },
      warnings: [
        'Allow the lozenge to dissolve slowly; do not chew or swallow whole.',
        'If sore throat persists for more than 3 days with difficulty swallowing, consult a healthcare professional.',
      ],
      allergy_terms: ['dichlorobenzyl alcohol', 'amylmetacresol'],
      contraindications: ['intolerance to fructose or glucose-galactose'],
      interaction_rules: [],
    },
  },
  {
    sku: 'ZZ-DEMO-SALINE-NASAL',
    brand_name: 'OTRIVIN',
    product_name: 'OTRIVIN 0.1% Decongestant Nasal Spray',
    strength_label: '1 mg/mL',
    dosage_form: 'nasal spray',
    pack_size: '10 mL spray',
    price: 26.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/101491/smpc',
    active_ingredients: [{ name: 'xylometazoline hydrochloride', strength: '1', unit: 'mg/mL' }],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children over 12 years: 1 spray into each nostril up to 3 times daily as needed. Do not use for more than 7 consecutive days.',
      },
      warnings: [
        'Do not use continuously for more than 7 days to avoid rebound nasal congestion (rhinitis medicamentosa).',
        'Do not share the spray bottle with others to avoid spreading infection.',
      ],
      allergy_terms: ['xylometazoline'],
      contraindications: ['closed-angle glaucoma', 'recent transsphenoidal surgery'],
      interaction_rules: ['MAO inhibitors', 'tricyclic antidepressants'],
    },
  },

  // 3. Allergy
  {
    sku: 'ZZ-DEMO-ANTIHISTAMINE-10',
    brand_name: 'ZYRTEC',
    product_name: 'ZYRTEC 10 mg Film-Coated Allergy Tablets',
    strength_label: '10 mg',
    dosage_form: 'film-coated tablet',
    pack_size: '10 tablets',
    price: 32.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/12956/smpc',
    active_ingredients: [{ name: 'cetirizine hydrochloride', strength: '10', unit: 'mg' }],
    safety: {
      dose_instructions: {
        display_text: 'Adults and adolescents 12 years and over: 1 tablet (10 mg) once daily with water. May cause mild drowsiness in sensitive individuals; avoid alcohol.',
      },
      warnings: [
        'May cause drowsiness; use caution when driving or operating machinery.',
        'Discontinue at least 3 days before undergoing allergy skin prick tests.',
      ],
      allergy_terms: ['cetirizine', 'hydroxyzine'],
      contraindications: ['end-stage renal disease (creatinine clearance under 10 mL/min)'],
      interaction_rules: ['sedatives', 'central nervous system depressants', 'alcohol'],
    },
  },
  {
    sku: 'ZZ-DEMO-ALLERGY-SPRAY',
    brand_name: 'CLARITYN',
    product_name: 'CLARITYN 10 mg Non-Drowsy Allergy Relief Tablets',
    strength_label: '10 mg',
    dosage_form: 'tablet',
    pack_size: '10 tablets',
    price: 34.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/3505/smpc',
    active_ingredients: [{ name: 'loratadine', strength: '10', unit: 'mg' }],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children over 12 years: 1 tablet (10 mg) once daily with or without food. Suitable for non-drowsy daytime relief.',
      },
      warnings: [
        'Non-drowsy formulation under normal dosing.',
        'Stop taking 48 hours prior to clinical allergy skin testing.',
      ],
      allergy_terms: ['loratadine', 'desloratadine'],
      contraindications: ['severe hepatic impairment'],
      interaction_rules: ['ketoconazole', 'erythromycin'],
    },
  },

  // 4. Diarrhoea
  {
    sku: 'ZZ-DEMO-ANTIDIARR-2',
    brand_name: 'IMODIUM',
    product_name: 'IMODIUM 2 mg Fast Action Capsules',
    strength_label: '2 mg',
    dosage_form: 'capsule',
    pack_size: '12 capsules',
    price: 26.50,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/10420/smpc',
    active_ingredients: [{ name: 'loperamide hydrochloride', strength: '2', unit: 'mg' }],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children over 18 years: 2 capsules (4 mg) initially, followed by 1 capsule (2 mg) after each loose bowel movement. Maximum 6 capsules (12 mg) in 24 hours. Stop as soon as stools become formed or after 48 hours.',
      },
      warnings: [
        'Do not take if stool contains blood or if accompanied by high fever.',
        'Antimotility medication does not replace oral rehydration therapy.',
      ],
      allergy_terms: ['loperamide'],
      contraindications: ['acute dysentery', 'ulcerative colitis', 'bacterial enterocolitis', 'constipation'],
      interaction_rules: ['quinidine', 'ritonavir', 'ketoconazole'],
    },
  },
  {
    sku: 'ZZ-DEMO-ORS-SACHET',
    brand_name: 'DIORALYTE',
    product_name: 'DIORALYTE Rehydration Electrolyte Salts',
    strength_label: 'WHO formula',
    dosage_form: 'powder for oral solution',
    pack_size: '6 sachets',
    price: 24.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/2858/smpc',
    active_ingredients: [{ name: 'oral rehydration salts', strength: 'standard formula', unit: 'sachet' }],
    safety: {
      dose_instructions: {
        display_text: 'Dissolve 1 sachet completely in 200 mL of clean drinking water. Drink 1 sachet after each loose stool to restore fluids and electrolytes.',
      },
      warnings: [
        'Always reconstitute in 200 mL of pure drinking water. Do not boil prepared solution.',
        'Discard any unused reconstituted solution after 24 hours (or 1 hour if not refrigerated).',
      ],
      allergy_terms: [],
      contraindications: ['bowel obstruction', 'severe dehydration requiring IV fluids'],
      interaction_rules: [],
    },
  },

  // 5. Heartburn
  {
    sku: 'ZZ-DEMO-ANTACID-800',
    brand_name: 'RENNIE',
    product_name: 'RENNIE Spearmint Fast Heartburn Relief Tablets',
    strength_label: '680 mg / 80 mg',
    dosage_form: 'chewable tablet',
    pack_size: '24 chewable tablets',
    price: 21.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/101491/smpc',
    active_ingredients: [
      { name: 'calcium carbonate', strength: '680', unit: 'mg' },
      { name: 'magnesium carbonate', strength: '80', unit: 'mg' },
    ],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children over 12 years: 1 to 2 tablets to be chewed or sucked as needed, preferably 1 hour after meals and before bedtime. Maximum 10 tablets daily.',
      },
      warnings: [
        'Separate intake from other medications by at least 2 hours to avoid reduced absorption.',
        'Do not exceed 10 tablets in 24 hours.',
      ],
      allergy_terms: ['calcium carbonate'],
      contraindications: ['hypercalcaemia', 'severe renal failure', 'nephrolithiasis'],
      interaction_rules: ['tetracyclines', 'iron supplements', 'quinolones'],
    },
  },
  {
    sku: 'ZZ-DEMO-ANTACID-SUSP',
    brand_name: 'GAVISCON',
    product_name: 'GAVISCON Dual Action Heartburn & Acid Reflux Suspension',
    strength_label: '500 mg / 267 mg per 10 mL',
    dosage_form: 'oral suspension',
    pack_size: '150 mL bottle',
    price: 29.00,
    currency_code: 'MAD',
    label_url: 'https://www.medicines.org.uk/emc/product/101491/smpc',
    active_ingredients: [
      { name: 'sodium alginate', strength: '500', unit: 'mg/10 mL' },
      { name: 'sodium bicarbonate', strength: '267', unit: 'mg/10 mL' },
    ],
    safety: {
      dose_instructions: {
        display_text: 'Adults and children 12 years and over: 10 to 20 mL (two to four 5 mL spoonfuls) after meals and at bedtime, up to four times daily. Shake well before use.',
      },
      warnings: [
        'Shake the bottle thoroughly before each dose.',
        'Contains sodium: caution in patients on low-sodium diets or with severe cardiac/renal impairment.',
      ],
      allergy_terms: ['sodium alginate'],
      contraindications: ['hypersensitivity to alginate'],
      interaction_rules: ['iron', 'digoxin', 'ciprofloxacin'],
    },
  },

  // 6. Skin & Minor Wound
  {
    sku: 'ZZ-DEMO-ANTISEPTIC-100',
    brand_name: 'BETADINE',
    product_name: 'BETADINE 10% Antiseptic Dermic Solution',
    strength_label: '10% w/v',
    dosage_form: 'cutaneous solution',
    pack_size: '125 mL bottle',
    price: 20.00,
    currency_code: 'MAD',
    label_url: 'https://base-donnees-publique.medicaments.gouv.fr/medicament/63368332/extrait',
    active_ingredients: [{ name: 'povidone-iodine', strength: '10', unit: '% w/v' }],
    safety: {
      dose_instructions: {
        display_text: 'Apply directly onto clean minor wounds, cuts, scrapes, or abrasions once or twice daily using sterile cotton or gauze. Can be covered with a sterile plaster.',
      },
      warnings: [
        'For external cutaneous use only. Do not swallow or apply to open eyes.',
        'Do not combine with mercury-based antiseptics (forms corrosive mercury iodide).',
      ],
      allergy_terms: ['iodine', 'povidone-iodine'],
      contraindications: ['hyperthyroidism', 'iodine allergy', 'premature infants'],
      interaction_rules: ['mercury antiseptics', 'silver sulfadiazine'],
    },
  },
  {
    sku: 'ZZ-DEMO-PLASTER-10',
    brand_name: 'HANSA',
    product_name: 'HANSA Elastic Water-Resistant Wound Plasters',
    strength_label: 'Assorted sizes',
    dosage_form: 'adhesive dressing',
    pack_size: '20 assorted plasters',
    price: 16.00,
    currency_code: 'MAD',
    label_url: null,
    active_ingredients: [{ name: 'sterile protective adhesive dressing', strength: 'assorted', unit: 'strip' }],
    safety: {
      dose_instructions: {
        display_text: 'Cleanse and dry the skin wound thoroughly before applying. Position the sterile wound pad over the wound and press edges firmly. Change dressing daily.',
      },
      warnings: [
        'Single-use only. Change daily or immediately if wet or contaminated.',
      ],
      allergy_terms: [],
      contraindications: ['infected or deep puncture wounds'],
      interaction_rules: [],
    },
  },
  {
    sku: 'ZZ-DEMO-GAUZE-10',
    brand_name: 'CURAPOR',
    product_name: 'CURAPOR Sterile Absorbent Gauze Compresses',
    strength_label: '7.5 cm x 7.5 cm',
    dosage_form: 'sterile compress',
    pack_size: '10 sterile packs',
    price: 14.00,
    currency_code: 'MAD',
    label_url: null,
    active_ingredients: [{ name: '100% sterile cotton woven gauze', strength: '7.5x7.5 cm', unit: 'pad' }],
    safety: {
      dose_instructions: {
        display_text: 'For gentle wound cleansing and as a sterile protective barrier over minor cuts and grazes. Secure in place with medical tape.',
      },
      warnings: [
        'Sterile unless wrapper is opened or damaged. Do not re-use.',
      ],
      allergy_terms: [],
      contraindications: [],
      interaction_rules: [],
    },
  },
];

async function updateProducts() {
  console.log(`Connecting to Supabase at ${url}...`);

  for (const med of REAL_MEDICINES) {
    console.log(`Updating ${med.sku} (${med.brand_name} - ${med.product_name})...`);

    // 1. Update product row
    const prodRes = await fetch(`${url}/rest/v1/products?country_code=eq.ZZ&sku=eq.${med.sku}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        brand_name: med.brand_name,
        product_name: med.product_name,
        strength_label: med.strength_label,
        dosage_form: med.dosage_form,
        pack_size: med.pack_size,
        price: med.price,
        currency_code: med.currency_code,
        label_url: med.label_url,
        active_ingredients: med.active_ingredients,
        updated_at: new Date().toISOString(),
      }),
    });

    const prodData = await prodRes.json();
    if (!prodRes.ok) {
      console.error(`Failed to update product ${med.sku}:`, prodData);
      continue;
    }
    const productId = prodData[0]?.id;
    if (!productId) {
      console.warn(`No product found for SKU ${med.sku}`);
      continue;
    }

    // 2. Update product_safety row
    const safetyRes = await fetch(`${url}/rest/v1/product_safety?product_id=eq.${productId}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        dose_instructions: med.safety.dose_instructions,
        warnings: med.safety.warnings,
        allergy_terms: med.safety.allergy_terms,
        contraindications: med.safety.contraindications,
        interaction_rules: med.safety.interaction_rules,
        updated_at: new Date().toISOString(),
      }),
    });

    const safetyData = await safetyRes.json();
    if (!safetyRes.ok) {
      console.error(`Failed to update safety for ${med.sku}:`, safetyData);
    } else {
      console.log(`  -> Successfully updated product and safety for ${med.brand_name}!`);
    }
  }

  console.log('All real medicine details successfully updated in Supabase!');
}

updateProducts().catch(err => {
  console.error('Fatal error updating products:', err);
  process.exit(1);
});
