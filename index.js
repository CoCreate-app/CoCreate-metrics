'use strict';

const metrics = require('./src/metrics');

module.exports.init = function(socket_server, db_client) {
    new metrics(socket_server, db_client);
}