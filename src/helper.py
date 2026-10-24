import os
from typing import List

from langchain_community.document_loaders import PyPDFLoader, DirectoryLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq


# Extract data from the PDF files
def load_pdf_file(data):
    loader = DirectoryLoader(data, glob="*.pdf", loader_cls=PyPDFLoader)
    documents = loader.load()
    return documents


# Keep only the 'source' metadata (PyPDFLoader adds a lot of extra fields)
def filter_to_minimal_docs(docs: List[Document]) -> List[Document]:
    minimal_docs: List[Document] = []
    for doc in docs:
        src = doc.metadata.get("source")
        minimal_docs.append(
            Document(page_content=doc.page_content, metadata={"source": src})
        )
    return minimal_docs


# Split the data into text chunks
def text_split(extracted_data):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=20)
    text_chunks = text_splitter.split_documents(extracted_data)
    return text_chunks


# Embedding model from Hugging Face. Still runs locally: it is small (90 MB) and fast on CPU.
def download_hugging_face_embeddings():
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2"  # returns 384-dim vectors
    )
    return embeddings


# Chat LLM served by Groq's free API (nothing is downloaded or run on your machine)
def load_llm(model_id=None, temperature=0.0):
    model_id = model_id or os.getenv("GROQ_MODEL")
    if not os.getenv("GROQ_API_KEY"):
        raise RuntimeError("GROQ_API_KEY is missing. Add it to your .env file.")
    if not model_id:
        raise RuntimeError("GROQ_MODEL is missing. Add the exact Groq model ID to your .env file.")

    return ChatGroq(
        model=model_id,
        temperature=temperature,    # 0 = same question -> same answer
        reasoning_format="hidden",  # Qwen 3 'thinks' first; return only the final answer
        max_retries=5,              # wait and retry when the free-tier rate limit is hit
    )
