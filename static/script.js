// ---------- Page elements ----------
const chat = document.getElementById("chat");
const entries = document.getElementById("entries");
const welcome = document.getElementById("welcome");
const form = document.getElementById("composer");
const input = document.getElementById("question");
const sendBtn = document.getElementById("send");
const newChatBtn = document.getElementById("new-chat");

let busy = false;


function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}


function renderAnswer(text) {
    const lines = escapeHtml(text.trim()).split("\n");
    let html = "";
    let openList = null;

    const closeList = () => {
        if (openList) { html += `</${openList}>`; openList = null; }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        const bullet = line.match(/^[-*•]\s+(.*)/);
        const numbered = line.match(/^\d+[.)]\s+(.*)/);

        if (bullet || numbered) {
            const listType = bullet ? "ul" : "ol";
            if (openList !== listType) { closeList(); html += `<${listType}>`; openList = listType; }
            html += `<li>${(bullet || numbered)[1]}</li>`;
        } else if (line === "") {
            closeList();
        } else {
            closeList();
            html += `<p>${line}</p>`;
        }
    }
    closeList();

    return html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}


const BOOK_NAMES = {
    diabetes: "Diabetes",
    gastro: "Gastroenterology and Hepatology",
    treatment: "Standard Treatment Protocol",
    allergen: "Allergen Immunotherapy Guide",
    clinical: "Clinical Medicine",
};

function bookKey(fileName) {
    const name = fileName.toLowerCase();
    if (name.includes("diabetes")) return "diabetes";
    if (name.includes("gastro")) return "gastro";
    if (name.includes("standard") || name.includes("treatment")) return "treatment";
    if (name.includes("allergen")) return "allergen";
    if (name.includes("clinical")) return "clinical";
    return "";
}



const HEARTBEAT = `
    <svg viewBox="0 0 72 24" aria-hidden="true">
        <polyline points="0,14 18,14 22,10 26,14 32,14 35,18 39,2 43,22 46,14 54,14 58,9 62,14 72,14" />
    </svg>`;

function addEntry(question) {
    const entry = document.createElement("article");
    entry.className = "entry";
    entry.innerHTML = `
        <p class="entry-question">
            <span class="q-badge" aria-hidden="true">Q</span>
            <span class="q-text">${escapeHtml(question)}</span>
        </p>
        <div class="entry-answer">
            <div class="pending" role="status">
                ${HEARTBEAT}
                Searching the library and writing an answer
            </div>
        </div>`;
    entries.appendChild(entry);
    entry.scrollIntoView({ behavior: "smooth", block: "start" });
    return entry.querySelector(".entry-answer");
}

function showAnswer(answerEl, data, seconds) {
    let html = `<div class="answer-body">${renderAnswer(data.answer)}</div>`;

    if (data.sources && data.sources.length > 0) {
        let chips = "";
        let passages = "";

        data.sources.forEach((source, i) => {
            const book = bookKey(source.file);
            const title = BOOK_NAMES[book] || source.file.replace(/\.pdf$/i, "");
            const passage = source.text.replace(/\s*\n\s*/g, " ");

            chips += `
                <li>
                    <button class="source-chip" data-book="${book}" data-index="${i}"
                            type="button" aria-expanded="false" title="${escapeHtml(title)}">
                        <span class="source-num">${i + 1}</span>
                        <span class="source-name">${escapeHtml(title)}</span>
                    </button>
                </li>`;
            passages += `
                <blockquote class="passage" data-book="${book}" data-index="${i}" hidden>
                    <span class="passage-label">Passage ${i + 1} from ${escapeHtml(title)}</span>
                    ${escapeHtml(passage)}
                </blockquote>`;
        });

        html += `<p class="sources-heading">Sources, in order of relevance</p>
                 <ul class="sources">${chips}</ul>${passages}`;
    }

    html += `<p class="meta">Answered in ${seconds.toFixed(1)} s</p>`;
    answerEl.innerHTML = html;
}

function showError(answerEl, message) {
    answerEl.innerHTML = `<p class="error-text">${escapeHtml(message)}</p>`;
}


// ---------- Talking to Flask ----------
async function ask(question) {
    if (busy || question.trim() === "") return;

    welcome.hidden = true;
    newChatBtn.hidden = false;
    setBusy(true);

    const answerEl = addEntry(question.trim());
    const started = performance.now();

    try {
        const body = new FormData();
        body.append("msg", question.trim());

        let response;
        try {
            response = await fetch("/get", { method: "POST", body });
        } catch (err) {
            showError(answerEl, "Couldn't reach the server. Check that app.py is still running, then ask again.");
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (err) {
            console.error("Reply from /get was not JSON. HTTP status:", response.status);
            showError(answerEl,
                `The server replied, but not in the format this page expects (HTTP ${response.status}). ` +
                "Make sure app.py is the version whose /get route returns JSON, and check the terminal running app.py for errors.");
            return;
        }

        if (!response.ok) {
            showError(answerEl, `The answer couldn't be generated: ${data.error}. Wait a moment and ask again.`);
            return;
        }

        showAnswer(answerEl, data, (performance.now() - started) / 1000);
    } finally {
        setBusy(false);
        input.focus();
    }
}

function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    sendBtn.setAttribute("aria-label", value ? "Asking" : "Ask");
}


form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value;
    input.value = "";
    autoGrow();
    ask(question);
});

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        form.requestSubmit();
    }
});

function autoGrow() {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
}
input.addEventListener("input", autoGrow);


document.querySelectorAll(".book-card").forEach((button) => {
    button.addEventListener("click", () => ask(button.dataset.question));
});

entries.addEventListener("click", (event) => {
    const chip = event.target.closest(".source-chip");
    if (!chip) return;

    const answerEl = chip.closest(".entry-answer");
    const opening = chip.getAttribute("aria-expanded") !== "true";

    answerEl.querySelectorAll(".source-chip").forEach((c) => c.setAttribute("aria-expanded", "false"));
    answerEl.querySelectorAll(".passage").forEach((p) => { p.hidden = true; });

    if (opening) {
        chip.setAttribute("aria-expanded", "true");
        answerEl.querySelector(`.passage[data-index="${chip.dataset.index}"]`).hidden = false;
    }
});

newChatBtn.addEventListener("click", () => {
    entries.innerHTML = "";
    welcome.hidden = false;
    newChatBtn.hidden = true;
    chat.scrollTop = 0;
    input.focus();
});

input.focus();
