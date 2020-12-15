
# Infos
## mqtt-library-Probleme
* Wenn an mqtt.connect(... ein Parameter als String statt Zahl übergeben wird, z.B. "keepalive": "10" statt "keepalive": 10, dann kommt es zu Connectionproblem. Der client versucht endlos eine Verbindungsaufforderung und mosquitto schließt diese sofort wieder. In ioBroker kommt dann endlos "mqtt.2	2020-11-09 23:26:21.886	error	(1935) client.on close, err: {}"

* Wenn ein 2. Client versucht sich mit einer bereits verbundenen ID sich am Broker anzumelden, dann wird dieser Client sofort vom Broker disconnected.  
Der ioBroker.mqtt Client erkennt das leider nicht und dann geht Adapter in Endlosschleife mit connect --> close --> connect.

## Datenablage ioBroker
* Für neue Objekte gibt es 2 Möglichkeiten:  
a) der Nampespace existiert bereits, z. B. javascript.0.presence, dann wird Objekt dort auch angelegt  
b) Nampespace existiert nicht, dann wird das Opjekt unterhalb von mqtt.n erstellt  
Sollte dass Anlegen der State-Objekte und das Schreiben der State-Werte zu zeitaufwändig sein, könnte dies über eine asynchron im Hintergrund laufende Queue gelöst werden, über die dann die Anlage organisiert wird.


# Programmlücken, Ergäzungen
* clean Adaperstart prüfen/testen, d.h., besteht die Möglichkeit alle selbst publishten topics auf dem Broker zu löschen , z. B. via ClientID oder direkt per Topic-pattern? <-- wäre publishing-Parameter

* auf der allgemeinen MQTT-Konfig-Seite eine Liste mit potentiellen Empfängern pflegen, dann bei Publish in Liste Combobox mit Multiselect für Empfänger, Standard "*"

* Suchtiefe bei Anlage könnte auch ein Kandidat für ein Pattern-spezifische Konfiguration sein (Subscribe)

* ggf. ist es sinnvoll, an states[id] einen errorcounter (ggf. je error type) anzuhängen und nach z. B. 3 maligem Auftreten diesen state zu übergehen, wenn vorher erfolg auf 0 wieder setzen

## index_m.html
- Wie Werte in neuer Zeile vorbelegen nach klick auf +
- Combobox in Tabelle
- Validierung Tabellenzeile wenn Focus lost

- einzelne Spalte(n) Schreibschutz
- Tabellenkopf fixieren
- Tabelle (Ansicht) nach emit refreshen
- Wie config.\<property\> aus Adapter in Adapter-config object aktualisieren, Wenn Adapter startet, ist vorheriger Wert wieder da

- Close-Ereignis --> function


# MQTT
## persistent session
? muss das aktiviert werden?
wenn subscribe mit QoS 1|2, dann doch automat. persistent session oder?
was ist bei publish mit QoS > 0 ??


## ack-Handling
### Im original-Adapter, Konfiguration adapter.config.sendAckToo - Auch Zustände senden (ack = true)  
== TRUE -> dann wird immer auf geänderten Wert/ack geprüft, unabhängig von ack  
== FALSE --> dann muss ack des state == FALSE sein, dann erfolgt Prüfung auf geänderten Wert/ack  
?? Habe ich nicht verstanden, was dass bringen soll

### geändert auf sendAckOnly
ack --> sendAckOnly
Option nur bei ack == TRUE senden, wichtig ggf. für Adapter


* bei Skripten ist ack eigentlich unwichtig, es sei denn jemand nutzt das speziell, also wäre != value das Kriteriun, ack kann von mqtt für eigenes Handling genutzt werden.
* bei Adaptern  
z. B. PiFace, hier werden die Werte per Skripte gesetzt, aber durch den Adapter bestätigt --> ohne mqtt-Adapter ist bei allen states ack == TRUE und Quelle = system.adapter.piface.x  
Beim Start des PiFace-Adapter werden alle Werte zurückgesetzt und damit auch ack = TRUE  
a) Wert fremd gesetzt (Skript, VIS, durch anderen Adapter?): ack == FALSE, dann durch Adapter ack == TRUE, mqtt-Adapter reagiert bei erster Änderung  
b) Wert durch Adapter selbst gesetzt? gleich ack == TRUE?
?? Was passiert, wenn state.ack == TRUE und mqtt-Adapter nach der Bestätigung auch ack == true setzen will?
Änderung via VIS: piface.2.out1 = false  
web.0		ack: false  
piface.2	ack: true  
>> !! prüfen, wie das im Zusammenspiel mit mqtt ist

* das Publishing muss ggf. gebremst werden, sonst wird das System überlastet  ????  z. Z. deaktiviert

* client.on close, err  
client.on close, err: {"errno":"ECONNREFUSED","code":"ECONNREFUSED","syscall":"connect","address":"192.168.110.50","port":1883}  
connection --> nach 3 Fehlversuchen yellow, dann scheduler, der prüft ob broker wieder da


## state
Zeit letzte Änderung bezieht sich NUR auf den Wert
Zeitstempel bezieht jede Änderung am State-Objekt ein, also auch Quelle, User, ack, ...

### ts
kann man ts in state schreiben? Wenn nur value, dann ggf. ts aus ioBrokerMessage als ts schreiben


# Konfigurationseinstellung
## Pi3Face

### Instance #0
onchange: true, onpublish: true, publishAllOnStart: true, prefix: pi3face/, asObject: true, ioBroker MF: true  

#### subscribe:  
pi3face/logparser/0/emptyAllJson  --> logparser.0.emptyAllJson  
pi3face/logparser/0/filters/+/emptyJson  

#### publish:  
retain: true  
logparser.0.* --> pi3face/logparser/0/#  
javascript.0.system.event_logs.*  

### Instance #1
onchange: true, onpublish: true, publishAllOnStart: true, prefix:, asObject: true, ioBroker MF: true

#### subscribe:
deep: 2  
javascript/1/watering/garden/#  
javascript/0/alarm/system/#  
javascript/0/presence/HomeState  
javascript/0/presence/guests  

#### publish: 
retain: true  
javascript.0.scriptEnabled.Secure.*  
javascript.0.scriptEnabled.common.*  
javascript.1.scriptEnabled.common.*  
javascript.0.lights.*  
javascript.0.alarm.*  
javascript.1.watering.garden.circuit.*  
piface.*  

## Pi4Ue

### Instance #0
onchange: true, publishAllOnStart: false, prefix:, asObject: true, ioBroker MF: true

#### subscribe:
javascript/0/scriptEnabled/#  
javascript/1/scriptEnabled/#  
javascript/0/alarm/#  
javascript/0/lights/#  
javascript/1/watering/garden/#  
piface/#  
pi3face/logparser/0/#  

#### publish:
retain: false  
iobmqtt.0.javascript.1.watering.garden.circuit.*  
iobmqtt.0.piface.*  
iobmqtt.0.pi3face.logparser.0.emptyAllJson  
iobmqtt.0.pi3face.logparser.0.filters.*.emptyJson  

### Instance #1
onchange: true, publishAllOnStart: true, prefix:, asObject: true, , ioBroker MF: true

#### subscribe: 

#### publish: 
retain: true  
hm-rpc.0.OEQ0996420.1.STATE  
javascript.0.presence.HomeState  
javascript.0.presence.guests  



# ioBroker Messageformat
\<topic\> {'clientID': \<ID\>, 'ts': \<timestamp\>, 'version': \<version\>, 'receiver': \<receiver\>[, 'type': \<type\>][, 'attr': \<attr\>,]'coding': \<coding\>[, 'coding-src': \<coding-src\>],'messsage': \<Message\>}
\<topic\> {'clientID': \<ID\>, 'ts': \<timestamp\>, 'version': \<version\>, 'receiver': \<receiver\>[, 'type': \<type\>][, 'attr': \<attr\>,]'coding': \<coding\>[, 'coding-src': \<coding-src\>],'messsage': \<Message\>}  

* topic: \<normaler topic\>|'ioBroker/mqtt-command'  
* version: \<m.n\> - m == major, n == minor  
	Wenn ein Client eine Nachricht mit größerem Major bekommt, führt das zu Fehlermeldung und nach 3 Nachrichten zur Deaktivierung bei größerem Minor zu warnings (max 3 je Tag).
* receiver: * - everyone, [\<clientID\>]
* type: value from common.type from ioBroker state object
* attr: {common: {...}, native: {...}} - enthält die beiden properties des ioBroker state Objektes
* coding: |base64|zip - in Objekt des Datenpunktes custom property: native.mqtt_coding: base64, insbesondere bei JSON-Objekten
* coding-src: |object|size, == '' | object - native.mqtt_coding, size - message.lenght > definition
* message - Wenn topic == 'ioBroker/mqtt-command', dann steht in \<message\> eine Steueranweisung: {'command': \<command\>}  
command: publishStop|publishStart

# iobmqtt-Adapter-Parameter
* publish all on Start
Client2 hat subscription, bekommt topic / payload --> update State, if changed --> publish changed State -- ist aber nicht sinvoll, da ja gerade erhalten --> publishStop
> prüfen ob bekannter topic (javascript/0/watering/garden/circuit/1/valve_state), d. h. topic muss zu einem config.patterns passen, wie z.B. javascript/0/watering/garden/#
> Wenn ja, dann return, sonst weiter
mqtt master startet, publish on start with retain == TRUE --> 
- andere Clients vom Senden abhalten --> publishStop, Subscription laufen weiter
- dann alle states senden
- auf anderen Clients Empfang freigeben --> publishStart
- subscription starten
> retain bewirkt, dass alle neu hinzukommende Clients alle entsprechend markierte Messages bekommen (Erstausstattung)



# Gedankenspiele
## zusätzliche Optionen
ioBrokerMessageFormatActive  
ioBrokerMessageFormatIgnoreOther  
ioBrokerMessageFormatIgnoreOwnMsg	- Wenn neben publish auf dem selben State auch eine Subscription konfiguriert ist, um z. B. Änderungen von anderen Clients zu verarbeiten  
CheckNamespaceDeepInObjecttreeTo	- Namespace-Tiefe, ab der unter dem Adapter angelegt wird, mind. >= 2  
	>> ggf. als Tabellenspalte, dann muss Option über Tabelle in der CfgView gezogen werden

## weitere Befehle könnten sein:
- Anforderung states (Maske) vom Master, Master ist der Client, der für den State (Maske) publishAllOnStart == TRUE gesetzt hat  
--> für einen State darf nur ein Client publishAllOnStart == TRUE gesetzt haben!  
--> Diese Anforderung sollte auch via sendTo/Message von einem Skript möglich sein
- clear all topics with Mask
- Query Master + publishes
- Query Clients + subscriptions + publishes
- stop|start admin|VIS|???


Ggf. zusätzlich einen 'messagetype', messagetype == 'init' würde dann das Schreiben dieses States "erzwingen"  ???

Das ioBroker Messageformat würde auch wieder die Verarbeitung eines Wertes (statt des state-Objetes) ermöglichen, da dann auch '' innerhalb der Message übertragen wird.
+ ggf. zusätzlich ack und ts

# mosquitto

## installation client
apt-get install mosquitto-clients  
--> mosquitto_pub und mosquitto_sub  

## clear reteined message
https://community.openhab.org/t/clearing-mqtt-retained-messages/58221  
  
\# mosquitto_pub -h hostname -t the/topic -u username -P password -n -r -d

\# mosquitto_pub -h 192.168.110.50 -t ioBroker/mqtt-command -u iobue -P mosqUiob\!Pty92 -n -r -d  
-n = Send a null (zero length) message  
-r = Retain the message as a “last known good” value on the broker  
-d = Enable debug messages  

\# mosquitto_pub -h 192.168.110.50 -t ioBroker/mqtt-command -u iobue -P mosqUiob\!Pty92 -m ''  
-m = message with no content


## Clearing ALL retained messages

sudo systemctl stop mosquitto.service  
or  
sudo service mosquitto stop  


Delete the mosquitto.db containing all the stored message data in the persistence. By default, located in /var/lib/mosquitto/mosquitto.db

sudo rm /var/lib/mosquitto/mosquitto.db


Restart the mosquitto service

sudo systemctl start mosquitto.service  
or  
sudo service mosquitto start  





# Log sample

## mosquitto
1606042293: No will message specified.  
1606042293: Sending CONNACK to ioB-Pi4-Ue1-MQC2 (0, 0)  
1606042293: Received PUBLISH from ioB-Pi4-Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (175 bytes))  
1606042293: Sending PUBLISH to ioBrokerPi3Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (175 bytes))  
1606042293: Received PUBLISH from ioB-Pi4-Ue1-MQC2 (d0, q0, r1, m0, 'javascript/0/presence/HomeState', ... (317 bytes))  
1606042293: Sending PUBLISH to ioBrokerPi3Ue1-MQC2 (d0, q0, r0, m0, 'javascript/0/presence/HomeState', ... (317 bytes))  
1606042293: Sending PUBLISH to 2ef702a0723c498f828c2939ebc02cbd (d0, q0, r0, m0, 'javascript/0/presence/HomeState', ... (317 bytes))  
1606042293: Received SUBSCRIBE from ioB-Pi4-Ue1-MQC2  
1606042293:     ioBroker/mqtt-command (QoS 0)  
1606042293: ioB-Pi4-Ue1-MQC2 0 ioBroker/mqtt-command  
1606042293: Sending SUBACK to ioB-Pi4-Ue1-MQC2  
1606042293: Sending PUBLISH to ioB-Pi4-Ue1-MQC2 (d0, q0, r1, m0, 'ioBroker/mqtt-command', ... (168 bytes))  
1606042293: Received PUBLISH from ioB-Pi4-Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (176 bytes))  
1606042293: Sending PUBLISH to ioBrokerPi3Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (176 bytes))  
1606042293: Sending PUBLISH to ioB-Pi4-Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (176 bytes))  
1606042304: Received PINGREQ from ioB-Pi4-Ue1-MQC2  
1606042304: Sending PINGRESP to ioB-Pi4-Ue1-MQC2  

nach dem Löschen des topic 'ioBroker/mqtt-command' (siehe clear reteined message) wurde kein retained Kommando mehr gesendet

1606044946: New connection from 192.168.110.50 on port 1883.  
1606044946: New client connected from 192.168.110.50 as ioB-Pi4-Ue1-MQC2 (c1, k11, u'iobue').  
1606044946: No will message specified.  
1606044946: Sending CONNACK to ioB-Pi4-Ue1-MQC2 (0, 0)  
1606044946: Received PUBLISH from ioB-Pi4-Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (175 bytes))  
1606044946: Sending PUBLISH to ioBrokerPi3Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (175 bytes))  
1606044947: Received PUBLISH from ioB-Pi4-Ue1-MQC2 (d0, q0, r1, m0, 'javascript/0/presence/HomeState', ... (317 bytes))  
1606044947: Sending PUBLISH to ioBrokerPi3Ue1-MQC2 (d0, q0, r0, m0, 'javascript/0/presence/HomeState', ... (317 bytes))  
1606044947: Sending PUBLISH to 2ef702a0723c498f828c2939ebc02cbd (d0, q0, r0, m0, 'javascript/0/presence/HomeState', ... (317 bytes))  
1606044947: Received SUBSCRIBE from ioB-Pi4-Ue1-MQC2  
1606044947:     ioBroker/mqtt-command (QoS 0)  
1606044947: ioB-Pi4-Ue1-MQC2 0 ioBroker/mqtt-command  
1606044947: Sending SUBACK to ioB-Pi4-Ue1-MQC2  
1606044947: Received PUBLISH from ioB-Pi4-Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (176 bytes))  
1606044947: Sending PUBLISH to ioBrokerPi3Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (176 bytes))  
1606044947: Sending PUBLISH to ioB-Pi4-Ue1-MQC2 (d0, q0, r0, m0, 'ioBroker/mqtt-command', ... (176 bytes))  
1606044958: Received PINGREQ from ioB-Pi4-Ue1-MQC2  
1606044958: Sending PINGRESP to ioB-Pi4-Ue1-MQC2  
1606044969: Received PINGREQ from ioB-Pi4-Ue1-MQC2  
1606044969: Sending PINGRESP to ioB-Pi4-Ue1-MQC2  


### Bedeutung Kürzel
(d0, q0, r0, m0, ...
d - ??   
q - QoS  
r - retain  
m - ???  


