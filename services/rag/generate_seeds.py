"""Generate representative baseline clinical source PDFs and seed knowledge base."""

from __future__ import annotations

from pathlib import Path
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

from services.rag.config import Config
from services.rag.ingest import DocumentIngestionService


def make_pdf(file_path: Path, title: str, pages_content: list[list[str]]) -> None:
    file_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(file_path), pagesize=letter)
    width, height = letter

    for page_lines in pages_content:
        c.setFont("Helvetica-Bold", 14)
        c.drawString(54, height - 54, title)

        c.setFont("Helvetica", 10)
        y = height - 80
        for line in page_lines:
            if y < 60:
                c.showPage()
                y = height - 54
                c.setFont("Helvetica", 10)
            if line.isupper() or line.endswith(":") or line.startswith("1.") or line.startswith("2.") or line.startswith("3.") or line.startswith("4.") or line.startswith("5."):
                c.setFont("Helvetica-Bold", 11)
            else:
                c.setFont("Helvetica", 10)
            c.drawString(54, y, line)
            y -= 16
        c.showPage()

    c.save()


def main():
    sources_dir = Config.SOURCES_DIR
    sources_dir.mkdir(parents=True, exist_ok=True)

    # 1. Gale Encyclopedia Headache (EN)
    gale_pdf = sources_dir / "gale_encyclopedia_headache.pdf"
    make_pdf(
        gale_pdf,
        "The Gale Encyclopedia of Medicine: Headache and Pain Management",
        [
            [
                "General Information",
                "Headaches are among the most common physical complaints reported to healthcare practitioners.",
                "Primary headaches include tension headaches, migraines, and cluster headaches without an underlying structural pathology.",
                "Tension-type headaches typically produce a dull, aching sensation across both sides of the forehead or occipital region.",
                "",
                "Therapeutic indications",
                "Self-care approaches for mild to moderate tension headaches include rest, hydration, stress management, and mild analgesics.",
                "Over-the-counter analgesics such as paracetamol (acetaminophen) and ibuprofen provide effective temporary pain relief.",
                "",
                "Special warnings and precautions",
                "Red-flag symptoms require immediate emergency medical evaluation: sudden severe headache (thunderclap headache),",
                "headache accompanied by high fever, stiff neck, mental confusion, seizures, double vision, numbness, or speech difficulty.",
                "Headaches following head trauma also necessitate urgent professional assessment."
            ]
        ]
    )

    # 2. German Paracetamol 500 SmPC (DE)
    paracetamol_pdf = sources_dir / "german_paracetamol_500_smpc.pdf"
    make_pdf(
        paracetamol_pdf,
        "Fachinformation Paracetamol 500 mg Tabletten",
        [
            [
                "Bezeichnung des Arzneimittels",
                "Paracetamol 500 mg Tabletten",
                "",
                "Anwendungsgebiete",
                "Symptomatische Behandlung von leichten bis maessig starken Schmerzen (wie Kopfschmerzen, Zahnschmerzen, Regelschmerzen) und/oder Fieber.",
                "Geeignet fuer Erwachsene und Jugendliche ab 12 Jahren (Koerpergewicht ueber 43 kg).",
                "",
                "Dosierung und Art der Anwendung",
                "Einzeldosis: 1 Tablette (500 mg Paracetamol). Bei Bedarf kann eine weitere Einzeldosis im Abstand von mindestens 4 bis 6 Stunden eingenommen werden.",
                "Die maximale Tagesdosis von 4 Tabletten (2000 mg) darf ohne aerztliche Anordnung nicht ueberschritten werden.",
                "Die Tabletten unzerkaut mit reichlich Wasser einnehmen.",
                "",
                "Gegenanzeigen",
                "Ueberempfindlichkeit gegenueber dem Wirkstoff Paracetamol oder einem der sonstigen Bestandteile.",
                "Schwere Leberfunktionsstoerungen oder akute Hepatitis.",
                "",
                "Besondere Warnhinweise",
                "Um das Risiko einer Ueberdosierung zu vermeiden, ist sicherzustellen, dass gleichzeitig angewendete Arzneimittel kein Paracetamol enthalten.",
                "Ohne aerztlichen oder zahnaerztlichen Rat nicht laenger als 3 Tage anwenden."
            ]
        ]
    )

    # 3. German Ibuprofen 400 SmPC (DE)
    ibuprofen_pdf = sources_dir / "german_ibuprofen_400_smpc.pdf"
    make_pdf(
        ibuprofen_pdf,
        "Fachinformation Ibuprofen 400 mg Filmtabletten",
        [
            [
                "Bezeichnung des Arzneimittels",
                "Ibuprofen 400 mg Filmtabletten",
                "",
                "Anwendungsgebiete",
                "Kurzzeitige symptomatische Behandlung von leichten bis maessig starken Schmerzen (z. B. Spannungskopfschmerzen, Zahnschmerzen) und Fieber.",
                "Zur Anwendung bei Erwachsenen und Jugendlichen ab 12 Jahren mit mindestens 40 kg Koerpergewicht.",
                "",
                "Dosierung und Art der Anwendung",
                "Einzeldosis: 1 Filmtablette (400 mg Ibuprofen). Falls erforderlich, kann eine weitere Dosis nach 6 Stunden eingenommen werden.",
                "Die maximale Tagesdosis betraegt 3 Filmtabletten (1200 mg Ibuprofen).",
                "Mit einem Glas Wasser zu oder nach den Mahlzeiten einnehmen, insbesondere bei empfindlichem Magen.",
                "",
                "Gegenanzeigen",
                "Bestehende oder in der Vergangenheit wiederholt aufgetretene peptische Ulzera oder Magen-Darm-Blutungen.",
                "Schwere Leber- oder Niereninsuffizienz sowie schwere Herzinsuffizienz.",
                "Drittes Trimenon der Schwangerschaft.",
                "",
                "Besondere Warnhinweise",
                "Bei Patienten mit gastrointestinalen Erkrankungen in der Vorgeschichte ist Vorsicht geboten.",
                "Bei Fortbestehen der Beschwerden nach 3 Tagen bei Fieber oder 4 Tagen bei Schmerzen sollte ein Arzt konsultiert werden."
            ]
        ]
    )

    # 4. Unreviewed Trial Article (Pending document in staging quarantine)
    pending_pdf = sources_dir / "unreviewed_trial_article.pdf"
    make_pdf(
        pending_pdf,
        "Experimental Cephalea Formulation - Unreviewed Pre-clinical Note",
        [
            [
                "Description",
                "Unreviewed pre-clinical summary of experimental receptor ligands for cephalic discomfort.",
                "",
                "Contraindications",
                "Not authorized for human dispensing. Pre-clinical laboratory evaluation only.",
                "",
                "Warnings",
                "Pending scientific and clinical panel evaluation."
            ]
        ]
    )

    print("Source PDFs generated successfully.")

    # Now ingest using DocumentIngestionService
    ingestion = DocumentIngestionService()

    # Ingest approved documents
    ingestion.ingest_document(
        gale_pdf,
        {
            "document_id": "DOC-GALE-HEADACHE-001",
            "title": "The Gale Encyclopedia of Medicine: Headache and Pain Management",
            "language": "en",
            "jurisdiction": "US",
            "source_date": "2024-01-15",
            "version": "5.2",
            "collection": "gale_encyclopedia",
            "source_url": "https://www.gale.com/health/encyclopedia-medicine",
        },
        stage_only=False,  # Direct approved release for baseline knowledge
    )

    ingestion.ingest_document(
        paracetamol_pdf,
        {
            "document_id": "DOC-DE-PARACETAMOL-500",
            "title": "Fachinformation Paracetamol 500 mg Tabletten",
            "language": "de",
            "jurisdiction": "DE",
            "source_date": "2024-03-01",
            "version": "2.1",
            "collection": "german_product_info",
            "source_url": "https://www.bfarm.de/fachinfo/paracetamol500",
        },
        stage_only=False,
    )

    ingestion.ingest_document(
        ibuprofen_pdf,
        {
            "document_id": "DOC-DE-IBUPROFEN-400",
            "title": "Fachinformation Ibuprofen 400 mg Filmtabletten",
            "language": "de",
            "jurisdiction": "DE",
            "source_date": "2024-02-20",
            "version": "3.0",
            "collection": "german_product_info",
            "source_url": "https://www.bfarm.de/fachinfo/ibuprofen400",
        },
        stage_only=False,
    )

    # Ingest unreviewed document strictly into staging only!
    ingestion.ingest_document(
        pending_pdf,
        {
            "document_id": "DOC-PENDING-EXPERIMENT-999",
            "title": "Experimental Cephalea Formulation - Unreviewed Pre-clinical Note",
            "language": "en",
            "jurisdiction": "EU",
            "source_date": "2026-05-01",
            "version": "0.1-draft",
            "collection": "reviewed_clinical_guidance",
            "source_url": "https://internal-trials.example/exp-999",
        },
        stage_only=True,  # Kept in staging quarantine
    )

    print("Baseline ingestion completed.")


if __name__ == "__main__":
    main()
