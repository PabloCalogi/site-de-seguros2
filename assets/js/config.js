/**
 * Configuração central do front-end.
 * Troque API_BASE_URL para o endereço da sua API em produção
 * (ex: "https://api.varginhaseguros.com.br/api").
 */
window.APP_CONFIG = {
  API_BASE_URL: (function () {
    // Em desenvolvimento local, assume o backend rodando em localhost:3000.
    // Se o front for servido pelo próprio Express (mesma origem), usa caminho relativo "/api".
    var host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host === "") {
      return "http://localhost:3000/api";
    }
    return "/api";
  })(),
};
