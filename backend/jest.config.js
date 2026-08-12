// EP-19 (Calidad y pruebas): config minima — no existia ninguna, "npm test"
// corria con --passWithNoTests porque no habia ni un solo *.spec.ts en todo
// el repo. Preset estandar de NestJS con ts-jest.
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
