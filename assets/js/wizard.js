/**
 * Estado do wizard "Nova Cotação" compartilhado entre as 4 etapas via sessionStorage.
 * Formato: { clienteId, clienteNome, veiculo: {...}, coberturas: {...} }
 */
(function () {
  const CHAVE = "vs_wizard_estado";

  function getEstado() {
    const raw = sessionStorage.getItem(CHAVE);
    return raw ? JSON.parse(raw) : {};
  }

  function setEstado(parcial) {
    const atual = getEstado();
    const novo = Object.assign({}, atual, parcial);
    sessionStorage.setItem(CHAVE, JSON.stringify(novo));
    return novo;
  }

  function limparEstado() {
    sessionStorage.removeItem(CHAVE);
  }

  // Converte dd/mm/aaaa (como digitado com máscara) para aaaa-mm-dd (formato aceito pela API)
  function dataBrParaIso(dataBr) {
    if (!dataBr) return null;
    const partes = dataBr.split("/");
    if (partes.length !== 3) return null;
    const [d, m, a] = partes;
    if (a.length !== 4) return null;
    return `${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  window.wizard = { getEstado, setEstado, limparEstado, dataBrParaIso };
})();
