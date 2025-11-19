const { saveTestResult, getTestHistory, getTestStats } = require('../controllers/speedTestController');

// Mock do banco de dados
jest.mock('../db/database', () => ({
  query: jest.fn(),
  run: jest.fn()
}));

const { query, run } = require('../db/database');

describe('SpeedTestController', () => {
  let mockReq, mockRes;

  beforeEach(() => {
    mockReq = {
      user: { id: 1 },
      body: {},
      query: {}
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('saveTestResult', () => {
    it('deve salvar resultado do teste com sucesso', async () => {
      const testData = {
        downloadSpeed: 50000000, // 50 Mbps em bps
        uploadSpeed: 10000000,   // 10 Mbps em bps
        ping: 20,
        jitter: 5,
        serverName: 'Test Server',
        serverLocation: 'Portugal',
        ipAddress: '192.168.1.1',
        isp: 'Test ISP'
      };

      mockReq.body = testData;
      run.mockResolvedValue({ lastID: 123 });

      await saveTestResult(mockReq, mockRes);

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO speed_tests'),
        [
          1, // userId
          '50.00', // downloadSpeedMbps
          '10.00', // uploadSpeedMbps
          20, // ping
          5, // jitter
          'Test Server', // serverName
          'Portugal', // serverLocation
          '192.168.1.1', // ipAddress
          'Test ISP' // isp
        ]
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        testId: 123
      });
    });

    it('deve retornar erro se campos obrigatórios estiverem faltando', async () => {
      mockReq.body = {
        downloadSpeed: 50000000,
        uploadSpeed: 10000000
        // ping faltando
      };

      await saveTestResult(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Missing required fields'
      });
    });

    it('deve lidar com valores nulos opcionais', async () => {
      const testData = {
        downloadSpeed: 50000000,
        uploadSpeed: 10000000,
        ping: 20
      };

      mockReq.body = testData;
      run.mockResolvedValue({ lastID: 456 });

      await saveTestResult(mockReq, mockRes);

      expect(run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO speed_tests'),
        [1, '50.00', '10.00', 20, null, null, null, null, null]
      );
    });

    it('deve lidar com erro do banco de dados', async () => {
      mockReq.body = {
        downloadSpeed: 50000000,
        uploadSpeed: 10000000,
        ping: 20
      };

      run.mockRejectedValue(new Error('Database error'));

      await saveTestResult(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to save test result'
      });
    });
  });

  describe('getTestHistory', () => {
    it('deve retornar histórico de testes com sucesso', async () => {
      const mockUserCheck = [{ id: 1 }];
      const mockHistory = [
        {
          id: 1,
          downloadSpeed: '50.00',
          uploadSpeed: '10.00',
          ping: 20,
          jitter: 5,
          serverName: 'Test Server',
          serverLocation: 'Brazil',
          testDate: new Date('2023-01-01T12:00:00.000Z')
        }
      ];

      query
        .mockResolvedValueOnce(mockUserCheck) // Primeira chamada: verificar usuário
        .mockResolvedValueOnce(mockHistory);   // Segunda chamada: buscar histórico

      await getTestHistory(mockReq, mockRes);

      expect(query).toHaveBeenCalledTimes(2);
      expect(query).toHaveBeenCalledWith(
        'SELECT id FROM users WHERE id = ?',
        [1]
      );
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 1,
            downloadSpeed: '50.00',
            uploadSpeed: '10.00'
          })
        ])
      );
    });

    it('deve retornar erro 401 se usuário não estiver autenticado', async () => {
      mockReq.user = null;

      await getTestHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Usuário não autenticado'
      });
    });

    it('deve retornar erro 404 se usuário não for encontrado', async () => {
      query.mockResolvedValue([]); // Usuário não encontrado

      await getTestHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Usuário não encontrado'
      });
    });

    it('deve lidar com erro ao buscar histórico', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await getTestHistory(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Falha ao carregar o histórico de testes'
      });
    });

    it('deve respeitar o parâmetro limit', async () => {
      const mockUserCheck = [{ id: 1 }];
      const mockHistory = [];

      query
        .mockResolvedValueOnce(mockUserCheck)
        .mockResolvedValueOnce(mockHistory);

      mockReq.query.limit = '5';

      await getTestHistory(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT ?'),
        [1, 5]
      );
    });
  });

  describe('getTestStats', () => {
    it('deve retornar estatísticas com sucesso', async () => {
      const mockStats = {
        totalTests: 10,
        avgDownload: 45.5,
        avgUpload: 12.3,
        avgPing: 25.0,
        avgJitter: 3.2,
        maxDownload: 80.0,
        maxUpload: 25.0,
        minPing: 15.0
      };

      query.mockResolvedValue([mockStats]);

      await getTestStats(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('COUNT(*)'),
        [1, 30] // userId, days (default 30)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
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

      mockReq.query.days = '7';

      await getTestStats(mockReq, mockRes);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DATE_SUB(NOW(), INTERVAL ? DAY)'),
        [1, 7]
      );
    });

    it('deve lidar com valores nulos nas estatísticas', async () => {
      const mockStats = {
        totalTests: 0,
        avgDownload: null,
        avgUpload: null,
        avgPing: null,
        avgJitter: null,
        maxDownload: null,
        maxUpload: null,
        minPing: null
      };

      query.mockResolvedValue([mockStats]);

      await getTestStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        totalTests: 0,
        avgDownload: null,
        avgUpload: null,
        avgPing: null,
        avgJitter: null,
        maxDownload: null,
        maxUpload: null,
        minPing: null
      });
    });

    it('deve lidar com erro ao buscar estatísticas', async () => {
      query.mockRejectedValue(new Error('Database error'));

      await getTestStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Failed to fetch test statistics'
      });
    });
  });
});
