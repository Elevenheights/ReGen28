module.exports = {
	root: true,
	env: {
		es6: true,
		node: true,
	},
	extends: [
		"eslint:recommended",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		project: ["tsconfig.json"],
		sourceType: "module",
		tsconfigRootDir: __dirname,
	},
	ignorePatterns: [
		"/lib/**/*", // Ignore built files.
		"/generated/**/*", // Ignore generated files.
		".eslintrc.js", // Ignore this config file itself
	],
	plugins: [
		"@typescript-eslint",
		"import",
	],
	rules: {
		"max-len": "off", // Disable line length rule
		"import/no-unresolved": 0,
		"indent": "off",
		"object-curly-spacing": "off",
		"@typescript-eslint/no-unused-vars": "warn",
		"no-unused-vars": "off",
	},
};
