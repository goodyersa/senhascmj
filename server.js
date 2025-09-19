// Importa os módulos Express e CORS
const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

// Importa o módulo do SQLite
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

// Middleware para processar JSON e habilitar CORS
app.use(express.json());
app.use(cors());

const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// Variáveis de estado do sistema
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

// Inicializa o banco de dados e carrega os contadores
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS counters (key TEXT UNIQUE, value INTEGER)", (err) => {
        if (err) {
            console.error("Erro ao criar a tabela:", err);
            return;
        }

        db.get("SELECT value FROM counters WHERE key = 'totalSenhasGeral'", (err, row) => {
            if (row) {
                totalSenhasGeral = row.value;
            }
        });
        db.get("SELECT value FROM counters WHERE key = 'proximaSenhaNormal'", (err, row) => {
            if (row) {
                proximaSenhaNormal = row.value;
            }
        });
        db.get("SELECT value FROM counters WHERE key = 'proximaSenhaPreferencial'", (err, row) => {
            if (row) {
                proximaSenhaPreferencial = row.value;
            }
        });
        console.log("Contadores carregados do banco de dados.");
    });
});

// Função para salvar os contadores no banco de dados
function saveCounters() {
    db.run("INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)", ['totalSenhasGeral', totalSenhasGeral]);
    db.run("INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)", ['proximaSenhaNormal', proximaSenhaNormal]);
    db.run("INSERT OR REPLACE INTO counters (key, value) VALUES (?, ?)", ['proximaSenhaPreferencial', proximaSenhaPreferencial]);
}

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
    
    saveCounters();

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

// NOVO: Rota para a Recepção - Chamar próxima senha atendida
app.post('/api/chamar-atendida', (req, res) => {
    // Tenta chamar a próxima da fila de atendidas
    if (filaAtendidas.length > 0) {
        chamadaAtendidaAtual = filaAtendidas.shift();
        res.json(chamadaAtendidaAtual);
    } 
    // Se a fila estiver vazia, chama a senha atual do operador
    else if (chamadaAtual) {
        chamadaAtendidaAtual = chamadaAtual;
        chamadaAtual = null; // A senha foi movida para a receção
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

// Rota para limpar todas as senhas do banco de dados
app.post('/api/limpar-banco', (req, res) => {
    db.serialize(() => {
        db.run("DELETE FROM counters", (err) => {
            if (err) {
                console.error("Erro ao limpar o banco de dados:", err);
                return res.status(500).json({ error: 'Erro ao limpar o banco de dados.' });
            }
            
            proximaSenhaNormal = 1;
            proximaSenhaPreferencial = 1;
            totalSenhasGeral = 0;
            filaNormal = [];
            filaPreferencial = [];
            ultimasChamadas = [];
            filaAtendidas = [];
            chamadaAtual = null;
            chamadaAtendidaAtual = null;
            
            saveCounters();

            res.status(200).json({ mensagem: 'O banco de dados foi limpo e os contadores foram zerados.' });
        });
    });
});


// Rota padrão que serve o arquivo admin.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});