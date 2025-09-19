// Importa os módulos Express e CORS
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000; // <--- OTIMIZADO PARA SERVIÇOS DE NUVEM

// Middleware para processar JSON e habilitar CORS
app.use(express.json());
app.use(cors());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Variáveis de estado do sistema (agora em memória para a nuvem)
let proximaSenhaNormal = 1;
let proximaSenhaPreferencial = 1;
let filaNormal = [];
let filaPreferencial = [];
let prioridadePreferencial = 0;
let chamadaAtual = null;
let totalSenhasGeral = 0;

// Array para armazenar as últimas 5 senhas chamadas
let ultimasChamadas = [];

// Fila para senhas que foram atendidas e aguardam na receção
let filaAtendidas = [];
let chamadaAtendidaAtual = null;

// Rota para o Módulo do Totem: Gerar Senhas
app.post('/api/gerar-senha', (req, res) => {
    const { tipo } = req.body;
    let senhaCompleta;

    if (tipo === 'Normal') {
        const numeroSenha = proximaSenhaNormal++;
        senhaCompleta = `N${String(numeroSenha).padStart(3, '0')}`;
        filaNormal.push(senhaCompleta);
    } else if (tipo === 'Preferencial') {
        const numeroSenha = proximaSenhaPreferencial++;
        senhaCompleta = `P${String(numeroSenha).padStart(3, '0')}`;
        filaPreferencial.push(senhaCompleta);
    } else {
        return res.status(400).json({ error: 'Tipo de senha inválido.' });
    }

    totalSenhasGeral++;

    res.json({ senha: senhaCompleta, tipo: tipo });
});

// Rota para o Módulo do Operador: Chamar Próxima Senha
app.post('/api/chamar-proxima', (req, res) => {
    const { triagem } = req.body;
    let senhaChamada;

    if (prioridadePreferencial < 2 && filaPreferencial.length > 0) {
        senhaChamada = filaPreferencial.shift();
        prioridadePreferencial++;
    } else if (filaNormal.length > 0) {
        senhaChamada = filaNormal.shift();
        prioridadePreferencial = 0;
    } else if (filaPreferencial.length > 0) {
        senhaChamada = filaPreferencial.shift();
    } else {
        return res.status(404).json({ error: 'Não há senhas na fila.' });
    }

    if (chamadaAtual) {
        ultimasChamadas.unshift(chamadaAtual);
        if (ultimasChamadas.length > 5) {
            ultimasChamadas.pop();
        }
        filaAtendidas.push(chamadaAtual);
    }

    chamadaAtual = { senha: senhaChamada, triagem: triagem };
    res.json(chamadaAtual);
});

// Rota para o Módulo do Operador: Rechamar Senha
app.post('/api/rechamar', (req, res) => {
    const { triagem } = req.body;
    if (chamadaAtual && chamadaAtual.triagem === triagem) {
        res.json({ mensagem: `Rechamando senha: ${chamadaAtual.senha} na Triagem ${chamadaAtual.triagem}` });
    } else {
        res.status(404).json({ error: 'Nenhuma senha para rechamar nesta triagem.' });
    }
});

// Rota para o Módulo da Recepção - Chamar próxima senha atendida
app.post('/api/chamar-atendida', (req, res) => {
    if (filaAtendidas.length > 0) {
        chamadaAtendidaAtual = filaAtendidas.shift();
        res.json(chamadaAtendidaAtual);
    } else if (chamadaAtual) {
        chamadaAtendidaAtual = chamadaAtual;
        chamadaAtual = null;
        res.json(chamadaAtendidaAtual);
    } else {
        res.status(404).json({ error: 'Nenhuma senha atendida na fila.' });
    }
});

// Rota para obter as estatísticas e contadores
app.get('/api/estatisticas', (req, res) => {
    res.json({
        totalGeral: totalSenhasGeral,
        totalFilas: filaNormal.length + filaPreferencial.length,
        chamadaAtual: chamadaAtual,
        ultimasChamadas: ultimasChamadas,
        filaAtendidas: filaAtendidas
    });
});

// Rota para obter a senha atual da receção
app.get('/api/recepcao', (req, res) => {
    res.json({
        chamadaAtendidaAtual: chamadaAtendidaAtual,
        filaAtendidas: filaAtendidas.length
    });
});

// Rota padrão que serve o arquivo admin.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});