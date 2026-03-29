module.exports = function (api) {
  const isTest = api.env('test');

  return {
    presets: [
      [
        '@babel/preset-env',
        isTest
          ? { targets: { node: 'current' } }
          : { modules: false },
      ],
      ['@babel/preset-react', { runtime: 'automatic' }],
      ['@babel/preset-typescript'],
    ],
  };
};
