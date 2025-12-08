import { defineCliConfig } from 'sanity/cli';

export default defineCliConfig({
  api: {
    projectId: 'i4wz0fvl',
    dataset: 'production',
  },
  studioHost: 'setlists-blog',
  deployment: {
    appId: 'goqpwr5vnp2p22o03pqn0ow4',
    autoUpdates: true,
  },
});

