'use client';

import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

export default function SwaggerExplorer() {
  return (
    <SwaggerUI
      url="/openapi.json"
      deepLinking
      displayOperationId
      displayRequestDuration
      filter
      tryItOutEnabled
      supportedSubmitMethods={['get']}
      defaultModelsExpandDepth={1}
      docExpansion="list"
    />
  );
}
