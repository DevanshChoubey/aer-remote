import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

import { createFakeTransport } from '@/ble/testing/fakeDispenser';
import { createServices } from '@/core/createServices';
import { ServicesProvider, useServices, type Services } from '@/core/services';
import { createMemoryStore } from '@/store/memoryStore';

// createServices imports AsyncStorage for its default store; the tests inject a memory store.
jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function Probe({ onServices }: { onServices: (s: Services) => void }): null {
  onServices(useServices());
  return null;
}

describe('services', () => {
  it('useServices throws outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => {
      act(() => {
        TestRenderer.create(<Probe onServices={() => undefined} />);
      });
    }).toThrow(/ServicesProvider/);
    spy.mockRestore();
  });

  it('useServices returns the injected services inside the provider', () => {
    const services = createServices({
      transport: createFakeTransport({}),
      store: createMemoryStore(),
    });
    let seen: Services | null = null;
    act(() => {
      TestRenderer.create(
        <ServicesProvider services={services}>
          <Probe onServices={(s) => (seen = s)} />
        </ServicesProvider>,
      );
    });
    expect(seen).toBe(services);
  });
});
