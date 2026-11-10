# CONVERSATION_MEMORY.md — Session Context & Anti-Repetition Management

**Date:** 2026-11-05  
**Audience:** Full-Stack Engineers, Dialogue System Designers  
**Scope:** Session context retention, anti-repetition guards, and privacy boundaries.

---

## 1. Context Retention Across Turns

To ensure a natural, human-like consultation, PILLPAL maintains an in-memory session object for the duration of an encounter:
1. **Never Repeat Answered Questions:** If the user has already provided their age, symptom duration, or allergy status, the conversation engine marks that slot as `answered` and never prompts for it again.
2. **Volunteered Value Extraction:**
   - *User utterance:* *"I am 28 years old and I've had a headache since this morning."*
   - *Extraction:*
     - `demographics.age`: `28` (marks `age` step answered)
     - `symptom_attributes.duration`: `'today'` (marks `duration` step answered)
   - *Engine Transition:* Skips the age and duration steps directly to severity and warning sign checks.
3. **Confirmation Read-Back:** Before executing clinical matching, the system presents an explicit confirmation screen summarizing captured facts (*"You are 28, mild headache since today, no known allergies"*).

---

## 2. Session Lifecycle & Privacy Guarantees

1. **Inactivity Watchdog:** A 120-second inactivity timer automatically wipes all session variables, clears the transcript, and resets the kiosk to the welcome screen.
2. **Post-Encounter Memory Purge:** Immediately upon the customer selecting "Finish" or printing/dispensing advice, the in-memory transcript is destroyed.
3. **No Cross-Session Linkage:** Each encounter generates a unique cryptographically random `session_id`. Consecutive users cannot see or access prior conversation data.
4. **Anonymized Telemetry:** Only non-identifiable demographic bands (e.g. `age_band: "18-64"`) and clinical outcome codes are logged for service health.
