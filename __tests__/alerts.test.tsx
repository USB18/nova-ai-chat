import React from 'react';
import { View } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import {
  AlertsOverlay,
  AlertsProvider,
  useAlerts,
} from '../src/components/alerts/Alerts';

type Api = ReturnType<typeof useAlerts>;

function Capture({ onApi }: { onApi: (api: Api) => void }) {
  onApi(useAlerts());
  return null;
}

async function setup(hosts = 1) {
  let api!: Api;
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <AlertsProvider>
        <Capture onApi={a => (api = a)} />
        {Array.from({ length: hosts }, (_, i) => (
          <View key={i} testID={`host-${i}`}>
            <AlertsOverlay topInset={0} />
          </View>
        ))}
      </AlertsProvider>,
    );
  });
  return { api: () => api, tree };
}

const texts = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root
    .findAll(n => typeof n.props.children === 'string')
    .map(n => n.props.children as string);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('shows a toast and hides it after its duration', async () => {
  const { api, tree } = await setup();
  await act(async () =>
    api().toast({ title: 'Voice', message: 'Oops', durationMs: 1000 }),
  );
  expect(texts(tree)).toEqual(expect.arrayContaining(['Voice', 'Oops']));
  await act(async () => jest.advanceTimersByTime(1000));
  expect(texts(tree)).not.toContain('Oops');
});

it('resolves confirm() with the chosen button', async () => {
  const { api, tree } = await setup();
  let result: Promise<boolean>;
  await act(async () => {
    result = api().confirm({ title: 'Clear?', confirmLabel: 'Clear' });
  });
  const clearBtn = tree.root.find(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.findAll(c => c.props.children === 'Clear').length > 0 &&
      typeof n.props.onPress === 'function',
  );
  await act(async () => clearBtn.props.onPress());
  await expect(result!).resolves.toBe(true);
  expect(texts(tree)).not.toContain('Clear?');
});

it('draws only in the most recently mounted host', async () => {
  const { api, tree } = await setup(2);
  await act(async () => api().toast({ message: 'Once' }));
  const inHost = (i: number) =>
    tree.root
      .findByProps({ testID: `host-${i}` })
      .findAll(n => n.props.children === 'Once').length;
  expect(inHost(0)).toBe(0);
  expect(inHost(1)).toBeGreaterThan(0);
});
