const MomentTimezoneDataPlugin = require('moment-timezone-data-webpack-plugin');
const currentYear = new Date().getFullYear();
const webpack = require('webpack');


module.exports = function override(config) {
    if (!config.plugins) {
        config.plugins = [];
    }

    let loaders = config.resolve
    loaders.fallback = {
        ...config.resolve.fallback,
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify")
    }

    config.plugins.push(
        // To include only specific zones, use the matchZones option
        new MomentTimezoneDataPlugin({
            matchZones: [
                /Europe\/(London|Vienna|Brussels|Paris|Berlin|Amsterdam|Sofia|Athens|Bucharest|Moscow|Tbilisi)/,
                /Asia\/(Beirut|Istanbul|Tehran|Dubai|Kabul|Islamabad|Delhi|Kathmandu|Bishkek|Yangon|Bangkok|Hong_Kong|Tokyo|Vladivostok|Magadan|Anadyr)/
            ]
        }),

        // To keep all zones but limit data to specific years, use the year range options
        new MomentTimezoneDataPlugin({
            startYear: currentYear - 2,
            endYear: currentYear + 5,
        }),

        new webpack.ProvidePlugin({
            process: 'process/browser.js',
            Buffer: ['buffer', 'Buffer']
        })

    );
    return config;
};
