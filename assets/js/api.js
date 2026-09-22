/**
 * Cliente HTTP central. Todas as telas usam window.api.get/post/put/patch/del
 * em vez de chamar fetch() diretamente — isso garante que o token JWT seja
 * sempre enviado e que erros/401 sejam tratados de forma consistente.
 */
(function () {
  const BASE_URL = window.APP_CONFIG.API_BASE_URL;

  function getToken() {
    return localStorage.getItem("vs_token");
  }

  class ApiError extends Error {
    constructor(message, status, payload) {
      super(message);
      this.status = status;
      this.payload = payload;
    }
  }

  async function request(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    let response;
    try {
      response = await fetch(BASE_URL + path, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      throw new ApiError(
        "Não foi possível conectar à API. Verifique se o backend está rodando em " + BASE_URL + ".",
        0,
        null
      );
    }

    // 204 No Content
    if (response.status === 204) return null;

    let data = null;
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await response.json().catch(() => null);
    }

    if (!response.ok) {
      // Sessão expirada ou token inválido -> volta para o login
      if (response.status === 401 && !path.startsWith("/auth/login")) {
        localStorage.removeItem("vs_token");
        localStorage.removeItem("vs_user");
        if (!window.location.pathname.endsWith("login.html")) {
          window.location.href = "login.html";
        }
      }
      const mensagem =
        (data && (data.erro || (data.errors && data.errors[0] && data.errors[0].msg))) ||
        "Ocorreu um erro ao comunicar com o servidor.";
      throw new ApiError(mensagem, response.status, data);
    }

    return data;
  }

  window.api = {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    patch: (path, body) => request("PATCH", path, body),
    del: (path) => request("DELETE", path),
    ApiError,
  };
})();
