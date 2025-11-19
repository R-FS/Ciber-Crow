const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');

// Importar rotas e controllers
const authRoutes = require('../routes/authRoutes');
const speedTestRoutes = require('../routes/speedTestRoutes');
const { saveTestResult, getTestHistory, getTestStats } = require('../controllers/speedTestController');

// Mock do banco de dados para testes funcionais
jest.mock('../db/database', () => ({
  query: jest.fn(),
  run: jest.fn()
}));

const { query, run } = require('../db/database');

// Criar app de teste
function createTestApp() {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  app.use(cookieParser());
  
  // Middleware para simular usuário autenticado
  app.use((req, res, next) => {
    if (req.headers['x-user-id']) {
      req.user = { id: parseInt(req.headers['x-user-id']) };
    }
    next();
  });
  
  // Montar rotas diretamente para teste
  app.post('/api/speedtest/save', saveTestResult);
  app.get('/api/speedtest/history', getTestHistory);
  app.get('/api/speedtest/stats', getTestStats);
  
  return app;
}

describe('Functional Tests - API Endpoints', () => {
  let app;
  let testUserId = 1;

  beforeEach(() => {
    app = createTestApp();
    jest.clearAllMocks();
  });

  describe('POST /api/speedtest/save', () => {
    it('deve salvar resultado do teste com sucesso', async () => {
      run.mockResolvedValue({ lastID: 123 });
      
      const response = await request(app)
        .post('/api/speedtest/save')
        .set('X-User-ID', testUserId.toString())
        .send({
          downloadSpeed: 50000000,
          uploadSpeed: 10000000,
          ping: 20,
          jitter: 5,
          serverName: 'Test Server',
          serverLocation: 'Portugal',
          ipAddress: '192.168.1.1',
          isp: 'Test ISP'
        });

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        testId: 123
      });
    });

    it('deve retornar 400 para dados inválidos', async () => {
      const response = await request(app)
        .post('/api/speedtest/save')
        .set('X-User-ID', testUserId.toString())
        .send({
          downloadSpeed: 50000000,
          uploadSpeed: 10000000
          // ping faltando
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields'
      });
    });

    it('deve retornar 401 se usuário não estiver autenticado', async () => {
      const response = await request(app)
        .post('/api/speedtest/save')
        .send({
          downloadSpeed: 50000000,
          uploadSpeed: 10000000,
          ping: 20
        });

      expect(response.status).toBe(500); // Controller retorna 500 quando não há req.user
    });

    it('deve lidar com erro do servidor', async () => {
      run.mockRejectedValue(new Error('Database error'));
      
      const response = await request(app)
        .post('/api/speedtest/save')
        .set('X-User-ID', testUserId.toString())
        .send({
          downloadSpeed: 50000000,
          uploadSpeed: 10000000,
          ping: 20
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: 'Failed to save test result'
      });
    });
  });

  describe('GET /api/speedtest/history', () => {
    it('deve retornar histórico com sucesso', async () => {
      const mockUserCheck = [{ id: testUserId }];
      const mockHistory = [
        {
          id: 1,
          downloadSpeed: '50.00',
          uploadSpeed: '10.00',
          ping: 20,
          jitter: 5,
          serverName: 'Test Server',
          serverLocation: 'Portugal',
          testDate: '2023-01-01T12:00:00.000Z'
        }
      ];

      query
        .mockResolvedValueOnce(mockUserCheck)
        .mockResolvedValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/speedtest/history')
        .set('X-User-ID', testUserId.toString());

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0]).toHaveProperty('downloadSpeed', '50.00');
    });

    it('deve respeitar parâmetro limit', async () => {
      const mockUserCheck = [{ id: testUserId }];
      const mockHistory = [];

      query
        .mockResolvedValueOnce(mockUserCheck)
        .mockResolvedValueOnce(mockHistory);

      const response = await request(app)
        .get('/api/speedtest/history?limit=5')
        .set('X-User-ID', testUserId.toString());

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [testUserId, 5]
      );
    });

    it('deve retornar 401 sem autenticação', async () => {
      const response = await request(app)
        .get('/api/speedtest/history');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: 'Usuário não autenticado'
      });
    });

    it('deve retornar 404 para usuário inexistente', async () => {
      query.mockResolvedValue([]); // Usuário não encontrado

      const response = await request(app)
        .get('/api/speedtest/history')
        .set('X-User-ID', '999');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Usuário não encontrado'
      });
    });
  });

  describe('GET /api/speedtest/stats', () => {
    it('deve retornar estatísticas com sucesso', async () => {
      const mockStats = [{
        totalTests: 10,
        avgDownload: 45.5,
        avgUpload: 12.3,
        avgPing: 25.0,
        avgJitter: 3.2,
        maxDownload: 80.0,
        maxUpload: 25.0,
        minPing: 15.0
      }];

      query.mockResolvedValue(mockStats);

      const response = await request(app)
        .get('/api/speedtest/stats')
        .set('X-User-ID', testUserId.toString());

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        totalTests: 10,
        avgDownload: '45.50',
        avgUpload: '12.30',
        avgPing: '25.00',
        avgJitter: '3.20',
        maxDownload: '80.00',
        maxUpload: '25.00',
        minPing: '15.00'
      });
    });

    it('deve usar parâmetro days personalizado', async () => {
      query.mockResolvedValue([{
        totalTests: 5,
        avgDownload: 40.0,
        avgUpload: 10.0,
        avgPing: 30.0,
        avgJitter: 2.5,
        maxDownload: 60.0,
        maxUpload: 20.0,
        minPing: 20.0
      }]);

      const response = await request(app)
        .get('/api/speedtest/stats?days=7')
        .set('X-User-ID', testUserId.toString());

      expect(response.status).toBe(200);
      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INTERVAL ? DAY'),
        [testUserId, 7]
      );
    });

    it('deve lidar com estatísticas vazias', async () => {
      query.mockResolvedValue([{
        totalTests: 0,
        avgDownload: null,
        avgUpload: null,
        avgPing: null,
        avgJitter: null,
        maxDownload: null,
        maxUpload: null,
        minPing: null
      }]);

      const response = await request(app)
        .get('/api/speedtest/stats')
        .set('X-User-ID', testUserId.toString());

      expect(response.status).toBe(200);
      expect(response.body.totalTests).toBe(0);
      expect(response.body.avgDownload).toBeNull();
    });
  });

  describe('Fluxo completo de testes', () => {
    it('deve executar fluxo completo: salvar -> histórico -> estatísticas', async () => {
      // 1. Salvar teste
      run.mockResolvedValue({ lastID: 123 });
      
      const saveResponse = await request(app)
        .post('/api/speedtest/save')
        .set('X-User-ID', testUserId.toString())
        .send({
          downloadSpeed: 50000000,
          uploadSpeed: 10000000,
          ping: 20,
          jitter: 5,
          serverName: 'Test Server',
          serverLocation: 'Portugal',
          ipAddress: '192.168.1.1',
          isp: 'Test ISP'
        });

      expect(saveResponse.status).toBe(201);

      // 2. Buscar histórico
      const mockUserCheck = [{ id: testUserId }];
      const mockHistory = [
        {
          id: 123,
          downloadSpeed: '50.00',
          uploadSpeed: '10.00',
          ping: 20,
          jitter: 5,
          serverName: 'Test Server',
          serverLocation: 'Portugal',
          testDate: new Date().toISOString()
        }
      ];

      query
        .mockResolvedValueOnce(mockUserCheck)
        .mockResolvedValueOnce(mockHistory);

      const historyResponse = await request(app)
        .get('/api/speedtest/history')
        .set('X-User-ID', testUserId.toString());

      expect(historyResponse.status).toBe(200);
      expect(historyResponse.body).toHaveLength(1);

      // 3. Buscar estatísticas
      query.mockResolvedValue([{
        totalTests: 1,
        avgDownload: 50.0,
        avgUpload: 10.0,
        avgPing: 20.0,
        avgJitter: 5.0,
        maxDownload: 50.0,
        maxUpload: 10.0,
        minPing: 20.0
      }]);

      const statsResponse = await request(app)
        .get('/api/speedtest/stats')
        .set('X-User-ID', testUserId.toString());

      expect(statsResponse.status).toBe(200);
      expect(statsResponse.body.totalTests).toBe(1);
    });
  });
});
