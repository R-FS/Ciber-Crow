require('dotenv').config();
const express = require('express');
const path = require('path');
const os = require('os');
const cors = require('cors');
const speedTest = require('speedtest-net');
const cookieParser = require('cookie-parser');
const app = express();
const port = process.env.PORT || 3000;

// Importar rotas
const authRoutes = require('./routes/authRoutes');

// Configuração do EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware para log de requisições e passar a rota atual para as visualizações
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    // Passa a rota atual para todas as visualizações
    res.locals.currentPath = req.path;
    next();
});

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        if (path.endsWith('.js')) {
            res.set('Content-Type', 'application/javascript');
        }
    }
}));

// Obter endereços de rede
const getNetworkInfo = () => {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                addresses.push({
                    name,
                    address: iface.address,
                    netmask: iface.netmask,
                    mac: iface.mac
                });
            }
        }
    }
    
    return addresses;
};

// Rotas de API
app.use('/api/auth', authRoutes);

// Rotas de visualização
app.get('/', (req, res) => {
    res.render('index', { 
        title: 'Teste de Velocidade - Ciber Crow',
        description: 'Teste a velocidade da sua conexão de internet de forma rápida e confiável.'
    });
});

app.get('/sobre', (req, res) => {
    res.render('sobre', { 
        title: 'Sobre - Ciber Crow',
        description: 'Saiba mais sobre o nosso serviço de teste de velocidade.'
    });
});

app.get('/contato', (req, res) => {
    res.render('contato', { 
        title: 'Contato - Ciber Crow',
        description: 'Entre em contato conosco para mais informações.'
    });
});

app.get('/login', (req, res) => {
    res.render('login', { 
        title: 'Login - Ciber Crow',
        description: 'Acesse sua conta ou crie uma nova.'
    });
});

// Rota para informações da rede
app.get('/api/network', (req, res) => {
    res.json({
        hostname: os.hostname(),
        networkInterfaces: getNetworkInfo(),
        timestamp: Date.now()
    });
});

// Rota para teste de ping
app.get('/api/ping', (req, res) => {
    res.json({ 
        ping: 'pong', 
        timestamp: Date.now() 
    });
});

// Rota para teste de download
app.get('/api/download', (req, res) => {
    const size = parseInt(req.query.size) || 5 * 1024 * 1024; // 5MB padrão
    const buffer = Buffer.alloc(size);
    
    // Preenche o buffer com dados aleatórios para evitar compressão
    for (let i = 0; i < buffer.length; i++) {
        buffer[i] = Math.floor(Math.random() * 256);
    }
    
    res.setHeader('Content-Length', size);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store, no-cache, no-transform, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    
    // Divide em chunks para melhor precisão
    const chunkSize = 64 * 1024; // 64KB
    let offset = 0;
    
    const sendChunk = () => {
        if (offset >= buffer.length) {
            return res.end();
        }
        
        const chunk = buffer.slice(offset, offset + chunkSize);
        offset += chunkSize;
        
        if (!res.write(chunk)) {
            res.once('drain', sendChunk);
        } else {
            process.nextTick(sendChunk);
        }
    };
    
    sendChunk();
});

// Rota para teste de upload
app.post('/api/upload', express.raw({ 
    type: '*/*', 
    limit: '50mb' 
}), (req, res) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const startTime = parseInt(req.query.startTime || Date.now());
    const duration = Date.now() - startTime;
    
    res.json({ 
        received: contentLength,
        duration: duration,
        speed: (contentLength * 8) / (duration / 1000), // bits por segundo
        timestamp: Date.now()
    });
});

// Rota para teste de velocidade completo (opcional, usando speedtest-net)
app.get('/api/speedtest', (req, res) => {
    const test = speedTest({
        maxTime: 10000, // 10 segundos máximo por teste
        serverId: null, // Usa o servidor mais próximo automaticamente
        acceptLicense: true,
        acceptGdpr: true
    });
    
    test.on('data', data => {
        res.json({
            ping: data.ping.latency,
            download: data.download.bandwidth * 8, // Convertendo para bits
            upload: data.upload.bandwidth * 8,    // Convertendo para bits
            server: data.server.host,
            timestamp: Date.now()
        });
    });
    
    test.on('error', err => {
        console.error('Erro no teste de velocidade:', err);
        res.status(500).json({ 
            error: 'Erro ao realizar teste de velocidade',
            details: err.message 
        });
    });
});

// Servir o frontend
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
    console.error('Erro:', err.stack);
    res.status(500).json({ 
        error: 'Algo deu errado!',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Erro interno do servidor'
    });
});

app.listen(port, '0.0.0.0', () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
    console.log('Endereços de rede disponíveis:');
    getNetworkInfo().forEach(iface => {
        console.log(`- ${iface.name}: http://${iface.address}:${port}`);
    });
});
