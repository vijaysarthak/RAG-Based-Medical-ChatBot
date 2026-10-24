import os

from dotenv import load_dotenv

load_dotenv()

from flask import Flask, render_template, request, jsonify

from src.helper import download_hugging_face_embeddings, load_llm
from src.rag import load_vector_store, build_rag_chain


if not os.getenv("PINECONE_API_KEY"):
    raise RuntimeError("PINECONE_API_KEY is missing. Add it to your .env file.")


app = Flask(__name__)


embeddings = download_hugging_face_embeddings()
vector_store = load_vector_store(embeddings)
chatModel = load_llm()   # the chat model configured in .env
rag_chain = build_rag_chain(vector_store, chatModel, k=3)


@app.route("/")
def index():
    return render_template("chat.html")


@app.route("/get", methods=["POST"])
def chat():
    msg = request.form.get("msg", "").strip()
    if not msg:
        return jsonify({"error": "the question is empty"}), 400

    print("User :", msg)
    try:
        response = rag_chain.invoke(
            {"input": msg},
            config={"run_name": "medical-bot-chat"},
        )
    except Exception as exc:
        print("Error :", exc)
        return jsonify({"error": str(exc)}), 502

    answer = response["answer"].strip()
    print("Response :", answer)

    sources = [
        {
            "file": os.path.basename(doc.metadata.get("source", "").replace("\\", "/")),
            "text": doc.page_content,
        }
        for doc in response["context"]
    ]
    return jsonify({"answer": answer, "sources": sources})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8080, debug=True, use_reloader=False)
