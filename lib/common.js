'use strict';

function convertID2topic(id, pattern, prefix, namespace) {
    let topic;
    id = (id || '').toString();
    if (pattern && pattern.substring(0, (prefix + namespace).length) === (prefix + namespace)) {
        topic = prefix + id;
    } else if (pattern && pattern.substring(0, namespace.length) === namespace) {
        topic = id;
    } else if (prefix && pattern && pattern.substring(0, prefix.length) === prefix) {
        topic = prefix + id;//.substring(namespace.length + 1);
    } else if (id.substring(0, namespace.length) === namespace) {
        topic = (prefix || '') + id.substring(namespace.length + 1);
    } else {
        topic = (prefix || '') + id;
    }
    topic = topic.replace(/\./g, '/');
    return topic;
}

function state2string(val, sendStateObject, ioBrokerMessageFormatActive, clientId, receiver) {
    let msg;

    try {
        if (sendStateObject === undefined || sendStateObject === null) {
            sendStateObject = false;
        }
        //!P! prüfen, ob receiver valid, == '*' oder string[]

        if (ioBrokerMessageFormatActive === undefined || ioBrokerMessageFormatActive === null) {
            ioBrokerMessageFormatActive = false;
        }
        if (receiver === undefined || receiver === null) {
            receiver = '*';
        }

        if (val && typeof val === 'object') {
            if (val.val === null) {
                msg = 'null';
            } else {           
                msg = ((val.val === null) ? 'null' : (val.val === undefined ? 'undefined' : (sendStateObject === true ? JSON.stringify(val) : val.val.toString())));
            }
        } else {
            msg = ((val === null) ? 'null' : (val === undefined ? 'undefined' : (sendStateObject === true ? JSON.stringify(val) : val.toString())));
        }

        if (ioBrokerMessageFormatActive) {
            // create ioBroker nessage
//!P!            msg = JSON.stringify({"clientID": clientId, "ts": (new Date).getTime(), "receiver": ((typeof receiver == 'string') ? receiver : JSON.stringify(receiver)), "message": msg});
            msg = JSON.stringify({"clientID": clientId, "ts": (new Date).getTime(), "receiver": JSON.stringify(receiver), "message": msg});
        }
        return msg;
    }
    catch(err) {
        return err;
    }
}

function convertTopic2id(topic, dontCutNamespace, prefix, namespace) {
    if (!topic) return topic;

    // Remove own prefix if
    if (prefix && topic.substring(0, prefix.length) === prefix) {
        topic = topic.substring(prefix.length);
    }

    topic = topic.replace(/\//g, '.').replace(/\s/g, '_');
    if (topic[0] === '.') topic = topic.substring(1);
    if (topic[topic.length - 1] === '.') topic = topic.substring(0, topic.length - 1);



    if (!dontCutNamespace && topic.substring(0, namespace.length) === namespace) {
        topic = topic.substring(namespace.length + 1);
    }

    return topic;
}

exports.convertTopic2id = convertTopic2id;
exports.convertID2topic = convertID2topic;
exports.state2string    = state2string;
