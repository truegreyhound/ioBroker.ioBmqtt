'use strict';


//!P! bringt Fehlerexport const ioBrokerMessageFormatVersion = '1.0';
// SyntaxError: Unexpected token export
const ioBrokerMessageFormatVersion = '1.0';

const base64 = {
    decode: s => Buffer.from(s, 'base64'),
    encode: b => Buffer.from(b).toString('base64')
};


function convertID2topic(id, pattern, prefix, namespace) {
    let topic;

    id = (id || '').toString();
    prefix = prefix.replace(/\//g, '.');
    
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
    topic = topic.replace(/\./g, '/').replace(/\+/g, '~');

    return topic;
}


function convertTopic2id(topic, dontCutNamespace, prefix, namespace) {
    if (!topic) return topic;

    // Remove own prefix if
    if (prefix && topic.substring(0, prefix.length) === prefix) {
        topic = topic.substring(prefix.length);
    }

    let sID = topic.replace(/\//g, '.').replace(/\s/g, '_').replace(/~/g, '+');
    if (sID[0] === '.') sID = sID.substring(1);
    if (sID[sID.length - 1] === '.') sID = sID.substring(0, sID.length - 1);

    if (!dontCutNamespace && sID.substring(0, namespace.length) === namespace) {
        sID = sID.substring(namespace.length + 1);
    }

    return sID;
}


//!P!function state2string(val, sendStateObject, ioBrokerMessageFormatActive, ioBrokerMessageFormatCompressFromLength, clientId, receiver, coding, stateType, publishCommonNative) {
function state2string(iobState, bSendStateObject, bioBMFActive, nioBMFCompressFromLength, sClientId, receiver, sCoding, that) {
    let vValue = iobState.state;
    let msg;
    let sCoding_src = '';
    let sStateType = iobState.type;
    let bPublishCommonNative = (iobState.publishCommonNative ? parseBool(iobState.publishCommonNative) : false);
    let sStateAttr;

    try {
        if (bSendStateObject === undefined || bSendStateObject === null || bSendStateObject !== true) {
            bSendStateObject = false;
        }
        if (bioBMFActive === undefined || bioBMFActive === null || bioBMFActive !== true) {
            bioBMFActive = false;
        }
        if (nioBMFCompressFromLength === undefined || nioBMFCompressFromLength === null) {
            nioBMFCompressFromLength = 0;
        }
        that.log.silly('state2string, bSendStateObject: ' + bSendStateObject + '; bioBMFActive: ' + bioBMFActive + '; nioBMFCompressFromLength: ' + nioBMFCompressFromLength);

        if (sCoding === undefined || sCoding === null || typeof sCoding != 'string') {
            sCoding = '';
        }
        that.log.silly('state2string, sCoding: ' + sCoding);

        //!P! prüfen, ob receiver valid, == '*' oder string[]
        if (receiver === undefined || receiver === null) {
            receiver = '*';
        }

        that.log.silly('state2string, vValue: ' + JSON.stringify(vValue) + '; typeof vValue: ' + (typeof vValue));

        if (vValue && typeof vValue === 'object') {
            that.log.silly('state2string, vValue.val: ' + JSON.stringify(vValue.val) + '; typeof vValue.val: ' + (typeof vValue.val) + '; !vValue.val: ' + (!vValue.val));

            if (vValue.val == null || vValue.val == undefined) {
                msg = '';
            } else {           
                msg = (bSendStateObject ? JSON.stringify(vValue) : vValue.val.toString());
            }
            that.log.silly('state2string, msg-object: ' + JSON.stringify(msg));
        } else {
            if (vValue == null || vValue == undefined) {
                msg = '';
            } else {           
                msg = (bSendStateObject ? JSON.stringify(vValue) : vValue.toString());
            }
            that.log.silly('state2string, msg: ' + JSON.stringify(msg));
        }

        // is zipped string JSON compliant - yes. is zipped and base64 converted
        if (sCoding == 'zip') { 
            sCoding_src = 'zip';
            msg = zip(msg); 
        }

        if (sCoding != 'zip' && sCoding != 'base64' && (nioBMFCompressFromLength > 0 && msg.length > nioBMFCompressFromLength)) {
            // message too long
           msg = zip(msg);

            //!P!sCoding_src = (sCoding == 'base64') ? 'object' : 'size';
            sCoding_src = 'size';
            sCoding = 'zip';
        }

        //!P!if (sCoding == 'base64' && (nioBMFCompressFromLength == 0 || (nioBMFCompressFromLength > 0 && msg.length <= nioBMFCompressFromLength))) msg = base64.encode(msg);
        if (sCoding == 'base64') {
            sCoding_src = 'base64';
            msg = base64.encode(msg);
        }

        that.log.silly('state2string, msg after nioBMFCompressFromLength: ' + JSON.stringify(msg));

        if (bPublishCommonNative && iobState.common && iobState.native) {
            // 
            sStateAttr = base64.encode(JSON.stringify({common: iobState.common, native: iobState.native}));
        }

        if (bioBMFActive) {
            // create ioBroker nessage
            if (sStateAttr) {
                msg = JSON.stringify({"clientID": sClientId, "ts": (new Date()).getTime(), "version": ioBrokerMessageFormatVersion, "type": sStateType,  "attr": sStateAttr, "coding": sCoding, "coding-src": sCoding_src, "receiver": JSON.stringify(receiver), "message": msg});
            } else {
//!P!            msg = JSON.stringify({"clientID": clientId, "ts": (new Date()).getTime(), "receiver": ((typeof receiver == 'string') ? receiver : JSON.stringify(receiver)), "message": msg});
                msg = JSON.stringify({"clientID": sClientId, "ts": (new Date()).getTime(), "version": ioBrokerMessageFormatVersion, "type": sStateType,  "coding": sCoding, "coding-src": sCoding_src, "receiver": JSON.stringify(receiver), "message": msg});
            }
        }

        return msg;
    }
    catch(err) {
        return err;
    }
} // state2string()


//!P!  node-huffman-compression
//!P!  https://github.com/erikdubbelboer/node-huffman-compression

// from https://stackoverflow.com/a/56680172
// Apply LZW-compression to a string and return base64 compressed string.
function zip (sString) {
    try {
        let dict = {};
        let data = (sString + '').split('');
        let out = [];
        let currChar;
        let phrase = data[0];
        let code = 256;

        for (let i = 1; i < data.length; i++) {
            currChar = data[i];
            if (dict[phrase + currChar] != null) {
                phrase += currChar;
            } else {
                out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
                dict[phrase + currChar] = code;
                code++;
                phrase = currChar;
            }
        }
        out.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
        for (let j = 0; j < out.length; j++) {
            out[j] = String.fromCharCode(out[j]);
        }
        return base64.encode(out.join(''));
    } catch (e) {
        console.log('Failed to zip string return empty string: ' + JSON.stringify(e), 'error');

        return '';
    }
} // zip()

// Decompress an LZW-encoded base64 string
function unzip (base64ZippedString) {
    try {
        let s = base64.decode(base64ZippedString);
        let dict = {};
        let data = (s + '').split('');
        let currChar = data[0];
        let oldPhrase = currChar;
        let out = [currChar];
        let code = 256;
        let phrase;

        for (let i = 1; i < data.length; i++) {
            let currCode = data[i].charCodeAt(0);
            if (currCode < 256) {
                phrase = data[i];
            } else {
                phrase = dict[currCode] ? dict[currCode] : oldPhrase + currChar;
            }
            out.push(phrase);
            currChar = phrase.charAt(0);
            dict[code] = oldPhrase + currChar;
            code++;
            oldPhrase = phrase;
        }
        return out.join('');
    } catch (e) {
        console.log('Failed to unzip string return empty string: ' + JSON.stringify(e), 'error');

        return '';
    }
} // unzip()


/* 
    topic   - a topic (javascript/0/watering/garden/circuit/1/valve_state)
    pattern - a pattern (javascript/0/watering/garden/#)
*/
function does_topic_match_pattern(topic, pattern) {

    let result = topic.match(pattern.replace(/\/\+/g, '/.+').replace('#', '.*'));
    
    return (result ? (result.length > 0) : false);

} // does_topic_match_pattern()


function parseBool(value) {
    if (typeof value === "boolean") return value;

    if (typeof value === "number") {
        return value === 1 ? true : value === 0 ? false : undefined;
    }

    if (typeof value != "string") return undefined;

    return value.toLowerCase() === 'true' ? true : value.toLowerCase() === 'false' ? false : undefined;

    
} // parseBool()


exports.convertTopic2id = convertTopic2id;
exports.convertID2topic = convertID2topic;
exports.state2string    = state2string;
exports.zip             = zip;
exports.unzip           = unzip;
exports.does_topic_match_pattern = does_topic_match_pattern;
exports.parseBool       = parseBool;
