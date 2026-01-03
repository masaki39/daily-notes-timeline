/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
	preset: 'ts-jest',
	testEnvironment: 'node',
	clearMocks: true,
	roots: ['<rootDir>/tests'],
	moduleFileExtensions: ['ts', 'js', 'json'],
	moduleNameMapper: {
		'^obsidian$': '<rootDir>/__mocks__/obsidian.ts',
		'^electron$': '<rootDir>/__mocks__/electron.ts'
	}
};
