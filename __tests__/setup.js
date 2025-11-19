// Silenciar logs durante os testes para reduzir ruído
process.env.NODE_ENV = 'test';

// Mock console methods para limpar output dos testes
const originalConsole = { ...console };

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
  console.info = jest.fn();
});

afterAll(() => {
  // Restaurar console original após os testes
  Object.assign(console, originalConsole);
});
