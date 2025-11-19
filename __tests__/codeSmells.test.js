const fs = require('fs');
const path = require('path');

describe('Code Smells Detection', () => {
  const controllersPath = path.join(__dirname, '../controllers');
  const routesPath = path.join(__dirname, '../routes');
  const dbPath = path.join(__dirname, '../db');

  describe('Controller Code Smells', () => {
    let speedTestControllerContent;

    beforeAll(() => {
      const controllerFile = path.join(controllersPath, 'speedTestController.js');
      speedTestControllerContent = fs.readFileSync(controllerFile, 'utf8');
    });

    it('não deve ter funções muito longas (>50 linhas)', () => {
      const functions = speedTestControllerContent.match(/async\s+\w+\s*\([^)]*\)\s*{/g) || [];
      
      functions.forEach(func => {
        const funcStart = speedTestControllerContent.indexOf(func);
        const funcBody = speedTestControllerContent.substring(funcStart);
        const lines = funcBody.split('\n').slice(0, 52); // Pegar até 50 linhas + margem
        
        if (lines.length > 50) {
          console.warn(`Função muito longa detectada: ${func}`);
        }
        
        expect(lines.length).toBeLessThanOrEqual(50);
      });
    });

    it('não deve ter complexidade ciclomática alta', () => {
      // Contar estruturas de controle
      const ifCount = (speedTestControllerContent.match(/if\s*\(/g) || []).length;
      const tryCount = (speedTestControllerContent.match(/try\s*{/g) || []).length;
      const catchCount = (speedTestControllerContent.match(/catch\s*\(/g) || []).length;
      const forCount = (speedTestControllerContent.match(/for\s*\(/g) || []).length;
      const whileCount = (speedTestControllerContent.match(/while\s*\(/g) || []).length;
      
      const complexity = ifCount + tryCount + catchCount + forCount + whileCount;
      
      console.log(`Complexidade ciclomática: ${complexity}`);
      expect(complexity).toBeLessThan(10); // Limite razoável
    });

    it('não deve ter parâmetros demais (>5)', () => {
      const functions = speedTestControllerContent.match(/\w+\s*\([^)]*\)/g) || [];
      
      functions.forEach(func => {
        const params = func.match(/([^,()]+)/g) || [];
        if (params.length > 6) { // +1 por causa do nome da função
          console.warn(`Função com muitos parâmetros: ${func}`);
        }
        expect(params.length - 1).toBeLessThanOrEqual(5);
      });
    });

    it('não deve ter strings duplicadas (magic strings)', () => {
      const strings = speedTestControllerContent.match(/'[^']*'/g) || [];
      const stringCounts = {};
      
      strings.forEach(str => {
        stringCounts[str] = (stringCounts[str] || 0) + 1;
      });
      
      const duplicates = Object.entries(stringCounts)
        .filter(([str, count]) => count > 2 && str.length > 5); // Ignorar strings pequenas
      
      if (duplicates.length > 0) {
        console.warn('Strings duplicadas encontradas:', duplicates.slice(0, 5));
      }
      
      expect(duplicates.length).toBeLessThan(3);
    });

    it('não deve ter números mágicos', () => {
      // Procurar números que não sejam 0, 1, -1
      const magicNumbers = speedTestControllerContent.match(/\b(?!0|1|-1)\d{2,}\b/g) || [];
      
      if (magicNumbers.length > 0) {
        console.warn('Números mágicos encontrados:', magicNumbers.slice(0, 5));
      }
      
      // Permitir alguns números específicos como limites
      const allowedNumbers = ['10', '30', '50'];
      const problematicNumbers = magicNumbers.filter(num => !allowedNumbers.includes(num));
      
      expect(problematicNumbers.length).toBeLessThan(3);
    });
  });

  describe('Database Code Smells', () => {
    let databaseContent;

    beforeAll(() => {
      const dbFile = path.join(dbPath, 'database.js');
      databaseContent = fs.readFileSync(dbFile, 'utf8');
    });

    it('não deve ter queries SQL inline sem parâmetros', () => {
      // Procurar queries com concatenação de strings
      const inlineQueries = databaseContent.match(/query\s*\(\s*['"`][^'"`]*\+/g) || [];
      
      if (inlineQueries.length > 0) {
        console.warn('Queries inline encontradas:', inlineQueries);
      }
      
      expect(inlineQueries.length).toBe(0);
    });

    it('não deve ter credenciais hardcoded', () => {
      // Procurar senhas ou chaves no código
      const hasPassword = databaseContent.includes('password:') && 
                        !databaseContent.includes('process.env.DB_PASSWORD');
      const hasSecret = databaseContent.includes('secret') && 
                       !databaseContent.includes('process.env');
      
      if (hasPassword) {
        console.warn('Possível senha hardcoded encontrada');
      }
      
      expect(hasPassword).toBe(false);
    });
  });

  describe('General Code Quality', () => {
    let allFiles;

    beforeAll(() => {
      const allFilePaths = [
        ...fs.readdirSync(controllersPath).map(f => path.join(controllersPath, f)),
        ...fs.readdirSync(routesPath).map(f => path.join(routesPath, f)),
        ...fs.readdirSync(dbPath).map(f => path.join(dbPath, f))
      ].filter(file => file.endsWith('.js'));
      
      allFiles = allFilePaths.map(file => ({
        path: file,
        content: fs.readFileSync(file, 'utf8')
      }));
    });

    it('não deve ter console.log em produção', () => {
      allFiles.forEach(({ path, content }) => {
        const consoleLogs = content.match(/console\.(log|warn|error)\(/g) || [];
        
        // Permitir em arquivos de teste
        if (!path.includes('__tests__') && consoleLogs.length > 5) {
          console.warn(`Muitos console.log em ${path}: ${consoleLogs.length}`);
        }
        
        // Permitir alguns logs de erro importantes
        const importantLogs = content.match(/console\.error\s*\(\s*['"`]Error|Failed['"`]/g) || [];
        const otherLogs = consoleLogs.length - importantLogs.length;
        
        expect(otherLogs).toBeLessThan(3);
      });
    });

    it('não deve ter funções aninhadas profundamente (>3 níveis)', () => {
      allFiles.forEach(({ path, content }) => {
        const lines = content.split('\n');
        let maxDepth = 0;
        let currentDepth = 0;
        
        lines.forEach(line => {
          const opens = (line.match(/{/g) || []).length;
          const closes = (line.match(/}/g) || []).length;
          
          currentDepth += opens - closes;
          maxDepth = Math.max(maxDepth, currentDepth);
        });
        
        if (maxDepth > 4) {
          console.warn(`Aninhamento profundo em ${path}: ${maxDepth} níveis`);
        }
        
        expect(maxDepth).toBeLessThan(5);
      });
    });

    it('deve ter tratamento de erros adequado', () => {
      allFiles.forEach(({ path, content }) => {
        const asyncFunctions = content.match(/async\s+\w+\s*\([^)]*\)/g) || [];
        
        asyncFunctions.forEach(func => {
          const funcStart = content.indexOf(func);
          const funcEnd = content.indexOf('}', funcStart + 100);
          const funcBody = content.substring(funcStart, funcEnd);
          
          // Verificar se tem try/catch ou .catch()
          const hasTryCatch = funcBody.includes('try') && funcBody.includes('catch');
          const hasCatch = funcBody.includes('.catch(');
          
          if (!hasTryCatch && !hasCatch && funcBody.includes('await')) {
            console.warn(`Função async sem tratamento de erros em ${path}: ${func}`);
          }
        });
      });
    });

    it('não deve ter código comentado', () => {
      allFiles.forEach(({ path, content }) => {
        const commentedCode = content.match(/\/\/.*(?:console|return|if|for|while)/g) || [];
        const multilineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
        
        if (commentedCode.length > 3) {
          console.warn(`Código comentado encontrado em ${path}: ${commentedCode.length} linhas`);
        }
        
        expect(commentedCode.length).toBeLessThan(5);
        expect(multilineComments.length).toBeLessThan(2);
      });
    });

    it('deve ter nomes descritivos', () => {
      allFiles.forEach(({ path, content }) => {
        const variables = content.match(/(?:let|const|var)\s+(\w+)/g) || [];
        const functions = content.match(/(?:function\s+|async\s+)(\w+)\s*\(/g) || [];
        
        const badNames = [...variables, ...functions]
          .map(match => match.split(/\s+/)[1] || match.split(/\s+/)[2])
          .filter(name => name && name.length < 3 && name !== 'id' && name !== 'db' && name !== 'if');
        
        if (badNames.length > 0) {
          console.warn(`Nomes pouco descritivos em ${path}:`, [...new Set(badNames)].slice(0, 3));
        }
        
        expect(badNames.length).toBeLessThan(3);
      });
    });
  });

  describe('Performance Code Smells', () => {
    it('não deve ter loops aninhados', () => {
      const allFilePaths = [
        ...fs.readdirSync(controllersPath).map(f => path.join(controllersPath, f)),
        ...fs.readdirSync(routesPath).map(f => path.join(routesPath, f))
      ].filter(file => file.endsWith('.js'));
      
      allFilePaths.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const nestedLoops = content.match(/for\s*\([^)]*\)[^{]*{[^}]*for\s*\(/g) || [];
        
        if (nestedLoops.length > 0) {
          console.warn(`Loops aninhados em ${file}`);
        }
        
        expect(nestedLoops.length).toBe(0);
      });
    });

    it('não deve ter operações síncronas bloqueantes', () => {
      const allFilePaths = [
        ...fs.readdirSync(controllersPath).map(f => path.join(controllersPath, f)),
        ...fs.readdirSync(routesPath).map(f => path.join(routesPath, f))
      ].filter(file => file.endsWith('.js'));
      
      allFilePaths.forEach(file => {
        const content = fs.readFileSync(file, 'utf8');
        const syncOperations = content.match(/fs\.|require\(|process\.cwd\(\)/g) || [];
        
        const blockingOps = syncOperations.filter(op => 
          op.includes('fs.') && !op.includes('Sync')
        );
        
        if (blockingOps.length > 2) {
          console.warn(`Possíveis operações bloqueantes em ${file}:`, blockingOps);
        }
        
        expect(blockingOps.length).toBeLessThan(3);
      });
    });
  });
});
