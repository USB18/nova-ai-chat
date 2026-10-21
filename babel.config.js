module.exports = api => {
  const isTest = api.env('test');
  return {
    presets: ['module:@react-native/babel-preset'],
    plugins: [
      [
        'module:react-native-dotenv',
        {
          moduleName: '@env',
          // Tests never see the real key, so they can't hit the network with it.
          path: isTest ? '.env.example' : '.env',
          safe: false,
          allowUndefined: true,
        },
      ],
    ],
  };
};
