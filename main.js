/**
 *
 *      ioBroker iobmqtt Adapter
 *
 *      (c) 2014-2020 bluefox
 *
 *      MIT License
 *
 */
'use strict';

const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const adapterName = require('./package.json').name.split('.').pop();
let adapter;

let client = null;
let states = {};

const messageboxRegex = new RegExp('\.messagebox$');

function decrypt(key, value) {
    let result = '';
    for (let i = 0; i < value.length; ++i) {
        result += String.fromCharCode(key[i % key.length].charCodeAt(0) ^ value.charCodeAt(i));
    }
    return result;
}

function startAdapter(options) {
    options = options || {};
    Object.assign(options, {name: adapterName});

    adapter = new utils.Adapter(options);

    adapter.on('message', function (obj) {
        if (obj) processMessage(obj);
    });

    adapter.on('ready', () => {
        adapter.config.pass = decrypt('Zgfr56gFe87jJOM', adapter.config.pass);
        adapter.config.maxTopicLength = adapter.config.maxTopicLength || 100;

        // Start
        main();
    });

    adapter.on('unload', () => {
        adapter.log.debug('main.on BeforeUnloadEvent, destroy ...');

        client && client.destroy();
    });

    // is called if a subscribed local state changes
    adapter.on('stateChange', (id, state) => {
        adapter.log.debug('main.adapter.on.stateChange "' + id + '": ' + JSON.stringify(state));

        if (!state) {
            // State deleted
            adapter.log.debug('main.adapter.on.stateChange, state deleted "' + id + '": ' + JSON.stringify(state));

            delete states[id];

            // if CLIENT
            if (client) client.onStateChange(id);
        } else
        // you can use the ack flag to detect if state is desired or acknowledged (erwünscht oder anerkannt)
        // sendAckToo == TRUE -> dann wird immer auf geänderten Wert/ack geprüft, d. h. auch Werte mit ack == TRUE werden an Broker gesendet
        // == FALSE --> dann muss ack des state == FALSE sein um den Wert an den Broker zu senden, ignoriert also (Wert-) Änderungen mit ack == TRUE
        // --> gibt es Adapter, die ihren Wert gleich mit ack == TRUE setzen??
        // --> da hätte ich eher erwartet, dass bei sendAckToo == FALSE ack-Änderungen ignoriert werden

   //!O!if ((adapter.config.sendAckToo || !state.ack) && !messageboxRegex.test(id)) {
            // (adapter.config.sendAckToo == TRUE || state.ack == FALSE) && id != *.messagebox$
            // adapter.config.sendAckToo --> Wenn TRUE, dann immer auf Änderung prüfen
            //                           --> Wenn FALSE, dann nur weiter prüfen, wenn state.ack == FALSE
        if ((!adapter.config.sendAckToo || (adapter.config.sendAckToo && state.ack))  && !messageboxRegex.test(id)) {
            // adapter.config.sendAckToo == TRUE && stae.ack == TRUE --> anerkannter state von einem Adapter
            // adapter.config.sendAckToo == FALSE --> ack ist egal, nur Änderung state wichtig

            // get "old" values from cache
            const oldVal = states[id] ? states[id].state.val : null;
            const oldAck = states[id] ? states[id].state.ack : null;
            const oldTS = states[id] ? states[id].state.ts : null;

            states[id].state = state;
            adapter.log.debug('main.adapter.on.stateChange, oldVal "' + oldVal + '", oldAck: ' + oldAck + ', state.val "' + state.val + '", state.ack: ' + state.ack);

            // If value really changed
            if ((oldVal && oldVal !== state.val) || (oldAck && oldAck !== state.ack) || (oldTS && oldTS != state.ts)) {
                // immer senden || Wert geändert || ack geändert
                // immer senden - da muss es ja vorher eine Änderung am State gegeben haben, 

                // if CLIENT
                client && client.onStateChange(id, state);
            } else {
                adapter.log.debug('main.adapter.on.stateChange, no change detcted (no action required) "' + id + '": ' + JSON.stringify(state));
            }
        } else {
            adapter.log.debug('main.adapter.on.stateChange, sendAckToo: ' +  adapter.config.sendAckToo + ', state.ack: ' + state.ack + ' (no action required) "' + id + '": ' + JSON.stringify(state));
        }
    });
    return adapter;
}


function processMessage(obj) {
    if (!obj || !obj.command) return;
    
    adapter.log.debug('main.processMessage started with obj: ' + JSON.stringify(obj));

    switch (obj.command) {
        case 'sendMessage2Client':
            if (client) {
                adapter.log.debug('Sending message from client to broker via topic ' + obj.message.topic + ': ' + obj.message.message + ' ...');

                client.onMessage(obj.message.id, obj.message.topic, obj.message.message);
            } else {
                adapter.log.debug('MQTT client not started, thus not sending message via topic ' + obj.message.topic + ' (' + obj.message.message + ').');
            }
            break;

        case 'sendState2Client':
            if (client) {
                adapter.log.debug('Sending message from client to broker ' + obj.message.id + ': ' + obj.message.state + ' ...');

                client.onStateChange(obj.message.id, obj.message.state);
            } else {
                adapter.log.debug('MQTT client not started, thus not sending message to client ' + obj.message.id + ' (' + obj.message.state + ').');
            }
            break;

        case 'test': {
            // Try to connect to mqtt broker
            if (obj.callback && obj.message) {
                const mqtt = require('mqtt');
                const _url = 'mqtt://' + (obj.message.user ? (obj.message.user + ':' + obj.message.pass + '@') : '') + obj.message.url + (obj.message.port ? (':' + obj.message.port) : '') + '?clientId=ioBroker.' + adapter.namespace;
                const _client = mqtt.connect(_url);
                // Set timeout for connection
                const timeout = setTimeout(() => {
                    _client.end();
                    adapter.sendTo(obj.from, obj.command, 'timeout', obj.callback);
                }, 2000);

                // If connected, return success
                _client.on('connect', () => {
                    _client.end();
                    clearTimeout(timeout);
                    adapter.sendTo(obj.from, obj.command, 'connected', obj.callback);
                });
                // If connected, return success
                _client.on('error', (err) => {
                    _client.end();
                    clearTimeout(timeout);
                    adapter.log.warn('Error on mqtt test: ' + err)
                    adapter.sendTo(obj.from, obj.command, 'error', obj.callback);
                });
            }
        }
    }
} // processMessage()


let cnt = 0;
function readStatesForPattern(item) {
    // {"mask":"javascript.0.system.event_logs.*","QoS":"","retain":false,"enabled":false}
    
    adapter.log.debug('main.readStatesForPattern "' + item.mask + '" ...');
    let qos = (item.QoS && (parseInt(item.QoS) >= 0  && parseInt(item.QoS) <=2) ? parseInt(item.QoS) : adapter.config.defaultQoS_publish);
    let retain = (item.retain ? parseBool(item.retain) : (item.retain && parseBool(item.retain) == false ? false : adapter.config.retain));


    adapter.getForeignStates(item.mask, (err, res) => {
        adapter.log.debug('main.readStatesForPattern "' + item.mask + '", res: ' + JSON.stringify(res));

        if (err) {
            adapter.log.error('main.readStatesForPattern, error: ' + JSON.stringify(err));

            return;
        }

        if (!err && res) {
            states = states || {};

            Object.keys(res).filter(id => !messageboxRegex.test(id))
                .forEach((id) => {
                    states[id] = {};
                    states[id].state = res[id];
                    states[id].qos = qos;
                    states[id].retain = retain;
            });
        }

        // If all patters answered, start client
        if (!--cnt) {
            adapter.log.debug('main.readStatesForPattern, states: ' + JSON.stringify(states));

            adapter.log.debug('main.readStatesForPattern >> starting client ...');

            client = new require('./lib/client')(adapter, states);
        }
    });
} // readStatesForPattern()


function main() {
    adapter.config.keepalive_s = parseInt(adapter.config.keepalive_s, 10) || 10;
    adapter.config.reconnectPeriod = parseInt(adapter.config.reconnectPeriod, 10) || 1000;
    adapter.config.connectTimeout = parseInt(adapter.config.connectTimeout, 10) || 30;
    adapter.config.maxTopicLength = parseInt(adapter.config.maxTopicLength, 10) || 150;
    adapter.config.ioBrokerMessageFormatCompressFromLength = parseInt(adapter.config.ioBrokerMessageFormatCompressFromLength, 10) || 0;

    adapter.config.sendAckToo = adapter.config.sendAckToo === 'true' || adapter.config.sendAckToo === true;
    adapter.config.saveOnChange = adapter.config.saveOnChange === 'true' || adapter.config.saveOnChange === true;
    adapter.config.ioBrokerMessageFormatActive = adapter.config.ioBrokerMessageFormatActive === 'true' || adapter.config.ioBrokerMessageFormatActive === true;
    adapter.config.ioBrokerMessageFormatIgnoreOwnMsg = adapter.config.ioBrokerMessageFormatIgnoreOwnMsg === 'true' || adapter.config.ioBrokerMessageFormatIgnoreOwnMsg === true;
    adapter.config.ioBrokerMessageFormatIgnoreOther = adapter.config.ioBrokerMessageFormatIgnoreOther === 'true' || adapter.config.ioBrokerMessageFormatIgnoreOther === true;

    adapter.log.debug('adapter.config.keepalive_s: ' + adapter.config.keepalive_s);
    adapter.log.debug('adapter.config.reconnectPeriod: ' + adapter.config.reconnectPeriod);
    adapter.log.debug('adapter.config.connectTimeout: ' + adapter.config.connectTimeout);
    adapter.log.debug('adapter.config.saveOnChange: ' + adapter.config.saveOnChange);
    adapter.log.debug('adapter.config.sendAckToo: ' + adapter.config.sendAckToo);
    adapter.log.debug('adapter.config.publish: ' + JSON.stringify(adapter.config.publish));
    adapter.log.debug('adapter.config.patterns: ' + JSON.stringify(adapter.config.patterns));
    
    adapter.log.debug('adapter.config.maxTopicLength: ' + adapter.config.maxTopicLength);
    adapter.log.debug('adapter.config.ioBrokerMessageFormatActive: ' + adapter.config.ioBrokerMessageFormatActive);
    adapter.log.debug('adapter.config.ioBrokerMessageFormatIgnoreOwnMsg: ' + adapter.config.ioBrokerMessageFormatIgnoreOwnMsg);
    adapter.log.debug('adapter.config.ioBrokerMessageFormatIgnoreOther: ' + adapter.config.ioBrokerMessageFormatIgnoreOther);
    adapter.log.debug('adapter.config.CheckNamespaceDeepInObjecttreeTo: ' + adapter.config.CheckNamespaceDeepInObjecttreeTo); + ' (default = 2)';
    adapter.log.debug('adapter.config.ioBrokerMessageFormatCompressFromLength: ' + adapter.config.ioBrokerMessageFormatCompressFromLength) + ' (default = 100)';

    // check parameter plausibility
    if (adapter.config.CheckNamespaceDeepInObjecttreeTo < 2) adapter.config.CheckNamespaceDeepInObjecttreeTo = 2;
    if (adapter.config.ioBrokerMessageFormatCompressFromLength < 100) adapter.config.ioBrokerMessageFormatCompressFromLength = 100;
    
    adapter.config.defaultQoS_subscribe = parseInt(adapter.config.defaultQoS_subscribe, 10) || 0;
    adapter.config.defaultQoS_publish = parseInt(adapter.config.defaultQoS_publish, 10) || 0;
    adapter.config.retain = adapter.config.retain === 'true' || adapter.config.retain === true;
    adapter.config.persistent = adapter.config.persistent === 'true' || adapter.config.persistent === true;

    if (adapter.config.clientId === '') {
        adapter.log.error('No ClientID configured, please check konfiguration!');

        return;
    }


    // Subscribe on own variables to publish it
    if (adapter.config.publish && adapter.config.publish != '') {
        // [{"mask":"javascript.0.system.event_logs.*","QoS":"","retain":false,"enabled":false},{"mask":"logparser.0.*","QoS":"1","retain":false,"enabled":true}]

        adapter.config.publish.forEach((item) => {
            if ((item) && item.enabled && item.mask && item.mas != '') {
                adapter.log.info('main.publish, topic: "' + item.mask.trim() + '"; QoS: "' + item.QoS + '"; enabled: "' + item.enabled + '"');

                try {
                    if (item.mask.indexOf('#') !== -1) {
                        adapter.log.warn('main.publish, sed MQTT notation for ioBroker id mask "' + item.mask + '": use "' + item.mask.replace(/#/g, '*') + ' notation');
                        item.mask = item.mask.replace(/#/g, '*');
                    }

                    adapter.subscribeForeignStates(item.mask.trim());
                    cnt++;
                    readStatesForPattern(item);
                } catch (err) {
                    adapter.log.error('main.publish, error on publish ' + JSON.stringify(item));
                }
            }
        });
    } else {
        adapter.log.info('main, no pattern for subscriptions configured!');
    }

    // If no subscription, start client
    if (!cnt) {
        adapter.log.debug('main >> starting client ...');

        client = new require(__dirname + '/lib/client')(adapter, states);
    }
}

// If started as allInOne/compact mode => return function to create instance
if (module && module.parent) {
    module.exports = startAdapter;
} else {
    // or start the instance directly
    startAdapter();
}
