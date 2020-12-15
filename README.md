![Logo](admin/iobmqtt.png)
# ioBroker MQTT message format client

##![Number of Installations](http://iobroker.live/badges/iobmqtt-installed.svg) ![Number of Installations](http://iobroker.live/badges/##iobmqtt-stable.svg) [![NPM version](http://img.shields.io/npm/v/iobroker.iobmqtt.svg)](https://www.npmjs.com/package/iobroker.iobmqtt)
##[![Downloads](https://img.shields.io/npm/dm/iobroker.mqtt.svg)](https://www.npmjs.com/package/iobroker.iobmqtt)
##[![Tests](https://travis-ci.org/ioBroker/ioBroker.mqtt.svg?branch=master)](https://travis-ci.org/ioBroker/ioBroker.iobmqtt)

##[![NPM](https://nodei.co/npm/iobroker.iobmqtt.png?downloads=true)](https://nodei.co/npm/iobroker.iobmqtt/)

Requires node.js **8.0** or higher.

## MQ Telemetry Transport for ioBroker (MQTT) message format.

MQTT (formerly Message Queue Telemetry Transport) is a publish-subscribe based "light weight" messaging protocol for use on top of the TCP/IP protocol.
It is designed for connections with remote locations where a "small code footprint" is required and/or network bandwidth is limited.
The Publish-Subscribe messaging pattern requires a message broker. The broker is responsible for distributing messages to interested clients based on the topic of a message.
Historically, the 'MQ' in 'MQTT' came from IBM's MQ message queuing product line.

Dieser Adapter packt den zu sendenen State bzw. Wert in ein eigenes Metadatenobjekt, um zusätzliche Daten zu senden (ClientId, Sendezeit, Empfänger, u. a.). Damit kann u. a. das erneute Verarbeiten eines gerade empfangenen und selbst gesendeten States unterbunden werden. Zusätzlich kann für einzelne States eine base64-Kodierung konfiguriert. Außerdem besteht die Möglichkeit eine Grenze festzulegen, ab der die gesendete Nachricht komprimiert wird.

This adapter uses the MQTT.js library from https://github.com/adamvr/MQTT.js/

##**This adapter uses Sentry libraries to automatically report exceptions and code errors to the developers.** For more details and ##for information how to disable the error reporting see [Sentry-Plugin Documentation](https://github.com/ioBroker/##plugin-sentry#plugin-sentry)! Sentry reporting is used starting with js-controller 3.0.

This adapter works only as client for an broker.



### connection settings
- **URL** - name or ip address of the broker/server. Like "localhost".
- **Port** - Port of the MQTT broker. By default 1883
- **User** - if broker required authentication, define here the user name.
- **Password** - if user name is not empty the password must be set. It can be empty.
- **Test connection** - Press the button to check the connection to broker. Adapter must be enabled before.

### MQTT generell settings
- **clientId** - uniq client id for identification on the broker  !!! bad english
- **Prefix for all topics** - if set, every sent topic will be prepended with this prefix, e.g if prefix "iobroker/" all states will have names like "**iobroker**/iobmqtt/0/
- **keepalive** - This value is a time interval, measured in seconds, during which the broker expects a client to send a message, such as a PUBLISH message. If no message is sent from the client to the broker during the interval, the broker automatically closes the connection. Note that the keep-alive value you specify is multiplied by 1.5, so setting a 10-minute keep-alive actually results in a 15 minute interval. The maximum value allowable, and default value, is 65535. Do not set below 10 seconds.

- **Persistent Session** - When checked, the broker and the Client (QoS 1/2???) saves the session information of the client. This means it tracks which messages have been send / received by the client (only QoS Level 1 and 2) and to which topics this client has subscribed. This information survives a disconnect and reconnect of the adapter. (not tested)

- **Trace output for every message** - Debug outputs.
- **ignore own messages** - States that have been sent (published as message) and subscribed as a topic at the same time are not processed
- **compress from lenght** - if the length of the original message is longer, it is compressed

### MQTT subscribe settings
- **Max topic length** - topics that are longer than this value are not processed
- **QoS (Quality of Service)** - possible values 0, 1 or 2, see the documentation to MQTT, not tested yet
- **Subscribe Patterns** - List of patterns to be subscribed. See chapter "Examples of using wildcards" to define the pattern. '#' to subscribe for all topics. 'iobmqtt/0/#,javascript/#' to subscribe for states of iobmqtt.0 and javascript. A QoS that differs from the default can be set for each pattern. Only enabled patterns are subscribed.
- **how deep check namspace before save under iobmqtt adapter** - For a received topic, it is checked whether there is already a data point for the derived ID up to this depth of the namespace. If so, the state is written under this namespace, if not under the namespace of this adapter instance, e.g if the receivd topic "javascript/0/watering/garden/circuit/1/valve_state" und the value of this property is "3" (zero based index) then the the adapter checks whether an object with the ID "javascript/0/watering/garden" exists. If so, the state is written there, otherwise under iobmqtt.<instance>. as e.g iobmqtt.0.javascript.0.watering.garden.circuit.1.valve_state
- **update common and native if given** - If contains a received message a "attr" property, common and native will be write to the state
- **Store only on change** - Write the incoming messages data only if the payload is differ from actual stored. If the payload is an ioBroker State object, then ack and lc are also taken into account.

### MQTT publish settings
- **Publish all states at start** - Publish all states (defined by state mask) every time by connection establishment to announce own available states and their values. If this option and "use ioBroker MQTT message format" is activated, the topic 'ioBroker/mqtt-command' with the payload 'publishStop' is sent before the states are sent. After the publication of all states, the topic 'ioBroker/mqtt-command' with the payload 'publishStart'.
- **QoS (Quality of Service)** - possible values 0, 1 or 2, see the documentation to MQTT, not tested yet
- **retain flag** - The broker stores the last retained message and the corresponding QoS for that topic. Each client that subscribes to a topic pattern that matches the topic of the retained message receives the retained message immediately after they subscribe. The broker stores only one retained message per topic. Retained messages help newly-subscribed clients get a status update immediately after they subscribe to a topic. The retained message eliminates the wait for the publishing clients to send the next update.
- **send common and native** - default for all configured masks, if enabled, for all enabled states the adapter send in the atrribute "attr" the properties common and native of an state
- **Mask to publish own states** - List of mask for states, that must be published to broker. '*' - to publish all states. 'io.yr.*,io.hm-rpc.0.*' to publish states of "yr" and "hm-rpc" adapter. Regardless of this, a state or a value are only sent if the value, ack or lc have changed. A QoS and the retain flag that differs from the default can be set for each mask. Only enabled masks are published.
- **Send states with ack=true only** - Normally all states independent from the ack state will be sent to the broker. If this flag is set, only states with ack=true will be sent. 

## ioBroker MQTT message format

<topic> {'clientID': <clientID>, 'ts': <timestamp>, 'version': <version>, 'receiver': <receiver>[, 'type': <type>][, 'attr': <attr>], 'coding': <coding>[, 'coding-src': <coding-src>],'messsage': <Message>}

topic: <normaler topic>|'ioBroker/mqtt-command'
		== ioBroker/mqtt-command, dann steht in <message> eine Steueranweisung: {'command': <command>}
				command: publishStop|publishStart
clientID	- clientID der Adapterinstanz
timestamp	- Zeitpunkt der Erstellung/Sendung der Nachricht
version: <m.n> - m == major, n == minor
		Wenn ein Client eine Nachricht mit größerem Major bekommt, führt das zu Fehlermeldung und nach 3 Nachrichten zur Deaktivierung
		bei größerem Minor zu warnings (max 3 je Tag)
receiver: * - everyone, [<clientID>]  (derzeit nicht konfigurierbar)
type: value from common.type from ioBroker state object
attr: {common: {...}, native: {...}} - properties from ioBroker state objects
coding: |base64|zip
		Im Objekt des Datenpunktes kann in native.mqtt_coding (= base64) eine Vorgabe gemacht werden, das ist insbesondere für JSON-Objekte gedacht
coding-src: |object|size, '' - keine Quelle | object - native.mqtt_coding, size - message.lenght > definition
message		- die Originalmessage


## Install

```node iobroker.js add iobmqtt```

## Usage


### Examples of using wildcards
The following examples on the use of wildcards, builds on the example provided in topic strings.

- "Sport"
- "Sport/Tennis"
- "Sport/Basketball"
- "Sport/Swimming"
- "Sport/Tennis/Finals"
- "Sport/Basketball/Finals"
- "Sport/Swimming/Finals"

If you want to subscribe to all Tennis topics, you can use the number sign '#', or the plus sign '+'.

- "Sport/Tennis/#" (this will receive "Sport/Tennis" and "Sport/Tennis/Finals")
- "Sport/Tennis/+" (this will receive "Sport/Tennis/Finals" but not "Sport/Tennis")

For JMS topics, if you want to subscribe to all Finals topics, you can use the number sign '#', or the plus sign '+'.

- "Sport/#/Finals"
- "Sport/+/Finals"

For MQTT topics, if you want to subscribe to all Finals topics, you can use the plus sign '+' .

"Sport/+/Finals"

### Tests
The broker was tested with following broker:

- mosquitto

## Todo
* Implement resend of "QoS 2" messages after a while.
  Whenever a packet gets lost on the way, the sender is responsible for resending the last message after a reasonable amount of time. This is true when the sender is a MQTT client and also when a MQTT broker sends a message.

* queue packets with "QoS 1/2" for the offline clients with persistent session.
  [Read here](https://www.hivemq.com/blog/mqtt-essentials-part-7-persistent-session-queuing-messages)


## Changelog

### 0.2.4 (2020-12-12)
* (greyhound) correct description
* (greyhound) maxTopicLength removed

### 0.2.3 (2020-11-30)
* (greyhound) add possibility to publish and save common and native properties for a mask

### 0.2.2 (2020-11-27)
* (greyhound) first working version with the  ioBroker MQTT message format

### 0.2.1 (2020-11-01)
* (greyhound) clone the mqtt-adapter to iobmqtt and rewrite the client

### 2.1.9 (2020-09-17)
* (Apollon77) Crash cases prevented (Sentry IOBROKER-MQTT-E, IOBROKER-MQTT-F)

## License

The MIT License (MIT)

Copyright (c) 2014-2020, greyhound <truegreyhound@gmx.net>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
