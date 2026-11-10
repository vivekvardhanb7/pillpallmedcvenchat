# RESEARCH_REFERENCES.md — Authoritative Clinical, Regulatory & Engineering References

**Date:** 2026-11-05  
**Scope:** Primary citations, official authority portals, scientific papers, and open-source specifications supporting the PILLPAL MedAssist architecture.

---

## 1. Regulatory Authorities & Formularies

### 1.1 Morocco (Primary Jurisdiction)
1. **AMMPS (Agence Marocaine du Médicament et des Produits de Santé):**
   - Official portal: `https://ammps.gov.ma/`
   - Responsibilities: Authorisations de Mise sur le Marché (AMM), Référentiel National des Médicaments Génériques (RMMG), Pharmacovigilance alerts, and national drug recalls.
2. **Ministère de la Santé et de la Protection Sociale — Direction du Médicament et de la Pharmacie (DMP):**
   - Portal: `https://www.sante.gov.ma/Pages/ADM_Centrale/DMP.aspx`
   - Scope: Drug pricing regulations, pharmaceutical inspection, import/export controls, legal classification (Tableaux A, B, C / Non-prescription).
3. **CNOPS / data.gov.ma (Référentiel des Médicaments Remboursables):**
   - Data catalog: `https://data.gov.ma/data/fr/dataset/referentiel-des-medicaments`
   - Scope: Princeps vs Generic classifications, Base Remboursement (BR), Prix Public de Vente (PPV), Hospital Pricing.

### 1.2 India (Secondary Jurisdiction)
1. **CDSCO (Central Drugs Standard Control Organisation):**
   - Portal: `https://cdsco.gov.in/`
   - Legislation: Drugs and Cosmetics Act (1940) & Rules (1945), Schedules H, H1, X (Prescription Only), Fixed-Dose Combinations (FDC) approvals and prohibitions.
2. **Pharmacy Council of India (PCI):**
   - Legislation: Pharmacy Act (1948) Section 42 (Dispensing by registered pharmacists), Pharmacy Practice Regulations (2015).

### 1.3 International Formularies & Clinical Knowledge
1. **WHO Collaborating Centre for Drug Statistics Methodology:**
   - Anatomical Therapeutic Chemical (ATC) classification and Defined Daily Dose (DDD) system: `https://www.who.int/tools/atc-ddd-toolkit`
2. **National Library of Medicine (NLM) — RxNorm:**
   - Standardized nomenclature for clinical drugs: `https://www.nlm.nih.gov/research/umls/rxnorm/`
3. **National Library of Medicine — DailyMed:**
   - FDA approved structured drug labels and package inserts: `https://dailymed.nlm.nih.gov/`
4. **openFDA:**
   - Adverse events, drug product labeling, and recall enforcement reports: `https://open.fda.gov/`
5. **Base de Données Publique des Médicaments (France / ANSM):**
   - Résumés des Caractéristiques du Produit (RCP) and Notices patient: `https://base-donnees-publique.medicaments.gouv.fr/`
6. **electronic Medicines Compendium (emc - UK):**
   - Summaries of Product Characteristics (SmPC) and Patient Information Leaflets (PIL): `https://www.medicines.org.uk/`

---

## 2. Clinical Guidelines & Triage Protocols

1. **National Institute for Health and Care Excellence (NICE):**
   - Cough (acute): antimicrobial prescribing (NG120): `https://www.nice.org.uk/guidance/ng120`
   - Sore throat (acute): antimicrobial prescribing (NG84): `https://www.nice.org.uk/guidance/ng84`
   - Gastro-oesophageal reflux disease and dyspepsia in adults (CG184): `https://www.nice.org.uk/guidance/cg184`
2. **National Health Service (NHS UK) Clinical Knowledge Summaries:**
   - Headaches in adults (symptom triage & red flags): `https://www.nhs.uk/symptoms/headaches/`
   - Fever in adults (temperature cutoffs & sepsis warning signs): `https://www.nhs.uk/symptoms/fever-in-adults/`
   - Diarrhoea and vomiting: `https://www.nhs.uk/symptoms/diarrhoea-and-vomiting/`
   - Chest pain assessment: `https://www.nhs.uk/symptoms/chest-pain/`
3. **Indian Council of Medical Research (ICMR):**
   - Standard Treatment Workflows (STWs) for Primary Care: `https://www.icmr.gov.in/`
   - Treatment Guidelines for Antimicrobial Use in Common Syndromes.

---

## 3. Scientific Papers & Technical Literature

1. **Healthcare AI Kiosks:**
   - *HERMES: An AI-Powered Healthcare Kiosk for Personalized OTC Medication Recommendation* (2025). arXiv:2504.13880. Evaluates multi-modal interaction and pharmacist perception.
2. **Clinical Decision Support & LLM Safety:**
   - *Evaluation of LLM reasoning vs. deterministic symptom checkers in triage accuracy* (2024–2026). Demonstrates that unconstrained LLMs exhibit up to 19% under-triage rate in acute emergencies; hybrid deterministic guardrails restore safety to >98%.
   - Google Health MedGemma technical report: `https://github.com/Google-Health/medgemma`
3. **Speech & Edge AI:**
   - Radford et al., *Robust Speech Recognition via Large-Scale Weak Supervision* (Whisper architecture).
   - Gerganov, G., *whisper.cpp: High-performance inference of OpenAI's Whisper model in C/C++*.
   - Hansen, M., *Piper: A fast, local neural text to speech system*.
