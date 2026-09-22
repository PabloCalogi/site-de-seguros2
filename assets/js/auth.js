/**
 * Autenticação: guarda de rotas, dados do usuário logado e logout.
 * Incluir DEPOIS de config.js e api.js em toda página.
 */
(function () {
  function getToken() {
    return localStorage.getItem("vs_token");
  }

  function getUser() {
    const raw = localStorage.getItem("vs_user");
    return raw ? JSON.parse(raw) : null;
  }

  function setSession(token, usuario) {
    localStorage.setItem("vs_token", token);
    localStorage.setItem("vs_user", JSON.stringify(usuario));
  }

  function logout() {
    localStorage.removeItem("vs_token");
    localStorage.removeItem("vs_user");
    window.location.href = "login.html";
  }

  // Chame no topo de qualquer página protegida (todas menos login/recuperar-senha).
  function requireAuth() {
    if (!getToken()) {
      window.location.href = "login.html";
      return false;
    }
    return true;
  }

  // Chame no login.html: se já houver sessão válida, pula direto pro dashboard.
  function redirectIfAuthenticated() {
    if (getToken()) {
      window.location.href = "dashboard.html";
      return true;
    }
    return false;
  }

  // Preenche nome/perfil no cabeçalho e esconde itens restritos a admin/gerente,
  // além de ligar o botão "Sair" de qualquer sidebar.
  function aplicarUsuarioNaTela() {
    const usuario = getUser();
    if (!usuario) return;

    document.querySelectorAll("[data-user-nome]").forEach((el) => {
      el.textContent = usuario.nome;
    });
    document.querySelectorAll("[data-user-perfil]").forEach((el) => {
      const rotulos = { admin: "Administrador", gerente: "Gerente", corretor: "Corretor" };
      el.textContent = rotulos[usuario.perfil] || usuario.perfil;
    });
    document.querySelectorAll("[data-somente-admin]").forEach((el) => {
      if (usuario.perfil !== "admin") el.style.display = "none";
    });
    document.querySelectorAll("[data-somente-admin-gerente]").forEach((el) => {
      if (usuario.perfil !== "admin" && usuario.perfil !== "gerente") el.style.display = "none";
    });

    document.querySelectorAll(".logout, [data-logout]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        logout();
      });
    });
  }

  window.auth = {
    getToken,
    getUser,
    setSession,
    logout,
    requireAuth,
    redirectIfAuthenticated,
    aplicarUsuarioNaTela,
  };
})();
