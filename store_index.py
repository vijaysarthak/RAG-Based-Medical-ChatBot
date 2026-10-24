import os
import sys

from dotenv import load_dotenv
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore

from src.helper import (
    load_pdf_file,
    filter_to_minimal_docs,
    text_split,
    download_hugging_face_embeddings,
)

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
if not PINECONE_API_KEY:
    raise RuntimeError("PINECONE_API_KEY is missing. Add it to your .env file.")

# Pinecone index names: lowercase letters, digits and '-' only
INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "medical-bot")


pc = Pinecone(api_key=PINECONE_API_KEY)

if not pc.has_index(INDEX_NAME):
    pc.create_index(
        name=INDEX_NAME,
        dimension=384,          # must match all-MiniLM-L6-v2
        metric="cosine",
        spec=ServerlessSpec(cloud="aws", region="us-east-1"),
    )

index = pc.Index(INDEX_NAME)
existing = index.describe_index_stats().get("total_vector_count", 0)
if existing > 0:
    # Running this script twice would upload every chunk again (duplicates).
    print(f"Index '{INDEX_NAME}' already has {existing} vectors - nothing to do.")
    print("To rebuild it, delete the index in the Pinecone console and run this again.")
    sys.exit(0)


extracted_data = load_pdf_file(data="data/")
filter_data = filter_to_minimal_docs(extracted_data)
text_chunks = text_split(filter_data)
print(f"Pages: {len(extracted_data)}  Chunks: {len(text_chunks)}")

embeddings = download_hugging_face_embeddings()

PineconeVectorStore.from_documents(
    documents=text_chunks,
    index_name=INDEX_NAME,
    embedding=embeddings,
)
print(f"Uploaded {len(text_chunks)} chunks to Pinecone index '{INDEX_NAME}'.")
