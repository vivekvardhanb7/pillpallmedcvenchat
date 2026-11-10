-- Morocco (MA) real-product catalogue, sourced and left in_review.
-- Run after 001, 002 and 007. It changes no ZZ demo row and enables nothing.
--
-- What this file is
--   16 real medicines with their real ingredient, strength, form and labelling
--   facts. Every clinical value below was read on 2026-11-04 from a published
--   Summary of Product Characteristics or patient leaflet, and every
--   product_safety row carries the URL it came from in clinical_source_url.
--   The four brands that your own "Morocco Medical Vending Machine Report -
--   Final Edition" shortlisted (Doliprane, Brufen, Imodium, Zyrtec) keep their
--   002 SKUs and stay commercialised because that report documents them. The
--   other twelve are reference presentations of the same molecules: brand, pack
--   and Moroccan registration (AMM) are not verified here, so their
--   market_status is 'unknown'.
--
-- What this file is not
--   It is not an approval. clinical_status, legal_status and review_status are
--   'in_review', chatbot_enabled stays false, and reviewer_name / reviewer_role
--   / reviewed_at are left NULL on purpose. The schema requires a named human
--   for an approval, so that signature is yours and cannot be written here.
--   Until it is signed, the kiosk keeps showing the ZZ demo catalogue and a real
--   MA session keeps returning no_approved_product_for_pathway.
--
-- Correction included (steps 2 and 4)
--   The DOLIPRANE product_safety row on this database carried review_status
--   'approved', reviewer 'Dr. Test Reviewer', a source host that does not respond
--   (https://ammps.sante.gov.ma/doliprane-500) and a dose line ("Do not exceed 3
--   tablets in 24 hours") matching no published leaflet. It is replaced here by
--   the sourced row, demoted to in_review, and the unsourced provenance is
--   recorded in the row's own warnings so the audit trail survives.
--
-- Gaps a reviewer must close before signing
--   maximum_duration_days is NULL wherever the cited labelling gave no
--   self-treatment limit and I did not invent one (cetirizine, loratadine,
--   calcium carbonate, saline, chlorhexidine). Those rows pass any duration, so
--   set the limit from the Moroccan leaflet before enabling them.

begin;

-- 1. MA pathways stay disabled; the description records that content is drafted
--    and waiting, so an operator can tell draft from absent.
update public.symptom_pathways
set clinical_status = 'in_review',
    description = 'Draft clinical content prepared from published labelling on 2026-11-04. Not approved. Not enabled.'
where country_code = 'MA'
  and language_code = 'en'
  and enabled = false;

-- 2. The four report-shortlisted brands: real identity, sourced labelling,
--    corrected provenance. Still disabled, still unapproved.
update public.products p
set product_name = r.product_name,
    brand_name = r.brand_name,
    active_ingredients = r.ingredients::jsonb,
    strength_label = r.strength_label,
    dosage_form = r.dosage_form,
    route = r.route,
    pack_size = r.pack_size,
    market_status = 'commercialised',
    label_url = r.label_url,
    label_version = r.label_version,
    source_document = r.source_document,
    research_notes = r.research_notes,
    clinical_status = 'in_review',
    legal_status = 'in_review',
    chatbot_enabled = false
from (values
  (
    'MA-RESEARCH-DOLIPRANE-500-EFF',
    'DOLIPRANE 500 mg effervescent tablet',
    'DOLIPRANE',
    '[{"name":"paracetamol","strength":"500","unit":"mg"}]',
    '500 mg',
    'effervescent tablet',
    'oral',
    '8 tablets',
    'https://base-donnees-publique.medicaments.gouv.fr/medicament/63368332/extrait',
    'ANSM public drug database, DOLIPRANE 500 mg comprime, RCP + patient notice, retrieved 2026-11-04',
    'Brand identity from Morocco Medical Vending Machine Report - Final Edition. Labelling facts from the French ANSM RCP/notice for the same speciality.',
    'Pack size and barcode not verified. Moroccan AMM number and the Moroccan Arabic/French leaflet not verified - the French RCP was used as the reference. Replaces a safety row dated 2026-11-04 whose reviewer and source could not be verified.'
  ),
  (
    'MA-RESEARCH-BRUFEN-400',
    'BRUFEN 400 mg coated tablet',
    'BRUFEN',
    '[{"name":"ibuprofen","strength":"400","unit":"mg"}]',
    '400 mg',
    'coated tablet',
    'oral',
    '12 tablets',
    'https://www.medicines.org.uk/emc/product/101282/smpc',
    'EMC ibuprofen 200 mg labelling (same adult dose pattern, 200 mg strength), retrieved 2026-11-04',
    'Brand identity from Morocco Medical Vending Machine Report - Final Edition. Labelling facts from the OTC ibuprofen 200 mg SmPC.',
    'The reference labelling is the 200 mg product: re-read the 400 mg dose and the age floor from the Moroccan Brufen leaflet before approval. Pack size and barcode not verified.'
  ),
  (
    'MA-RESEARCH-IMODIUM-2',
    'IMODIUM 2 mg capsule',
    'IMODIUM',
    '[{"name":"loperamide","strength":"2","unit":"mg"}]',
    '2 mg',
    'capsule',
    'oral',
    '12 capsules',
    'https://www.medicines.org.uk/emc/product/10420/smpc',
    'EMC Loperamide 2mg Capsules SmPC, retrieved 2026-11-04',
    'Brand identity from Morocco Medical Vending Machine Report - Final Edition. Labelling facts from the loperamide 2 mg SmPC.',
    'Pack size and barcode not verified. Sale class in Morocco not verified.'
  ),
  (
    'MA-RESEARCH-ZYRTEC-10',
    'ZYRTEC 10 mg film-coated tablet',
    'ZYRTEC',
    '[{"name":"cetirizine hydrochloride","strength":"10","unit":"mg"}]',
    '10 mg',
    'film-coated tablet',
    'oral',
    '10 tablets',
    'https://www.medicines.org.uk/emc/product/12956/smpc',
    'EMC Cetirizine hydrochloride 10 mg film-coated tablets SmPC, retrieved 2026-11-04',
    'Brand identity from Morocco Medical Vending Machine Report - Final Edition. Labelling facts from the cetirizine 10 mg SmPC.',
    'Dosage_form was null in the 002 seed; set from the reference SmPC. Pack size and barcode not verified.'
  )
) as r(sku, product_name, brand_name, ingredients, strength_label, dosage_form, route, pack_size, label_url, label_version, source_document, research_notes)
where p.country_code = 'MA'
  and p.sku = r.sku;

-- 3. Reference presentations of the same molecules, plus the rest of the draft
--    menu. market_status is 'unknown' because nothing in this file verifies that
--    a given product is registered in Morocco; the enable check requires
--    'commercialised', so a reviewer has to confirm the AMM first.
insert into public.products (
  country_code, sku, product_name, brand_name, active_ingredients, strength_label,
  dosage_form, route, pack_size, market_status, label_url, label_version,
  source_document, research_notes, clinical_status, legal_status, chatbot_enabled
)
select
  'MA', r.sku, r.product_name, r.brand_name,
  jsonb_build_array(jsonb_build_object('name', r.ingredient, 'strength', r.strength, 'unit', r.unit)),
  r.strength || ' ' || r.unit, r.dosage_form, r.route, r.pack_size,
  'unknown', r.label_url, r.label_version,
  'Draft transcription of the labelling named in label_version. No document was filed with this row.',
  'Reference labelling only. Brand, pack, barcode, sale class and Moroccan AMM not verified. Not a clinical or legal approval.',
  'in_review', 'in_review', false
from (values
  -- pain_fever
  (
    'MA-PARACETAMOL-TAB-500', null, 'Paracetamol 500 mg tablets',
    'paracetamol', '500', 'mg', 'tablet', 'oral', '16 tablets',
    'https://www.medicines.org.uk/emc/product/101491/smpc',
    'EMC Paracetamol 500mg Tablets SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-PARACETAMOL-SUSP-250', null, 'Paracetamol 250 mg/5 mL oral suspension',
    'paracetamol', '250', 'mg/5 mL', 'oral suspension', 'oral', '100 mL',
    'https://www.nhs.uk/medicines/paracetamol-for-children/',
    'NHS medicines: paracetamol for children, retrieved 2026-11-04'
  ),
  (
    'MA-IBUPROFEN-TAB-200', null, 'Ibuprofen 200 mg tablets',
    'ibuprofen', '200', 'mg', 'tablet', 'oral', '12 tablets',
    'https://www.medicines.org.uk/emc/product/101282/smpc',
    'EMC Ibuprofen 200mg Capsules SmPC + NHS ibuprofen for adults, retrieved 2026-11-04'
  ),
  (
    'MA-IBUPROFEN-SUSP-100', null, 'Ibuprofen 100 mg/5 mL oral suspension',
    'ibuprofen', '100', 'mg/5 mL', 'oral suspension', 'oral', '100 mL',
    'https://www.nhs.uk/medicines/ibuprofen-for-children/',
    'NHS medicines: ibuprofen for children, retrieved 2026-11-04'
  ),
  -- allergy
  (
    'MA-LORATADINE-TAB-10', null, 'Loratadine 10 mg tablets',
    'loratadine', '10', 'mg', 'tablet', 'oral', '10 tablets',
    'https://www.medicines.org.uk/emc/product/3505/smpc',
    'EMC Clarityn Allergy 10mg Tablets SmPC + NHS loratadine, retrieved 2026-11-04'
  ),
  -- diarrhoea
  (
    'MA-ORS-SACHET', null, 'Oral rehydration salts sachets',
    'oral rehydration salts', '1', 'sachet', 'oral powder', 'oral', '10 sachets',
    'https://www.medicines.org.uk/emc/product/2858/smpc',
    'EMC Dioralyte Relief Blackcurrant Sachets SmPC, retrieved 2026-11-04'
  ),
  -- heartburn
  (
    'MA-ALGINATE-SUSP', null, 'Sodium alginate 1000 mg / potassium hydrogen carbonate 200 mg oral suspension',
    'sodium alginate', '1000', 'mg per 10 mL', 'oral suspension', 'oral', '200 mL',
    'https://www.medicines.org.uk/emc/product/6715/smpc',
    'EMC Gaviscon Advance Peppermint Flavour Oral Suspension SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-CALCIUM-CARBONATE-500', null, 'Calcium carbonate 500 mg chewable tablet',
    'calcium carbonate', '500', 'mg', 'chewable tablet', 'oral', '24 tablets',
    'https://www.medicines.org.uk/emc/product/101270/smpc',
    'EMC Calcium Carbonate 500 mg Chewable Tablets SmPC + NHS antacids, retrieved 2026-11-04'
  ),
  (
    'MA-OMEPRAZOLE-20', null, 'Omeprazole 20 mg gastro-resistant tablet',
    'omeprazole', '20', 'mg', 'gastro-resistant tablet', 'oral', '7 tablets',
    'https://www.nhs.uk/medicines/omeprazole/',
    'NHS medicines: omeprazole, retrieved 2026-11-04'
  ),
  -- cold_cough
  (
    'MA-XYLOMETAZOLINE-SPRAY-1MG', null, 'Xylometazoline hydrochloride 1 mg/mL (0.1% w/v) nasal spray',
    'xylometazoline hydrochloride', '1', 'mg/mL', 'nasal spray', 'nasal', '10 mL',
    'https://www.medicines.org.uk/emc/product/3008/smpc',
    'EMC Otrivine Blocked Nose Relief 0.1% w/v Nasal Spray SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-SALINE-NASAL-09', null, 'Sodium chloride 0.9% w/v nasal drops',
    'sodium chloride', '0.9', '% w/v', 'nasal solution', 'nasal', '10 mL',
    'https://www.efda.gov.et/wp-content/uploads/2023/07/SODIUM-CHLORIDE-0.9-wv-NASAL-DROPS-ABNAL_Abacus-Parenteral-Drugs-Limited.pdf',
    'Regulator-published SmPC, sodium chloride 0.9% w/v nasal drops, retrieved 2026-11-04'
  ),
  -- skin_minor_wound
  (
    'MA-CHLORHEXIDINE-SOL-05', null, 'Chlorhexidine gluconate 0.5% w/v aqueous cutaneous solution',
    'chlorhexidine gluconate', '0.5', '% w/v', 'cutaneous solution', 'cutaneous', '100 mL',
    'https://docetp.mpa.se/LMF/Hibiwash%20cutaneous%20solution%20ENG%20SmPC_09001bee842a8109.pdf',
    'Swedish MPA published SmPC, chlorhexidine gluconate cutaneous solution, retrieved 2026-11-04'
  )
) as r(sku, brand_name, product_name, ingredient, strength, unit, dosage_form, route, pack_size, label_url, label_version)
on conflict (country_code, sku) do update set
  product_name = excluded.product_name,
  brand_name = excluded.brand_name,
  active_ingredients = excluded.active_ingredients,
  strength_label = excluded.strength_label,
  dosage_form = excluded.dosage_form,
  route = excluded.route,
  pack_size = excluded.pack_size,
  label_url = excluded.label_url,
  label_version = excluded.label_version,
  source_document = excluded.source_document,
  research_notes = excluded.research_notes,
  clinical_status = 'in_review',
  legal_status = 'in_review',
  chatbot_enabled = false;

-- 4. Sourced safety data, one row per product, 18 columns per values row.
--    Dose text is transcribed from the cited labelling. Where the leaflet set no
--    duration limit, maximum_duration_days is NULL and the warnings say so.
insert into public.product_safety (
  product_id, allowed_indications, minimum_age_months, maximum_age_years,
  pregnancy_rule, breastfeeding_rule, contraindications, allergy_terms,
  interaction_rules, dose_instructions, maximum_duration_days, warnings,
  referral_triggers, storage_requirements,
  clinical_source_url, clinical_source_version, reviewer_name, reviewer_role,
  reviewed_at, review_status, version
)
select
  p.id,
  r.indications::jsonb,
  r.min_age_months,
  r.max_age_years,
  r.pregnancy_rule,
  r.breastfeeding_rule,
  r.contraindications::jsonb,
  r.allergy_terms::jsonb,
  r.interactions::jsonb,
  jsonb_build_object(
    'display_text', r.dose_text,
    'per_dose', r.per_dose,
    'max_doses_per_24h', r.max_doses,
    'min_interval_hours', r.interval_hours,
    'status', 'transcribed from the cited labelling - not yet reviewed'
  ),
  r.max_days,
  r.warnings::jsonb,
  r.referrals::jsonb,
  '{}'::jsonb,
  r.source_url,
  r.source_version,
  null,
  null,
  null,
  'in_review',
  1
from public.products p
join (values
  (
    'MA-RESEARCH-DOLIPRANE-500-EFF',
    '["headache","toothache","pain","fever","period pain"]',
    192, 100, 'refer', 'allow',
    '["liver disease","severe liver failure","malnourished","low body weight"]',
    '["paracetamol","acetaminophen"]',
    '["warfarin","flucloxacillin","metoclopramide","domperidone","cholestyramine","probenecid","phenytoin","carbamazepine","isoniazid","paracetamol"]',
    'Adults and children over 16 or over 50 kg: one or two 500 mg tablets per dose, at least 4 hours apart, maximum 4 g in 24 hours and no more than 4 doses a day. Do not take with any other paracetamol product. Do not self-treat for more than 3 days.',
    '500-1000 mg', 4, 4, 3,
    '["Effervescent and soluble forms carry a high sodium load - not for a low-sodium diet, heart failure or severe kidney disease.","Hepatic risk rises with alcohol dependence, malnutrition, low body weight and chronic overuse.","This row replaces an earlier one marked approved with an unverifiable reviewer and a source host that does not respond."]',
    '["liver disease","alcohol dependence","kidney disease","low body weight","another paracetamol product already taken"]',
    'https://base-donnees-publique.medicaments.gouv.fr/medicament/63368332/extrait',
    'ANSM DOLIPRANE 500 mg RCP + notice, retrieved 2026-11-04'
  ),
  (
    'MA-RESEARCH-BRUFEN-400',
    '["headache","toothache","muscle pain","period pain","inflammation","fever"]',
    192, 100, 'block', 'refer',
    '["stomach ulcer","past stomach ulcer","bleeding in the stomach","severe heart failure","severe kidney disease","severe liver disease","last three months of pregnancy","asthma worsened by anti-inflammatories","bleeding disorder"]',
    '["ibuprofen","anti-inflammatory","nsaid"]',
    '["aspirin","ibuprofen","naproxen","diclofenac","warfarin","heparin","methotrexate","lithium","ace inhibitor","diuretic","water tablet","ciclosporin","digoxin","steroid","ssri","quinolone antibiotic"]',
    'Adults: one 400 mg tablet up to three times a day with at least 4 hours between doses, taken with or after food. Maximum 1200 mg in 24 hours. See a doctor if pain lasts more than 10 days or fever more than 3 days.',
    '400 mg', 3, 4, 10,
    '["NSAID: never combine with another NSAID or with aspirin.","Blocked in the last three months of pregnancy and referred at any earlier stage.","Dose limit transcribed from the 200 mg OTC labelling - the 400 mg Moroccan leaflet must be re-read before approval."]',
    '["stomach ulcer","bleeding in the stomach","heart failure","kidney disease","liver disease","high blood pressure","asthma","bleeding disorder"]',
    'https://www.medicines.org.uk/emc/product/101282/smpc',
    'EMC ibuprofen 200 mg SmPC + NHS ibuprofen for adults, retrieved 2026-11-04'
  ),
  (
    'MA-RESEARCH-IMODIUM-2',
    '["sudden short-term diarrhoea","travellers diarrhoea without fever or blood"]',
    144, 100, 'refer', 'refer',
    '["blood in the stool","high fever with diarrhoea","dysentery","ulcerative colitis","inflammatory bowel disease","bowel obstruction","constipation","liver disease"]',
    '["loperamide"]',
    '["quinidine","ritonavir","ketoconazole","erythromycin","glycopyrrolate","desloratadine"]',
    'Adults and children 12 years and over: 2 capsules (4 mg) first, then 1 capsule (2 mg) after each loose stool. Maximum 6 capsules in 24 hours. Stop and seek assessment if there is no improvement within 48 hours, or if the abdomen becomes swollen or constipation appears.',
    '4 mg then 2 mg per loose stool', 6, null, 2,
    '["Never with blood in the stool or fever - that diarrhoea needs assessment, not slowing down.","Antimotility treatment does not replace rehydration and can mask dehydration.","The labelling limit is 2 days without assessment."]',
    '["blood in stool","fever with diarrhoea","signs of dehydration","recent antibiotics","HIV with new diarrhoea","abdominal swelling","pregnancy"]',
    'https://www.medicines.org.uk/emc/product/10420/smpc',
    'EMC Loperamide 2mg Capsules SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-RESEARCH-ZYRTEC-10',
    '["hay fever","allergic rhinitis","sneezing","runny nose","itchy eyes","hives","skin allergy"]',
    144, 100, 'refer', 'allow',
    '["severe kidney failure","dialysis","hypersensitivity to cetirizine","hypersensitivity to hydroxyzine"]',
    '["cetirizine","antihistamine","hydroxyzine"]',
    '["sedating medicine","medicine that causes drowsiness","medicine that causes dry mouth","difficulty urinating","alcohol"]',
    'Adults and children 12 years and over: 10 mg once daily. Children 6 to 12 years: 5 mg twice daily (half a tablet). Reduce to 5 mg once daily in moderate kidney or liver impairment. maximum_duration_days is left NULL: the cited SmPC sets no self-treatment limit, so a reviewer must set one before this row is enabled.',
    '10 mg once daily', 1, null, null,
    '["May cause drowsiness - warn before driving or operating machinery.","Can be taken in pregnancy and is one of the preferred antihistamines while breastfeeding.","Stop 3 days before an allergy skin test."]',
    '["kidney disease","liver disease","epilepsy","difficulty urinating","pregnancy","allergy skin test planned"]',
    'https://www.medicines.org.uk/emc/product/12956/smpc',
    'EMC Cetirizine 10 mg film-coated tablets SmPC + NHS cetirizine, retrieved 2026-11-04'
  ),
  (
    'MA-PARACETAMOL-TAB-500',
    '["headache","toothache","pain","fever","period pain"]',
    192, 100, 'refer', 'allow',
    '["liver disease","severe liver failure","hypersensitivity to paracetamol","taking another paracetamol product"]',
    '["paracetamol","acetaminophen"]',
    '["warfarin","flucloxacillin","metoclopramide","domperidone","cholestyramine","probenecid","phenytoin","carbamazepine","isoniazid","paracetamol"]',
    'Adults and children over 16: 500 mg to 1 g per dose, at least 4 hours apart, maximum 4 g in 24 hours and no more than 4 doses a day. Do not take with any other paracetamol-containing product. Do not self-treat for more than 3 days.',
    '500-1000 mg', 4, 4, 3,
    '["Hepatic risk rises with alcohol dependence, malnutrition, low body weight and chronic overuse.","Check every other product the customer takes for paracetamol before this one is added."]',
    '["liver disease","alcohol dependence","malnourished or low body weight","kidney disease"]',
    'https://www.medicines.org.uk/emc/product/101491/smpc',
    'EMC Paracetamol 500mg Tablets SmPC + NHS paracetamol for adults, retrieved 2026-11-04'
  ),
  (
    'MA-PARACETAMOL-SUSP-250',
    '["fever in a child","pain in a child"]',
    2, 15, 'refer', 'allow',
    '["liver disease","under 2 months of age without a doctor deciding the dose"]',
    '["paracetamol","acetaminophen"]',
    '["warfarin","flucloxacillin","metoclopramide","cholestyramine","probenecid","paracetamol"]',
    'Children from 2 months: dose by age band from the bottle leaflet, up to 4 doses in 24 hours with at least 4 hours between doses. Under 2 months only on a doctor''s decision. Do not use for more than 3 days without speaking to a doctor.',
    'by age band', 4, 4, 3,
    '["Paediatric product: the interview refuses anyone under 18 today, so this row cannot be reached from the kiosk until paediatric handling exists.","Measure with the supplied syringe, never a kitchen spoon."]',
    '["under 3 months with fever","liver disease","dehydration","poor feeding"]',
    'https://www.nhs.uk/medicines/paracetamol-for-children/',
    'NHS medicines: paracetamol for children, retrieved 2026-11-04'
  ),
  (
    'MA-IBUPROFEN-TAB-200',
    '["headache","toothache","muscle pain","period pain","inflammation","fever"]',
    144, 100, 'block', 'refer',
    '["stomach ulcer","past stomach ulcer","bleeding in the stomach","severe heart failure","severe kidney disease","severe liver disease","last three months of pregnancy","asthma worsened by anti-inflammatories","bleeding disorder"]',
    '["ibuprofen","anti-inflammatory","nsaid","aspirin allergy"]',
    '["aspirin","ibuprofen","naproxen","diclofenac","warfarin","heparin","methotrexate","lithium","ace inhibitor","diuretic","water tablet","ciclosporin","digoxin","steroid","ssri","quinolone antibiotic"]',
    'Adults and children 12 years and over (over 40 kg): one or two 200 mg tablets up to three times a day, at least 4 hours apart, with or after food. Maximum 6 tablets (1200 mg) in 24 hours. See a doctor if pain lasts more than 10 days or fever more than 3 days.',
    '200-400 mg', 6, 4, 10,
    '["NSAID: never combine with another NSAID or with aspirin.","Not in the last three months of pregnancy.","Dose with food to reduce stomach irritation."]',
    '["stomach ulcer","bleeding in the stomach","heart failure","kidney disease","liver disease","high blood pressure","asthma","bleeding disorder"]',
    'https://www.medicines.org.uk/emc/product/101282/smpc',
    'EMC Ibuprofen 200mg Capsules SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-IBUPROFEN-SUSP-100',
    '["fever in a child","pain in a child"]',
    3, 11, 'refer', 'refer',
    '["under 3 months of age or under 5 kg","stomach ulcer","severe heart failure","severe kidney disease","severe liver disease","asthma worsened by anti-inflammatories","chickenpox"]',
    '["ibuprofen","anti-inflammatory","nsaid"]',
    '["aspirin","ibuprofen","naproxen","diclofenac","warfarin","methotrexate","lithium","ace inhibitor","diuretic","steroid"]',
    'From 3 months and over 5 kg (under 6 months only on a doctor''s advice): dose by age band from the bottle leaflet, up to 3 doses in 24 hours with 6 to 8 hours between doses. Do not use for more than 3 days without a doctor.',
    'by age band', 3, 8, 3,
    '["Paediatric product: not reachable from the kiosk while the interview refuses under-18s.","Keep the child drinking - NSAIDs add kidney risk in dehydration.","Do not use during chickenpox."]',
    '["under 6 months with fever","dehydration","chickenpox","kidney disease","vomiting"]',
    'https://www.nhs.uk/medicines/ibuprofen-for-children/',
    'NHS medicines: ibuprofen for children, retrieved 2026-11-04'
  ),
  (
    'MA-LORATADINE-TAB-10',
    '["hay fever","allergic rhinitis","sneezing","runny nose","itchy eyes","hives","skin allergy"]',
    72, 100, 'refer', 'refer',
    '["severe liver disease","hypersensitivity to loratadine"]',
    '["loratadine","antihistamine","desloratadine"]',
    '["ketoconazole","erythromycin","cimetidine","sedating medicine","alcohol"]',
    'Adults and children 12 years and over, and children 6 to 12 years weighing over 30 kg: 10 mg once daily. In liver impairment: 10 mg every other day. Stop at least 48 hours before an allergy skin test. maximum_duration_days is left NULL: the cited SmPC sets no self-treatment limit, so a reviewer must set one before this row is enabled.',
    '10 mg once daily', 1, null, null,
    '["Drowsiness is uncommon but reported.","The reference SmPC advises avoiding use in pregnancy and while breastfeeding."]',
    '["liver disease","pregnancy","breastfeeding","allergy skin test planned"]',
    'https://www.medicines.org.uk/emc/product/3505/smpc',
    'EMC Clarityn Allergy 10mg Tablets SmPC + NHS loratadine, retrieved 2026-11-04'
  ),
  (
    'MA-ORS-SACHET',
    '["diarrhoea","fluid and salt loss","mild dehydration"]',
    3, 100, 'allow', 'allow',
    '["shock","severe dehydration needing intravenous fluid","persistent vomiting","bowel obstruction","coma","sodium or glucose malabsorption","severe kidney failure without supervision"]',
    '[]',
    '[]',
    'Dissolve one sachet in 200 mL of clean drinking water. Adults and children: one sachet after each loose bowel movement, up to 5 sachets a day, for 3 to 4 days. Make up fresh solution daily and discard what is left after 24 hours.',
    '1 sachet in 200 mL water', 5, null, 4,
    '["Rehydration is the treatment; it does not stop the diarrhoea.","Refer at once for sunken eyes, very little urine, drowsiness, rapid breathing or blood in the stool.","Not a replacement for medical care in an infant or an older person."]',
    '["signs of dehydration","blood in stool","high fever","vomiting that prevents drinking","reduced urine output","drowsiness or confusion","infant under 3 months","diabetes","heart failure","kidney disease"]',
    'https://www.medicines.org.uk/emc/product/2858/smpc',
    'EMC Dioralyte Relief Blackcurrant Sachets SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-ALGINATE-SUSP',
    '["heartburn","acid reflux","regurgitation","indigestion after meals"]',
    144, 100, 'allow', 'allow',
    '["hypersensitivity to the active substances or excipients","kidney stones","severe kidney disease","high calcium levels"]',
    '["alginate","gaviscon"]',
    '["tetracycline antibiotic","iron tablet","digoxin","levothyroxine","ketoconazole","any medicine taken within 2 hours"]',
    'Adults and children 12 years and over: 5 to 10 mL after meals and at bedtime, up to four doses a day. Leave a 2-hour gap between this and any other medicine. See a doctor if symptoms do not improve after 7 days.',
    '5-10 mL after meals', 4, null, 7,
    '["Contains sodium and calcium - caution with a low-sodium diet, heart failure, kidney disease or a history of kidney stones.","Reflux is common in pregnancy, but persistent symptoms still need assessment."]',
    '["symptoms for more than 7 days","trouble swallowing","unintended weight loss","vomiting blood","black stools","chest pain","kidney stones"]',
    'https://www.medicines.org.uk/emc/product/6715/smpc',
    'EMC Gaviscon Advance Oral Suspension SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-CALCIUM-CARBONATE-500',
    '["indigestion","heartburn","acid regurgitation"]',
    144, 100, 'allow', 'allow',
    '["high calcium levels","kidney stones","nephrocalcinosis","severe kidney failure"]',
    '["calcium carbonate","antacid"]',
    '["tetracycline antibiotic","levothyroxine","iron tablet","bisphosphonate","any medicine taken within 2 hours"]',
    'Adults and children over 12: chew or swallow 2 tablets as needed, up to a maximum of 16 tablets (8 g) in 24 hours, with a 2-hour gap from other medicines. Not for children under 12. maximum_duration_days is left NULL: the cited labelling warns against prolonged use without giving a day limit, so a reviewer must set one before this row is enabled.',
    '2 tablets', 16, null, null,
    '["Prolonged high intake raises the risk of kidney stones and rebound acidity.","Total daily calcium should stay under 2500 mg.","Antacids reduce the absorption of many medicines - keep the 2-hour gap."]',
    '["kidney stones","high calcium levels","kidney disease","symptoms for more than 7 days","trouble swallowing","weight loss"]',
    'https://www.medicines.org.uk/emc/product/101270/smpc',
    'EMC Calcium Carbonate 500 mg Chewable Tablets SmPC + NHS antacids, retrieved 2026-11-04'
  ),
  (
    'MA-OMEPRAZOLE-20',
    '["frequent heartburn","acid reflux on a recurrent basis"]',
    216, 100, 'refer', 'refer',
    '["hypersensitivity to proton pump inhibitors","past stomach or intestinal bleeding","unexplained weight loss","difficulty swallowing"]',
    '["omeprazole","esomeprazole","pantoprazole","proton pump inhibitor"]',
    '["warfarin","clopidogrel","phenytoin","diazepam","atazanavir","methotrexate","clarithromycin","rifampicin","st john''s wort"]',
    'Adults 18 years and over: one 20 mg tablet or capsule a day before food, for up to 14 days. Do not start a further course without a pharmacist or doctor. Seek assessment if symptoms do not settle during the course or return soon after it.',
    '20 mg once daily before food', 1, null, 14,
    '["Acid suppression can hide warning symptoms of serious disease - no repeated courses without assessment.","Long-term use is linked to low magnesium, vitamin B12 depletion and fractures; this row covers one 14-day course only.","Alarm symptoms must be referred, not treated here."]',
    '["vomiting blood","black stools","trouble swallowing","unintended weight loss","persistent vomiting","previous stomach ulcer","liver disease","osteoporosis"]',
    'https://www.nhs.uk/medicines/omeprazole/',
    'NHS medicines: omeprazole, retrieved 2026-11-04'
  ),
  (
    'MA-XYLOMETAZOLINE-SPRAY-1MG',
    '["blocked nose","nasal congestion from a cold","sinus pressure"]',
    144, 100, 'refer', 'refer',
    '["dry nasal inflammation","rhinitis sicca","recent pituitary surgery by the nose","narrow-angle glaucoma","hypersensitivity to xylometazoline"]',
    '["xylometazoline","decongestant spray","oxymetazoline"]',
    '["monoamine oxidase inhibitor","maoi","tricyclic antidepressant","beta blocker"]',
    'Adults and children 12 years and over: one spray into each nostril up to three times a day, with as long an interval as possible. Do not use for more than 7 consecutive days.',
    '1 spray each nostril', 3, null, 7,
    '["Beyond 7 days it causes rebound congestion and dependency - that limit is the reason for the duration block.","Caution with high blood pressure, severe coronary disease, an overactive thyroid or diabetes.","The 0.1% strength is not for children under 12; a 0.05% paediatric strength is a separate product."]',
    '["high blood pressure","heart disease","overactive thyroid","diabetes","glaucoma","difficulty urinating","pregnancy"]',
    'https://www.medicines.org.uk/emc/product/3008/smpc',
    'EMC Otrivine Blocked Nose Relief 0.1% Nasal Spray SmPC, retrieved 2026-11-04'
  ),
  (
    'MA-SALINE-NASAL-09',
    '["blocked nose","runny nose","crusting","nasal hygiene during a cold"]',
    1, 100, 'allow', 'allow',
    '[]',
    '[]',
    '[]',
    'One or two drops or sprays into each nostril as often as needed. Safe alongside other cold remedies. Discard the container after the number of days stated on the leaflet once it is opened. maximum_duration_days is left NULL: isotonic saline has no labelled treatment limit, but a reviewer should still set one before this row is enabled.',
    '1-2 drops each nostril as needed', null, null, null,
    '["No pharmacological action - it does not shrink a swollen nose the way a decongestant does.","Use a clean container and never share it between people."]',
    '["symptoms for more than 10 days","facial pain with fever","ear pain","green discharge persisting after a cold"]',
    'https://www.efda.gov.et/wp-content/uploads/2023/07/SODIUM-CHLORIDE-0.9-wv-NASAL-DROPS-ABNAL_Abacus-Parenteral-Drugs-Limited.pdf',
    'Sodium chloride 0.9% w/v nasal drops SmPC (regulator-published), retrieved 2026-11-04'
  ),
  (
    'MA-CHLORHEXIDINE-SOL-05',
    '["cleaning a minor cut or graze","minor skin infection","skin cleansing after injury"]',
    2, 100, 'refer', 'allow',
    '["hypersensitivity to chlorhexidine","deep or puncture wound","large area of broken skin","ear","eye","open skull or spinal injury"]',
    '["chlorhexidine"]',
    '["soap","detergent","anionic surfactant"]',
    'Apply undiluted to a clean pad and wipe the skin around and over the minor wound, or use as directed on the leaflet. Keep it out of the ear and eye and do not flood a cavity. Stop if it stings badly or a rash appears. maximum_duration_days is left NULL: the cited labelling gives no day limit for wound cleansing, so a reviewer must set one before this row is enabled.',
    'apply undiluted to the wound area', null, null, null,
    '["In premature babies and infants under 2 months it can cause chemical burns - never let it pool under a child.","Chlorhexidine hypersensitivity can be severe; ask before reuse.","It is inactivated by soap and detergents, so do not mix them on the skin."]',
    '["deep or gaping wound","bleeding that will not stop","spreading redness or swelling","rusty or dirty object injury","tetanus status unknown","animal or human bite","burn larger than a hand"]',
    'https://docetp.mpa.se/LMF/Hibiwash%20cutaneous%20solution%20ENG%20SmPC_09001bee842a8109.pdf',
    'Chlorhexidine gluconate cutaneous solution SmPC (Swedish MPA), retrieved 2026-11-04'
  )
) as r(
    sku, indications, min_age_months, max_age_years, pregnancy_rule, breastfeeding_rule,
    contraindications, allergy_terms, interactions, dose_text, per_dose, max_doses,
    interval_hours, max_days, warnings, referrals, source_url, source_version
  )
  on p.sku = r.sku
where p.country_code = 'MA'
on conflict (product_id) do update set
  allowed_indications = excluded.allowed_indications,
  minimum_age_months = excluded.minimum_age_months,
  maximum_age_years = excluded.maximum_age_years,
  pregnancy_rule = excluded.pregnancy_rule,
  breastfeeding_rule = excluded.breastfeeding_rule,
  contraindications = excluded.contraindications,
  allergy_terms = excluded.allergy_terms,
  interaction_rules = excluded.interaction_rules,
  dose_instructions = excluded.dose_instructions,
  maximum_duration_days = excluded.maximum_duration_days,
  warnings = excluded.warnings,
  referral_triggers = excluded.referral_triggers,
  clinical_source_url = excluded.clinical_source_url,
  clinical_source_version = excluded.clinical_source_version,
  reviewer_name = null,
  reviewer_role = null,
  reviewed_at = null,
  review_status = excluded.review_status,
  version = excluded.version + 1;

-- 5. Pathway mappings, still in_review. display_priority is the matcher's
--    substitution order: an adult with today's pain or fever gets paracetamol, a
--    3-to-7-day report falls through the 3-day paracetamol rows to the ibuprofen
--    row, which the labelling allows for 10 days of pain.
insert into public.product_pathways (
  product_id, pathway_id, approval_status, display_priority, reviewer_name, reviewed_at
)
select
  p.id, sp.id, 'in_review', r.priority, null, null
from public.products p
join (values
  ('MA-PARACETAMOL-TAB-500',      'pain_fever',       10),
  ('MA-RESEARCH-DOLIPRANE-500-EFF','pain_fever',      20),
  ('MA-IBUPROFEN-TAB-200',        'pain_fever',       30),
  ('MA-RESEARCH-BRUFEN-400',      'pain_fever',       40),
  ('MA-PARACETAMOL-SUSP-250',     'pain_fever',       50),
  ('MA-IBUPROFEN-SUSP-100',       'pain_fever',       60),
  ('MA-XYLOMETAZOLINE-SPRAY-1MG', 'cold_cough',       10),
  ('MA-SALINE-NASAL-09',          'cold_cough',       20),
  ('MA-RESEARCH-ZYRTEC-10',       'allergy',          10),
  ('MA-LORATADINE-TAB-10',        'allergy',          20),
  ('MA-ORS-SACHET',               'diarrhoea',        10),
  ('MA-RESEARCH-IMODIUM-2',       'diarrhoea',        20),
  ('MA-ALGINATE-SUSP',            'heartburn',        10),
  ('MA-CALCIUM-CARBONATE-500',    'heartburn',        20),
  ('MA-OMEPRAZOLE-20',            'heartburn',        30),
  ('MA-CHLORHEXIDINE-SOL-05',     'skin_minor_wound', 10)
) as r(sku, code, priority) on p.sku = r.sku
join public.symptom_pathways sp
  on sp.country_code = 'MA' and sp.language_code = 'en' and sp.code = r.code
where p.country_code = 'MA'
on conflict (product_id, pathway_id) do update set
  approval_status = excluded.approval_status,
  display_priority = excluded.display_priority,
  reviewer_name = null,
  reviewed_at = null;

-- 6. Coverage report. Expected: sixteen MA products, none enabled, each with a
--    safety row that has a source URL and no reviewer name yet.
select
  p.sku,
  p.product_name,
  p.market_status,
  p.clinical_status,
  p.legal_status,
  p.chatbot_enabled,
  ps.review_status,
  ps.minimum_age_months,
  ps.maximum_duration_days,
  (ps.clinical_source_url is not null) as has_source,
  (ps.reviewer_name is null) as awaiting_signature
from public.products p
left join public.product_safety ps on ps.product_id = p.id
where p.country_code = 'MA'
order by p.sku;

-- Expected: zero rows. Nothing in this migration may be enabled or approved.
select sku, product_name, clinical_status, legal_status, chatbot_enabled
from public.products
where country_code = 'MA'
  and (chatbot_enabled = true
       or clinical_status = 'approved'
       or legal_status = 'approved');

-- Expected: zero rows. Every safety row must have a source and no signature yet.
select p.sku
from public.products p
join public.product_safety ps on ps.product_id = p.id
where p.country_code = 'MA'
  and (ps.clinical_source_url is null or ps.reviewer_name is not null);

-- 7. Sign-off. Only run this after you have personally read the leaflet for each
--    product you approve, and only for those products. It is commented out
--    because the schema cannot check whether a reviewer really reviewed.
--    The example uses the two brands your own report documents as sold in
--    Morocco, so it does not require an availability claim this file cannot make.
--    What an approval here asserts:
--      clinical_status / legal_status approved - you accept the labelling facts
--        transcribed in step 4 and the duration limits on those rows
--      review_status approved - the same person takes responsibility for the
--        safety data, with a name recorded in reviewer_name
--    Set every NULL maximum_duration_days first; those rows would otherwise pass
--    any duration answer. Replace YOUR_NAME and YOUR_ROLE before running it.
--
-- begin;
-- update public.product_safety ps
-- set review_status = 'approved', reviewer_name = 'YOUR_NAME',
--     reviewer_role = 'YOUR_ROLE', reviewed_at = now(), version = version + 1
-- from public.products p
-- where ps.product_id = p.id and p.country_code = 'MA'
--   and p.sku in ('MA-RESEARCH-DOLIPRANE-500-EFF', 'MA-RESEARCH-BRUFEN-400');
--
-- update public.product_pathways pp
-- set approval_status = 'approved', reviewer_name = 'YOUR_NAME', reviewed_at = now()
-- from public.products p
-- join public.symptom_pathways sp on sp.country_code = 'MA' and sp.language_code = 'en'
-- where pp.product_id = p.id and pp.pathway_id = sp.id
--   and p.sku in ('MA-RESEARCH-DOLIPRANE-500-EFF', 'MA-RESEARCH-BRUFEN-400');
--
-- update public.symptom_pathways
-- set clinical_status = 'approved', reviewer_name = 'YOUR_NAME', reviewed_at = now(),
--     enabled = true
-- where country_code = 'MA' and language_code = 'en' and code = 'pain_fever';
--
-- update public.products
-- set clinical_status = 'approved', legal_status = 'approved'
-- where country_code = 'MA'
--   and sku in ('MA-RESEARCH-DOLIPRANE-500-EFF', 'MA-RESEARCH-BRUFEN-400');
--
-- update public.products set chatbot_enabled = true
-- where country_code = 'MA'
--   and sku in ('MA-RESEARCH-DOLIPRANE-500-EFF', 'MA-RESEARCH-BRUFEN-400');
-- commit;
--
-- Order matters: safety, then mapping, then the pathway, then the product flags,
-- and chatbot_enabled last so the enable trigger sees everything else already in
-- place. A product whose market_status is still 'unknown' fails the
-- product_enable_requires_approval check on purpose; change that only with the
-- Moroccan AMM entry in front of you.
--
-- What the engine still does with an approved MA product: clinical scope for a
-- real country is pain_fever only (SUPPORTED_PATHWAYS in
-- n8n/src/intake-and-safety-engine.js), so an approved cold_cough, allergy,
-- diarrhoea, heartburn or skin row stays unreachable until that scope is widened
-- by decision, not by data. Set web/config.js to countryCode: 'MA' to run a real
-- country at all; the ZZ demo catalogue stays exactly as 008 left it.

commit;

-- Teardown of this draft, if it has to be withdrawn (safety and mapping rows
-- cascade with the product):
-- delete from public.products where country_code = 'MA' and sku in (
--   'MA-PARACETAMOL-TAB-500','MA-PARACETAMOL-SUSP-250','MA-IBUPROFEN-TAB-200',
--   'MA-IBUPROFEN-SUSP-100','MA-LORATADINE-TAB-10','MA-ORS-SACHET','MA-ALGINATE-SUSP',
--   'MA-CALCIUM-CARBONATE-500','MA-OMEPRAZOLE-20','MA-XYLOMETAZOLINE-SPRAY-1MG',
--   'MA-SALINE-NASAL-09','MA-CHLORHEXIDINE-SOL-05');
