var musicas = [
    "playlist/boto_ou_nao.mp3",
    "playlist/JulietaTa.mp3",
    "playlist/VIRAVIRA.mp3"
];

var nomes = [
    "Música 1 - Eu boto ou não boto",
    "Música 2 - Julieta Ta",
    "Música 3 - VIRA VIRA"
];

var player = document.getElementById("player");
var indiceAtual = 0;
var modo = "normal";

function tocarMusica(indice){
    indiceAtual = indice;
    player.src = musicas[indice];
    player.play()
    //atualizar playlist
    var itens = document.querySelectorAll("#lista li");
    itens.forEach(function(item){
        item.classList.remove("active");
    });
    itens[indice].classList.add("active");

    //atualizar faixa atual
    document.getElementById("faixaAtual").textContent = "Tocando agora: " + nomes[indice];

}

player.addEventListener("ended", function(){
    if (modo === "normal"){
        indiceAtual++;
        if (indiceAtual >= musicas.length)  indiceAtual = 0;
    }

    else if (modo === "aleatorio") {
        indiceAtual = Math.floor(Math.random() * musicas.length);
    }

    //Modo repetir mantém a mesma música
    tocarMusica(indiceAtual);

});

function modoAleatorio() {
    modo = "aleatorio";
    alert("Modo aleatório ativado");
}

function modoRepetir(){
    modo = "repetir";
    alert("Modo repetir ativado");
}

function modoNormal(){
    modo = "normal";
    alert("Modo normal ativado");
}

function formatarTempo(segundos){
    var min = Math.floor(segundos / 60);
    var seg = Math.floor(segundos % 60);
    if (seg < 10){
        seg = "0" + seg;
    }

    if (min < 10){
        min = "0" + min;
    }
    return min + ":" + seg
}
player.addEventListener("timeupdate", function(){
    document.getElementById("tempoAtual").textContent = formatarTempo(player.currentTime);
    document.getElementById("tempoTotal").textContent = formatarTempo(player.duration);

    var porcentagem = (player.currentTime / player.duration) * 100;

    document.getElementById("progresso").style.width = porcentagem + "%";
});

document.getElementById("barra").addEventListener("click", function(e) {
    var largura = this.clientWidth;
    var cliqueX = e.offsetX;
    var novaPosicao = (cliqueX / largura) * player.duration;
    player.currentTime = novaPosicao;

});