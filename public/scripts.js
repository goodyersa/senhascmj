// Variável de controle de áudio
let audioAtivado = false;

// URL base do seu servidor
const SERVER_URL = 'https://senhascmj.vercel.app/';

// Função para tocar o áudio
function playAudio() {
    if (audioAtivado) {
        const audio = new Audio(`${SERVER_URL}/ding.mp3`); 
        audio.play().catch(e => {
            console.error("Erro ao tocar o áudio:", e);
        });
    } else {
        console.log("Áudio não ativado. Clique no botão de ativação.");
    }
}
        
// As demais funções de API e controle de tela
async function atualizarPainelExibicao() {
    try {
        const response = await fetch(`${SERVER_URL}/api/estatisticas`);
        const data = await response.json();
        
        if (document.getElementById('contador-senhas')) {
            document.getElementById('contador-senhas').textContent = data.totalFilas;
        }
        if (document.getElementById('total-geral')) {
            document.getElementById('total-geral').textContent = data.totalGeral;
        }
        
        if (document.getElementById('senha-painel')) {
            if (data.chamadaAtual) {
                document.getElementById('senha-painel').textContent = data.chamadaAtual.senha.slice(1);
                document.getElementById('senha-tipo').textContent = data.chamadaAtual.senha.slice(0, 1);
                document.getElementById('triagem-completa').textContent = data.chamadaAtual.triagem.toUpperCase();
            } else {
                document.getElementById('senha-painel').textContent = '--';
                document.getElementById('senha-tipo').textContent = '--';
                document.getElementById('triagem-completa').textContent = '--';
            }
        }
        
        const ultimasSenhasContainer = document.getElementById('antigos-senhas-container');
        if (ultimasSenhasContainer) {
            ultimasSenhasContainer.innerHTML = '';
            data.ultimasChamadas.slice(0, 3).forEach(chamada => {
                const senhaBox = document.createElement('div');
                senhaBox.className = 'senha-box-antiga';
                
                const tipoSpan = document.createElement('span');
                tipoSpan.className = 'senha-antiga-tipo';
                tipoSpan.textContent = chamada.senha.slice(0, 1);

                const numeroSpan = document.createElement('span');
                numeroSpan.className = 'senha-antiga-numero';
                numeroSpan.textContent = chamada.senha.slice(1);

                const triagemSpan = document.createElement('span');
                triagemSpan.className = 'senha-antiga-triagem';
                triagemSpan.textContent = chamada.triagem;

                senhaBox.appendChild(tipoSpan);
                senhaBox.appendChild(numeroSpan);
                senhaBox.appendChild(triagemSpan);
                ultimasSenhasContainer.appendChild(senhaBox);
            });
        }
    } catch (error) {
        console.error('Erro ao buscar estatísticas para o painel:', error);
    }
}

// Função para atualizar o painel da receção
async function atualizarPainelRecepcao() {
    try {
        const response = await fetch(`${SERVER_URL}/api/recepcao`);
        const data = await response.json();
        
        if (document.getElementById('contador-atendidas')) {
            document.getElementById('contador-atendidas').textContent = data.filaAtendidas;
        }

        if (document.getElementById('senha-recepcao')) {
            if (data.chamadaAtendidaAtual) {
                document.getElementById('senha-recepcao').textContent = data.chamadaAtendidaAtual.senha;
                document.getElementById('triagem-recepcao').textContent = `Triagem: ${data.chamadaAtendidaAtual.triagem}`;
            } else {
                document.getElementById('senha-recepcao').textContent = '--';
                document.getElementById('triagem-recepcao').textContent = '--';
            }
        }
    } catch (error) {
        console.error('Erro ao buscar informações da receção:', error);
    }
}

// ... (código para gerar e imprimir a senha permanece igual) ...

// Função para gerar uma nova senha no totem
async function gerarSenha(tipo) {
    try {
        const response = await fetch(`${SERVER_URL}/api/gerar-senha`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo: tipo })
        });

        if (!response.ok) {
            throw new Error('Erro ao gerar senha.');
        }

        const data = await response.json();
        const senhaGerada = data.senha;
        const tipoSenha = data.tipo;

        document.getElementById('ultima-senha-totem').textContent = `Senha gerada: ${senhaGerada} (${tipoSenha})`;
        
        imprimirSenha(senhaGerada, tipoSenha);

        await atualizarPainelExibicao();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível gerar a senha. Verifique se o servidor está online.');
    }
}

// Função para a receção - chamar senha atendida
async function chamarSenhaAtendida() {
    try {
        const response = await fetch(`${SERVER_URL}/api/chamar-atendida`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.status === 404) {
            alert('Não há senhas atendidas na fila.');
            return;
        }
        
        if (!response.ok) {
            throw new Error('Erro ao chamar a próxima senha atendida.');
        }

        const data = await response.json();
        document.getElementById('senha-recepcao').textContent = data.senha;
        document.getElementById('triagem-recepcao').textContent = `Triagem: ${data.triagem}`;

        playAudio();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível chamar a próxima senha atendida. Verifique se o servidor está online.');
    }
}


async function chamarProximaSenha() {
    try {
        const triagemSelecionada = document.getElementById('triagem-selecionada-info').textContent.split(': ')[1];
        const response = await fetch(`${SERVER_URL}/api/chamar-proxima`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ triagem: triagemSelecionada })
        });
        
        if (response.status === 404) {
            alert('Não há senhas na fila.');
            return;
        }
        
        if (!response.ok) {
            throw new Error('Erro ao chamar a próxima senha.');
        }

        const data = await response.json();
        document.getElementById('senha-atendida').textContent = data.senha;
        document.getElementById('triagem-operador').textContent = `Triagem: ${data.triagem}`;
        
        playAudio();

        await atualizarPainelExibicao();
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível chamar a próxima senha. Verifique se o servidor está online.');
    }
}

async function rechamarSenha() {
    try {
        const triagemSelecionada = document.getElementById('triagem-selecionada-info').textContent.split(': ')[1];
        const response = await fetch(`${SERVER_URL}/api/rechamar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ triagem: triagemSelecionada })
        });

        if (response.status === 404) {
            alert('Nenhuma senha para rechamar.');
            return;
        }

        if (!response.ok) {
            throw new Error('Erro ao rechamar a senha.');
        }

        const data = await response.json();
        alert(data.mensagem);
        
        playAudio();
        
        await atualizarPainelExibicao();
        
    } catch (error) {
        console.error('Erro:', error);
        alert('Não foi possível rechamar a senha. Verifique se o servidor está online.');
    }
}


function ativarAudio() {
    if (audioAtivado) return;
    try {
        const audio = new Audio(`${SERVER_URL}/ding.mp3`); 
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.then(() => {
                audioAtivado = true;
                localStorage.setItem('audioAtivado', 'true');
                if (document.getElementById('ativar-audio-btn')) {
                    document.getElementById('ativar-audio-btn').classList.add('hidden');
                }
                alert('Áudio ativado com sucesso! Pode continuar.');
            }).catch(e => {
                console.error("Erro ao tentar ativar o áudio:", e);
                alert('Não foi possível ativar o áudio. Por favor, verifique as configurações do seu navegador.');
            });
        }
    } catch (e) {
        console.error("Erro ao criar objeto de áudio:", e);
        alert('Não foi possível ativar o áudio. Por favor, verifique as configurações do seu navegador.');
    }
}

function selecionarTriagem(triagem) {
    const triagemInfo = document.getElementById('triagem-selecionada-info');
    if (triagemInfo) {
        triagemInfo.innerHTML = `Triagem Selecionada: **${triagem}**`;
        document.getElementById('triagem1-btn').classList.remove('active');
        document.getElementById('triagem2-btn').classList.remove('active');
        document.getElementById(triagem === 'Triagem 1' ? 'triagem1-btn' : 'triagem2-btn').classList.add('active');
    }
}

function init() {
    if (localStorage.getItem('audioAtivado') === 'true') {
        audioAtivado = true;
    }

    const ativarAudioBtn = document.getElementById('ativar-audio-btn');
    if (ativarAudioBtn && audioAtivado) {
        ativarAudioBtn.classList.add('hidden');
    }

    // REMOVIDO: a chamada redundante de setInterval de todos os HTMLs
    // Apenas este init() é responsável por atualizar
    setInterval(atualizarPainelExibicao, 3000);
}

document.addEventListener('DOMContentLoaded', init);