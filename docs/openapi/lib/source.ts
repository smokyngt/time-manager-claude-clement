import { loader } from 'fumadocs-core/source';
import { openapiPlugin } from 'fumadocs-openapi/server';

import { docs } from 'collections/server';

export const source = loader({
  baseUrl: '/',
  plugins: [openapiPlugin()],
  source: docs.toFumadocsSource(),
});
