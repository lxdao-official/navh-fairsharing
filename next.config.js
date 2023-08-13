/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (
    webpackConfig,
    { buildId, dev, isServer, defaultLoaders, webpack }
  ) => {
    // Important: return the modified config
    webpackConfig.resolve.fallback = {
      crypto: require.resolve('crypto-browserify'),
      stream: require.resolve('stream-browserify'),
    }

    webpackConfig.plugins.push(
      new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
      })
    )
    return webpackConfig
  },
}

module.exports = nextConfig