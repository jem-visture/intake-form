import serverModule from '../../server.js';

export default function handler(request, response) {
  return serverModule.requestHandler(request, response);
}
