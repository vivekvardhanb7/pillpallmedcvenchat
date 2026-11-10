"""Administrative CLI for document ingestion, verification, approval, and index maintenance.

Usage:
  python -m services.rag.cli ingest <pdf_path> --doc-id <ID> --title <Title> --lang <de|en> --collection <coll> [--approve]
  python -m services.rag.cli approve <doc_id>
  python -m services.rag.cli withdraw <doc_id>
  python -m services.rag.cli status
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

from services.rag.config import Config
from services.rag.ingest import DocumentIngestionService
from services.rag.retrieval import LocalVectorIndexAdapter


def main() -> None:
    parser = argparse.ArgumentParser(description="PillPal RAG Document Ingestion & Administration CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Ingest command
    ingest_parser = subparsers.add_parser("ingest", help="Ingest a PDF document into staging or approved index")
    ingest_parser.add_argument("pdf_path", type=Path, help="Path to PDF source document")
    ingest_parser.add_argument("--doc-id", required=True, help="Unique document identifier")
    ingest_parser.add_argument("--title", required=True, help="Title of the document / leaflet")
    ingest_parser.add_argument("--lang", choices=["de", "en"], default="de", help="Language code")
    ingest_parser.add_argument(
        "--collection",
        choices=["gale_encyclopedia", "german_product_info", "reviewed_clinical_guidance"],
        required=True,
        help="Target knowledge collection",
    )
    ingest_parser.add_argument("--source-date", default=str(date.today()), help="Source publication date (YYYY-MM-DD)")
    ingest_parser.add_argument("--version", default="1.0", help="Document version")
    ingest_parser.add_argument("--jurisdiction", default="DE", help="Regulatory jurisdiction")
    ingest_parser.add_argument("--source-url", default=None, help="Official regulatory URL")
    ingest_parser.add_argument("--approve", action="store_true", help="Bypass staging and publish directly to approved release")

    # Approve command
    approve_parser = subparsers.add_parser("approve", help="Promote a document from staging to approved release")
    approve_parser.add_argument("doc_id", help="Document ID to approve")

    # Withdraw command
    withdraw_parser = subparsers.add_parser("withdraw", help="Mark a document as withdrawn in approved release")
    withdraw_parser.add_argument("doc_id", help="Document ID to withdraw")

    # Status command
    subparsers.add_parser("status", help="Show index and collection status")

    args = parser.parse_args()
    service = DocumentIngestionService()

    if args.command == "ingest":
        metadata = {
            "document_id": args.doc_id,
            "title": args.title,
            "language": args.lang,
            "collection": args.collection,
            "source_date": args.source_date,
            "version": args.version,
            "jurisdiction": args.jurisdiction,
            "source_url": args.source_url,
        }
        passages = service.ingest_document(
            pdf_path=args.pdf_path,
            doc_metadata=metadata,
            stage_only=not args.approve,
        )
        print(f"Successfully ingested {len(passages)} passages for {args.doc_id} (approved={args.approve}).")

    elif args.command == "approve":
        count = service.approve_document(args.doc_id)
        print(f"Approved {count} passages for document ID: {args.doc_id}")

    elif args.command == "withdraw":
        count = service.withdraw_document(args.doc_id)
        print(f"Withdrew {count} passages for document ID: {args.doc_id}")

    elif args.command == "status":
        adapter = LocalVectorIndexAdapter()
        approved_count = adapter.count_approved_passages()
        staging_data = service._load_index_raw(Config.STAGING_INDEX_PATH)
        print("=== PillPal RAG Knowledge Base Status ===")
        print(f"Mode: {Config.MODE}")
        print(f"Approved Index: {Config.APPROVED_INDEX_PATH} ({approved_count} approved passages)")
        print(f"Staging Index:  {Config.STAGING_INDEX_PATH} ({len(staging_data)} staging passages)")
        print(f"Embedding Model: {Config.EMBEDDING_MODEL} (dim={Config.EMBEDDING_DIMENSION})")


if __name__ == "__main__":
    main()
