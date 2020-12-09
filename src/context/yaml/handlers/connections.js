import path from 'path';
import fs from 'fs-extra';
import { constants } from 'auth0-source-control-extension-tools';

import log from '../../../logger';
import { isFile, sanitize, ensureProp } from '../../../utils';

async function parse(context) {
  // Load the HTML file for email connections

  const { connections } = context.assets;
  const connectionsFolder = path.join(context.basePath, constants.CONNECTIONS_DIRECTORY);

  if (!connections || !connections.length) {
    return { connections: context.assets.connections };
  }

  return {
    connections: [
      ...connections.map((connection) => {
        if (connection.strategy === 'email') {
          ensureProp(connection, 'options.email.body');
          const htmlFileName = path.join(connectionsFolder, connection.options.email.body);

          if (isFile(htmlFileName)) {
            connection.options.email.body = context.loadFile(htmlFileName);
          }
        }

        return connection;
      })
    ]
  };
}

const convertClientIdToName = (clientId, clients) => {
  const found = clients.find(c => c.client_id === clientId);
  return (found && found.name) || clientId;
};

const getFormattedOptions = (connection, clients) => {
  try {
    return {
      options: {
        ...connection.options,
        idpinitiated: {
          ...connection.options.idpinitiated,
          client_id: convertClientIdToName(
            connection.options.idpinitiated.client_id,
            clients
          )
        }
      }
    };
  } catch (e) {
    return {};
  }
};

async function dump(context) {
  const { connections } = context.assets;


  // Nothing to do
  if (!connections) return {};

  const clients = context.assets.clients || [];

  // nothing to do, set default if empty
  return {
    connections: connections.map((connection) => {
      const dumpedConnection = {
        ...connection,
        ...getFormattedOptions(connection, clients),
        enabled_clients: [
          ...(connection.enabled_clients || []).map(clientNameOrId => convertClientIdToName(clientNameOrId, clients))
        ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
      };

      if (dumpedConnection.strategy === 'email') {
        ensureProp(connection, 'options.email.body');
        const connectionsFolder = path.join(context.basePath, constants.CONNECTIONS_DIRECTORY);
        const connectionName = sanitize(dumpedConnection.name);
        const html = dumpedConnection.options.email.body;
        const emailConnectionHtml = path.join(connectionsFolder, `${connectionName}.html`);

        log.info(`Writing ${emailConnectionHtml}`);
        fs.ensureDirSync(connectionsFolder);
        fs.writeFileSync(emailConnectionHtml, html);

        dumpedConnection.options.email.body = `./${connectionName}.html`;
      }

      return dumpedConnection;
    })
  };
}


export default {
  parse,
  dump
};
