/*dados iniciais (senhas em texto simples serão convertidos para hash no init)*/
let usuarios = [
    {nome: "admin", senha: "123", perfil: "Administrador", ativo: true},
    {nome: "joao", senha: "456", perfil: "Funcionário", ativo: true},
    {nome: "maria", senha: "789", perfil: "Funcionário", ativo: false}
];

let produtos = [];
let historico = [];
let usuarioLogado = null;

//segurança: tentativas e bloqueios

let tentativasFalhas = {}; //{usuario: numero}
let bloqueios = {};        //{usuario: timestampLiberacao}

//sessao (expiracao por inatividade)

let sessaoTimer = null;
const TEMPO_SESSAO_MS = 30 * 60 * 1000; //30 minutos

function iniciarSessao(){
    if (sessaoTimer) clearTimeout(sessaoTimer);
    sessaoTimer = setTimeout(() => {
        alert("Sessão expirada por inatividade. Faça login novamente.")
        logout();
    }, TEMPO_SESSAO_MS);
}
function resetarSessaoSeLogado() {
    if (usuarioLogado) iniciarSessao();
}

//utilitario: gerar has SHA-256 (hex)
async function gerarHash(texto) {
    const encoder = new TextEncoder();
    const data = encoder.encode(texto);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}