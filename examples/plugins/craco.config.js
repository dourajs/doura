/* craco.config.js */
const path = require(`path`)

module.exports = {
	webpack: {
		alias: {
			react: path.resolve('node_modules/react'),
			'react-dom': path.resolve('node_modules/react-dom'),
		},
		configure: (webpackConfig) => {
			const scopePluginIndex = webpackConfig.resolve.plugins.findIndex(
				({ constructor }) =>
					constructor && constructor.name === 'ModuleScopePlugin'
			)

			webpackConfig.resolve.plugins.splice(scopePluginIndex, 1)
			return webpackConfig
		},
	},
}
