import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders the empty chat screen', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer | undefined;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  const texts = tree!.root
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children);
  expect(texts).toContain('How can I help?');
  await ReactTestRenderer.act(async () => tree!.unmount());
}, 30_000);
