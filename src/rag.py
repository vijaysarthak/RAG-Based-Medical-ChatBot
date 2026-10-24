"""Builds the RAG pipeline.

app.py and the notebooks all import from here, so the chatbot you evaluate
is exactly the chatbot you run.
"""
import os

from langchain_pinecone import PineconeVectorStore
from langchain.chains import create_retrieval_chain
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

from src.prompt import system_prompt


def load_vector_store(embeddings, index_name=None):
    """Connect to the Pinecone index that store_index.py filled (read-only)."""
    index_name = index_name or os.getenv("PINECONE_INDEX_NAME", "medical-bot")
    return PineconeVectorStore.from_existing_index(
        index_name=index_name,
        embedding=embeddings,
    )


def build_rag_chain(vector_store, llm, k=3):
    """Retriever (top-k chunks) + prompt + LLM -> returns {'input', 'context', 'answer'}."""
    retriever = vector_store.as_retriever(search_type="similarity", search_kwargs={"k": k})

    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", system_prompt),
            ("human", "{input}"),
        ]
    )

    question_answer_chain = create_stuff_documents_chain(llm, prompt)
    return create_retrieval_chain(retriever, question_answer_chain)
