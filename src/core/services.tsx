import React, { createContext, useContext } from 'react';

import type { Alerts } from '@/alerts';
import type { DispenserClient } from '@/device/client';
import type { DispenserStore } from '@/store/types';

export interface Services {
  alerts: Alerts;
  client: DispenserClient;
  store: DispenserStore;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider(props: {
  services: Services;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>
  );
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('useServices must be used inside a ServicesProvider');
  return services;
}
