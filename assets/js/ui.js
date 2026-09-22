/**
 * Helpers genéricos de UI usados em várias telas.
 */
(function () {
  function formatMoney(valor) {
    const n = Number(valor || 0);
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function formatDate(iso) {
    if (!iso) return "-";
    const d = new Date(iso.replace(" ", "T"));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("pt-BR");
  }

  function formatDateTime(iso) {
    if (!iso) return "-";
    const d = new Date(iso.replace(" ", "T"));
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString("pt-BR");
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function debounce(fn, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), wait || 300);
    };
  }

  // ---------- Toast ----------
  function ensureToastContainer() {
    let el = document.getElementById("vs-toast-container");
    if (!el) {
      el = document.createElement("div");
      el.id = "vs-toast-container";
      document.body.appendChild(el);
    }
    return el;
  }

  function toast(mensagem, tipo) {
    const container = ensureToastContainer();
    const item = document.createElement("div");
    item.className = "vs-toast vs-toast-" + (tipo || "info");
    item.textContent = mensagem;
    container.appendChild(item);
    requestAnimationFrame(() => item.classList.add("show"));
    setTimeout(() => {
      item.classList.remove("show");
      setTimeout(() => item.remove(), 300);
    }, 3800);
  }

  // ---------- Modal genérico ----------
  // Uso: <div class="vs-modal-overlay" id="modalCliente"> ... </div>
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("open");
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove("open");
  }

  // Fecha modal ao clicar fora do card ou no botão com data-close-modal
  document.addEventListener("click", (e) => {
    if (e.target.classList && e.target.classList.contains("vs-modal-overlay")) {
      e.target.classList.remove("open");
    }
    if (e.target.closest && e.target.closest("[data-close-modal]")) {
      const overlay = e.target.closest(".vs-modal-overlay");
      if (overlay) overlay.classList.remove("open");
    }
  });

  function confirmar(mensagem) {
    return window.confirm(mensagem);
  }

  window.ui = {
    formatMoney,
    formatDate,
    formatDateTime,
    escapeHtml,
    debounce,
    toast,
    openModal,
    closeModal,
    confirmar,
  };
})();
