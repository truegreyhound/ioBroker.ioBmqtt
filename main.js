/**
 *
 *      ioBroker iobmqtt Adapter
 *
 *      (c) 2014-2020 bluefox
 *
 *      MIT License
 *
 */
/* jshint -W097 */
'use strict';

/* jshint node: true */

/*!P!

*/


const utils = require('@iobroker/adapter-core'); // Get common adapter utils
const adapterName = require('./package.json').name.split('.').pop();
const parseBool   = require('./lib/common').parseBool;

let adapter;

let client = null;
let states = {};        // cache for states
/*
    states[<id>]
        .common
        .native
        .state
        .state.val
        .state.ack
        .state.lc
        .qos        - 0|1|2
        .retain     - true|false
        .publishCommonNative
        .topic      - mqtt topic
        .type       - command or send without common and native: ''|<non>|???
*/


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
        adapter.log.info('onReady start -++*** iobmqtt ***++-');

        adapter.getForeignObject("system.config", (err, obj) => {
            if (obj && obj.native && obj.native.secret) {
                //noinspection JSUnresolvedVariable
                adapter.config.pass = decrypt(obj.native.secret, adapter.config.pass);
            } else {
                //noinspection JSUnresolvedVariable
                adapter.config.pass = decrypt("Zgfl56gFe87jJOM", adapter.config.pass);
            }
            //!D!adapter.log.debug('main.adapter.on.readym password: ' +JSON.stringify(adapter.config.pass));

            // Start
            main();
        });
    });

    
    adapter.on('unload', () => {
        adapter.log.debug('main.on BeforeUnloadEvent, destroy ...');

        if (client) client.destroy();
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
        } else if ((!adapter.config.sendAckOnly || (adapter.config.sendAckOnly && state.ack)) && !messageboxRegex.test(id)) {
            // adapter.config.sendAckOnly == TRUE && state.ack == TRUE --> anerkannter state von einem Adapter
            // adapter.config.sendAckOnly == FALSE --> ack ist egal, nur Änderung state, ack, lc wichtig

            // get "old" values from cache
            const oldVal = states[id] ? states[id].state.val : null;
            const oldAck = states[id] ? states[id].state.ack : null;
            const oldLC = states[id] ? states[id].state.lc : null;

            // cache state
            states[id].state = state;
            adapter.log.debug('main.adapter.on.stateChange, oldVal "' + oldVal + '", oldAck: ' + oldAck + ', state.val "' + state.val + '", state.ack: ' + state.ack);

            // If value really changed
            if ((oldVal && oldVal !== state.val) || (oldAck && oldAck !== state.ack) || (oldLC && oldLC != state.lc)) {
                // Wert geändert || ack geändert || lc geändert

                // send to CLIENT
                if (client) client.onStateChange(id, state);
            } else {
                adapter.log.debug('main.adapter.on.stateChange, no change detcted (no action required) "' + id + '": ' + JSON.stringify(state));
            }
        } else {
            adapter.log.debug('main.adapter.on.stateChange, sendAckOnly: ' +  adapter.config.sendAckOnly + ', state.ack: ' + state.ack + ' (no action required) "' + id + '": ' + JSON.stringify(state));
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
                    adapter.log.warn('Error on mqtt test: ' + err);
                    adapter.sendTo(obj.from, obj.command, 'error', obj.callback);
                });
            }
        }
    }
} // processMessage()


let cnt = 0;
function readStatesForPattern(item, cb) {
    // {"mask":"javascript.0.system.event_logs.*","QoS":"","retain":false,"enabled":false}
    
    adapter.log.debug('main.readStatesForPattern "' + item.mask + '" ...');

    let qos = (item.QoS && (parseInt(item.QoS) >= 0  && parseInt(item.QoS) <=2) ? parseInt(item.QoS) : parseInt(adapter.config.defaultQoSpublish));
    let retain = (item.retain ? parseBool(item.retain) : (item.retain && parseBool(item.retain) == false ? false : parseBool(adapter.config.retain)));
    let bPublishCommonNative = (item.commonnative ? parseBool(item.commonnative) : (item.commonnative && parseBool(item.commonnative) == false ? false : parseBool(adapter.config.ioBrokerMessageFormatPublishCommonNative)));
    adapter.log.debug('main.readStatesForPattern, qos: ' + qos + '; retain: '  + retain + '; bPublishCommonNative: ' + bPublishCommonNative);

    //!I! wenn state noch nicht existiert, wird er beim ersten Empfang hinzugefügt
    adapter.getForeignStates(item.mask, (err, res) => {
        adapter.log.debug('main.readStatesForPattern "' + item.mask + '", res: ' + JSON.stringify(res));

        if (err) {
            adapter.log.error('main.readStatesForPattern, error: ' + JSON.stringify(err));

            if (cb) cb('erro pm process mask');

            return;
        }

        if (!err && res) {
            states = states || {};

            // fill states array
            Object.keys(res).filter(id => !messageboxRegex.test(id))
                .forEach((id) => {
                    states[id] = {};
                    states[id].state = res[id];
                    states[id].qos = qos;
                    states[id].retain = retain;
                    states[id].publishCommonNative = bPublishCommonNative;
            });
        }

        // If all patters answered, start client
        if (!--cnt) {
            adapter.log.debug('main.readStatesForPattern, states: ' + JSON.stringify(states));

            adapter.log.debug('main.readStatesForPattern >> starting client ...');

            client = new require('./lib/client')(adapter, states);
        }

        if (cb) cb('main.readStatesForPattern finished');
    });
} // readStatesForPattern()


function main() {
    // check parameter plausibility
    adapter.config.CheckNamespaceDeepInObjecttreeTo = parseInt(adapter.config.CheckNamespaceDeepInObjecttreeTo, 10) || 2;
    if (adapter.config.CheckNamespaceDeepInObjecttreeTo < 2) adapter.config.CheckNamespaceDeepInObjecttreeTo = 2;
    if (adapter.config.ioBrokerMessageFormatCompressFromLength < 100) adapter.config.ioBrokerMessageFormatCompressFromLength = 100;
    adapter.config.debug = adapter.config.debug === 'true' || adapter.config.debug === true;
    adapter.config.sendStateObject = adapter.config.sendStateObject === 'true' || adapter.config.sendStateObject === true;
    
    adapter.config.defaultQoSsubscribe = parseInt(adapter.config.defaultQoSsubscribe, 10) || 0;
    adapter.config.defaultQoSpublish = parseInt(adapter.config.defaultQoSpublish, 10) || 0;
    adapter.config.retain = adapter.config.retain === 'true' || adapter.config.retain === true;
    adapter.config.persistent = adapter.config.persistent === 'true' || adapter.config.persistent === true;

    adapter.config.keepalive = parseInt(adapter.config.keepalive, 10) || 10;
    adapter.config.reconnectPeriod = parseInt(adapter.config.reconnectPeriod, 10) || 1000;
    adapter.config.connectTimeout = parseInt(adapter.config.connectTimeout, 10) || 30;

    adapter.config.ioBrokerMessageFormatCompressFromLength = parseInt(adapter.config.ioBrokerMessageFormatCompressFromLength, 10) || 0;
    adapter.config.ioBrokerMessageFormatUpdateCommonNative = adapter.config.ioBrokerMessageFormatUpdateCommonNative === 'true' || adapter.config.ioBrokerMessageFormatUpdateCommonNative === true;
    adapter.config.ioBrokerMessageFormatPublishCommonNative = adapter.config.ioBrokerMessageFormatPublishCommonNative === 'true' || adapter.config.ioBrokerMessageFormatPublishCommonNative === true;

    adapter.config.sendAckOnly = adapter.config.sendAckOnly === 'true' || adapter.config.sendAckOnly === true;
    adapter.config.saveOnChange = adapter.config.saveOnChange === 'true' || adapter.config.saveOnChange === true;
    adapter.config.ioBrokerMessageFormatActive = adapter.config.ioBrokerMessageFormatActive === 'true' || adapter.config.ioBrokerMessageFormatActive === true;
    adapter.config.ioBrokerMessageFormatIgnoreOwnMsg = adapter.config.ioBrokerMessageFormatIgnoreOwnMsg === 'true' || adapter.config.ioBrokerMessageFormatIgnoreOwnMsg === true;
    adapter.config.ioBrokerMessageFormatIgnoreOther = adapter.config.ioBrokerMessageFormatIgnoreOther === 'true' || adapter.config.ioBrokerMessageFormatIgnoreOther === true;

    if (adapter.config.debug) {
        adapter.log.info('adapter.config.keepalive: ' + adapter.config.keepalive);
        adapter.log.info('adapter.config.reconnectPeriod: ' + adapter.config.reconnectPeriod);
        adapter.log.info('adapter.config.connectTimeout: ' + adapter.config.connectTimeout);

        adapter.log.info('adapter.config.sendStateObject: ' + adapter.config.sendStateObject);
        adapter.log.info('adapter.config.debug: ' + adapter.config.debug);
        adapter.log.info('adapter.config.prefix: ' + JSON.stringify(adapter.config.prefix));
        
        adapter.log.info('adapter.config.patterns: ' + JSON.stringify(adapter.config.patterns));
        adapter.log.info('adapter.config.defaultQoSsubscribe: ' + adapter.config.defaultQoSsubscribe);
        adapter.log.info('adapter.config.CheckNamespaceDeepInObjecttreeTo: ' + adapter.config.CheckNamespaceDeepInObjecttreeTo + ' (default = 2)');
        adapter.log.info('adapter.config.saveOnChange: ' + adapter.config.saveOnChange);
        adapter.log.info('adapter.config.ioBrokerMessageFormatUpdateCommonNative: ' + adapter.config.ioBrokerMessageFormatUpdateCommonNative);

        adapter.log.info('adapter.config.publish: ' + JSON.stringify(adapter.config.publish));
        adapter.log.info('adapter.config.defaultQoSpublish: ' + adapter.config.defaultQoSpublish);
        adapter.log.info('adapter.config.retain: ' + adapter.config.retain);
        adapter.log.info('adapter.config.sendAckOnly: ' + adapter.config.sendAckOnly);
        adapter.log.info('adapter.config.ioBrokerMessageFormatPublishCommonNative: ' + adapter.config.ioBrokerMessageFormatPublishCommonNative);

        adapter.log.info('adapter.config.ioBrokerMessageFormatActive: ' + adapter.config.ioBrokerMessageFormatActive);
        adapter.log.info('adapter.config.ioBrokerMessageFormatIgnoreOwnMsg: ' + adapter.config.ioBrokerMessageFormatIgnoreOwnMsg);
        adapter.log.info('adapter.config.ioBrokerMessageFormatIgnoreOther: ' + adapter.config.ioBrokerMessageFormatIgnoreOther);
        adapter.log.info('adapter.config.ioBrokerMessageFormatCompressFromLength: ' + adapter.config.ioBrokerMessageFormatCompressFromLength + ' (default = 100)');
    }

    if (adapter.config.clientId === '') {
        adapter.log.error('No ClientID configured, please check konfiguration!');

        return;
    }


    let bStartClient = true;

    // Subscribe on own variables to publish it
    if (adapter.config.publish && adapter.config.publish != '' && adapter.config.publish.length > 0 && adapter.config.publish[0] != '' && adapter.config.publish[0].mask != '') {
        if (adapter.config.debug) adapter.log.info('main.publish precheck started ...');

        // [{"mask":"javascript.0.system.event_logs.*","QoS":"","retain":false,"enabled":false},{"mask":"logparser.0.*","QoS":"1","retain":false,"enabled":true}]

        adapter.config.publish.forEach((item) => {
            if ((item) && item.enabled && item.mask && item.mask != '') {
                if (adapter.config.debug) adapter.log.info('main.publish precheck, mask: "' + item.mask.trim() + '"; QoS: "' + item.QoS + '"; enabled: "' + item.enabled + '"');
                // mask: "javascript.1.scriptEnabled.common.*"; QoS: ""; enabled: "true"

                if (bStartClient) bStartClient = false;

                try {
                    if (item.mask.indexOf('#') > -1) {
                        // correct false configuration
                        adapter.log.warn('main.publish precheck, set MQTT notation for ioBroker id mask "' + item.mask + '": use "' + item.mask.replace(/#/g, '*') + ' notation');
                        item.mask = item.mask.replace(/#/g, '*');
                    }

                    let sMask = item.mask.trim();
                    if (sMask.indexOf('*') < 0) {
                        // no pattern --> make array
                        sMask = [sMask];
                        adapter.log.debug('main.publish precheck, mask string converted in array: ' + JSON.stringify(sMask));
                    }

                    //!P! subscribeForeignStates mit sMask ohne pattern beendet sich ohne action and error, echte ID in array funktioniert js-controller v2.2.9
                    //!P! let bSubscribeForeignStatesExecuted = false;

                    adapter.subscribeForeignStates(sMask, (error) => {  // Ausführung asynchron, hoffentlich wird cnt schneller inkrementiert als readStatesForPattern diesen runterzählt
                        //!P! bSubscribeForeignStatesExecuted = true;     // wenn sMask == string und kein "*", dann wird subscribeForeignStates nicht ausgeführt

                        if (error) {
                            adapter.log.error('main.publish precheck, error on subscribeForeignStates "' + sMask + '" (' + JSON.stringify(error) + ')');

                            return;
                        } else {
                            cnt++;

                            adapter.log.debug('main.publish precheck, readStatesForPattern for item: ' + JSON.stringify(item));

                            readStatesForPattern(item);
                        }
                    });
                    /*!P! adapter.log.debug('main.publish precheck, bSubscribeForeignStatesExecuted: ' + bSubscribeForeignStatesExecuted);

                    if (bSubscribeForeignStatesExecuted === false) {
                        adapter.log.error('main.publish precheck, error in mask, subscribeForeignStates ignored mask "' + sMask + '"');

                        return;
                    } */
                } catch (err) {
                    adapter.log.error('main.publish precheck, error on publish ' + JSON.stringify(item) + '; err: ' + JSON.stringify(err));
                    // {"mask":"javascript.1.scriptEnabled.common.*","QoS":"","retain":true,"enabled":true}

                    return;
                }
            }
        });

        if (adapter.config.debug) adapter.log.info('main.publish precheck finished');

        if (bStartClient) {
            if (adapter.config.debug) adapter.log.info('main, no (enabled) mask for ioBroker subscriptions found!');

            adapter.log.debug('main >> starting client ...');
    
            client = new require(__dirname + '/lib/client')(adapter, states);
        }
    } else {
        adapter.log.info('main, no masks for ioBroker subscriptions configured!');

        // If no subscription, start client
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
