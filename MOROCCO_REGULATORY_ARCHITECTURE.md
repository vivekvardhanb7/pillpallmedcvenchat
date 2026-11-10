# MOROCCO_REGULATORY_ARCHITECTURE.md — Morocco Pharmacy & Medicines Governance

**Date:** 2026-11-05  
**Primary Regulatory Jurisdiction:** Kingdom of Morocco (Maroc)  
**Authorities:** Agence Marocaine du Médicament et des Produits de Santé (AMMPS) & Direction du Médicament et de la Pharmacie (DMP)

---

## 1. Moroccan Medicines Regulatory Framework

Pharmaceutical products in Morocco are governed by **Loi n° 17-04** (Code du Médicament et de la Pharmacie) and overseen by the **Ministry of Health & Social Protection** through the **DMP** and the recently created autonomous agency **AMMPS**.

### 1.1 Marketing Authorisation (Autorisation de Mise sur le Marché - AMM)
- Every commercialized medicine in Morocco requires an official AMM granted by the Ministry of Health following quality, efficacy, and safety reviews.
- An AMM is product-, strength-, form-, manufacturer-, and pack-size specific.
- **Critical Architectural Rule:** The presence of an active ingredient (e.g. Paracetamol) in Moroccan commerce does not confer authorization upon any other foreign brand or dosage form containing the same ingredient.

### 1.2 Legal Status Classifications (Statuts Réglementaires AMMPS)
The AMMPS database classifies products into the following official operational states:
1. **Commercialisé:** Currently active on the Moroccan market and legally available for pharmacy distribution.
2. **Commercialisé AO (Appel d'Offres):** Commercialized primarily through institutional hospital tenders; limited retail pharmacy availability.
3. **Non Commercialisé:** Granted an AMM historically, but not actively manufactured, imported, or distributed on the market.
4. **Retiré du Marché (Withdrawn / Revoked):** AMM canceled or withdrawn due to safety, quality, or commercial termination (e.g. `ACTIFED RHUME` pseudoephedrine combinations, or specific discontinued presentations like `DOLIPRANE 500 mg orodispersible box of 12`).
5. **AMM sans prix:** Granted scientific marketing authorization, but retail public sales price (Prix Public de Vente - PPV) has not been gazetted.

---

## 2. Prescription vs. Non-Prescription (OTC) Status in Morocco

Under Loi 17-04:
- **Tableau A (Stupéfiants / Narcotics):** Strict hospital / triplicated prescription control.
- **Tableau B (Substances vénéneuses / Toxic Substances):** Prescription mandatory.
- **Tableau C (Substances dangereuses):** Prescription required.
- **Médicaments Non Soumis à Prescription Obligatoire (Grand Public / OTC):** Eligible for self-selection in licensed retail pharmacies (e.g., standard paracetamol 500mg/1000mg packs, ibuprofen 200mg/400mg under maximum pack size thresholds, certain antacids, oral rehydration salts, saline sprays).

### Vending Machine Restrictions in Moroccan Law
- Autonomous dispensing of medicinal products via unattended kiosks in public streets is **not authorized** under standard Moroccan pharmacy law.
- Permissible deployments are restricted to:
  1. *Licensed Pharmacy Annex / Night-Counter Kiosk:* Under the legal operation and physical supervision of a licensed Doctor of Pharmacy (Docteur en Pharmacie).
  2. *Hospital / Clinical Triage Guidance:* Providing health assessment and OTC guidance without physical mechanical dispensing.

---

## 3. Data Ingestion & Traceability Standards

For every Moroccan record entered into PILLPAL:
- `jurisdiction`: `"MA"`
- `amm_number`: Official Moroccan AMM registry number.
- `ammps_status`: Exact AMMPS portal designation (`Commercialisé`, `Retiré du Marché`, `Non Commercialisé`).
- `dmp_price_ppv`: Moroccan Dirham (MAD) public price as gazetted by DMP.
- `leaflets`: Sourced from official AMMPS Résumés des Caractéristiques du Produit (RCP) and Notices patient.
