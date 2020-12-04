# Beschreibung

[MQTT](http://mqtt.org/) (Message Queue Telemetry Transport) ist ein schlankes Protokoll für die Kommunikation zwischen verschiedenen Geräten (M2M - machine-to-machine). Es benutzt das publisher-subscriber Modell um Nachrichten über das TCP / IP Protokoll zu senden. Die zentrale Stelle des Protokolls ist der MQTT-Server oder Broker, der Zugriff auf den publisher und den subscriber besitzt. Dieses Protokoll ist sehr simpel: ein kurzer Header ohne Integrität (deshalb setzt die Übermittlung auf TCP auf), legt der Struktur keinerlei Beschränkungen beim Code oder einem Datenbankschema auf. Die einzige Bedingung ist dass jedes Datenpaket eine Information zur Identifikation beinhalten muss. Diese Identifikationsinformation heißt Topic Name.

Das MQTT Protokoll benötigt einen Datenbroker. Dieses ist die zentrale Idee dieser Technologie. Alle Geräte senden ihre Daten nur zu diesem Broker und erhalten ihre Informationen auch nur von ihm. Nach dem Empfang des Paketes sendet der Broker es zu allen Geräten in dem Netzwerk, die es abonniert haben. Wenn ein Gerät etwas von dem Broker möchte, muss er das entsprechende Topic abonnieren. Topics entstehen dynamisch bei Abonnement oder beim Empfang eines Paketes mit diesem Topic. Nach dem Abonnement eines Topics braucht man nichts mehr zu tun. Deswegen sind Topics sehr bequem um verschiedenen Beziehungen zu organisieren: one-to-many, many-to-one and many-to-many.


*Erweiterung*
Dieser Adapter erweitert und normiert das Format der für einen Topic übertragenden Nachricht um spezielle Anforderungen für die Kopplung von ioBroker-Instanzen. Für einen Namespace oder State sollte eine Adapterinstanz die Masterrolle übernehmen. Diese ist dadurch gekennzeichnet, dass dieser Namspace oder State beim Start der Adapterinstanz gesendet und das retain-flag gesetzt ist. Ein Namespace wäre _**javascript.0.presence.\***_, ein State die entsprechende id.

**Wichtig:**
*   Es können nur iobmqtt-Instanzen gekoppelt werden, nicht erkannte Nachrichten werden ignoriert.
*   Primäre Aufgabe dieses Adapters ist die lose Kopplung von ioBroker-Installationen mit gegenseitiger Aktualisierung.

**ioBroker Message Format**
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


# Installation

Die Installation findet im Admin im Reiter _**Adapter**_ statt. In der Gruppe Kommunikation befindet sich eine Zeile **_MQTT Client ür das ioBroker Messageformat_**, dort wird über das (+)-Icon ganz rechts eine neue Instanz angelegt. 

[![](http://www.iobroker.net/wp-content/uploads//1-1024x342.png)](http://www.iobroker.net/wp-content/uploads//1.png) 

Ein pop-up Fenster erscheint mit den Installationsinformationen und schließt nach der Installation eigenständig. 

[![](http://www.iobroker.net/wp-content/uploads//2-300x153.png)](http://www.iobroker.net/wp-content/uploads//2.png)

Wenn alles klappt befindet sich anschließend unter dem Reiter _**Instanzen**_ die neu installierte **iobmqtt.0** Instanz.

[![](http://www.iobroker.net/wp-content/uploads//3-300x156.png)](http://www.iobroker.net/wp-content/uploads//3.png)  

# Konfiguration

## Broker
Da der Adapter nur als Client arbeitet, ist ein eigenständiger Broker erforderlich. Getestet wurde nur mit mosquitto, ob der ioBroker mqtt-Adapter als Broker geeignet ist, kann ich nicht beurteilen. Habe mich wegen der Ressourcentrennung für diese Variante entschieden.

## ioBroker iobmqtt Client
### Verbindungseinstellungen

*   **URL** - Name oder IP-Adresse des Brokers
*   **Port** - Der Port um mit TCP zu verbinden (default: 1883)
*   **User** - Der User für die Anmeldung beim Broker
*   **Password** - Das Passwort für die Anmeldung beim Broker (Achtung: wird in Klartext übertragen, SSL nicht getestet/aktiviert!)
*   **Test connection** - Schaltfläche zum Testen der Verbindung (bei laufender Instanz)

![](ioBroker_Adapter_MQTT_Konfig_Server_SSH.jpg)

### MQTT allgemeine Einstellungen
* **clientId** - eindeutige Client-Id für die Identifikation am Broker
* **Präfix für alle topics** - Wenn gesetzt, alle topics bekommen diesen als Präfix, z. B. prefix = "iobroker/": alle topics werden zu "**iobroker**/javascript/0/. Bei empfangenen topics wird dieser Präfix vor der weiteren Verarbeitung entfernt.
* **keepalive** - Dieser Wert ist ein Zeitintervall in Sekunden, in dem der Broker von jedem Client eine Nachricht erwartet. Wenn ein Client keine Nachricht in diesem Zeitfenster sendet, wird die Verbindung automatisch geschlossen. Der gesetzte Wert wird vom Broker mit 1,5 multipliziert, aus 10 Sekunden werden also 15. Ein Wert unter 10 sollte nicht gesetzt werden, maximal ist 65535 möglich (= 18,2 h).

* **Persistent Session** - betrifft QoS 1 und 2, der Client quittiert die Bestätigung des Empfangs durch den Broker, nicht getestet

* **Trace output for every message** - Debug outputs.
* **ignoriere eigene Nachrichten** - Wenn aktiv, werden selbst gesendete Nachrichten ignoriert, wenn auf diesen auch eine Subscription besteht.
* **komprimiere ab Nachrichtenlänge** - Wenn das ioBroker-Objekt größer als angegeben, dann wird es komprimiert, 0 = deaktiviert

### MQTT subscribe Einstellungen
*   **maximale topic Länge** - maximale Zeichenanzahl eines topics (wird mit nächster Version entfernt)
*   **Default QoS** - Quality of Service für die konfigurierten pattern, kann je pattern geändert werden.
*   **Tabelle mit pattern für das Abonnieren von eigenen States** - Diese pattern dienen zum Abonnieren von anderen Clients gesendeten topcis. Es gelten die Regeln für MQTT topics! Erlaubt Platzhalter sind + und #.
*   **Suchtiefe für Namspace eines States** - Bis zu dieser Tiefe muss ein Namespace existieren, um den empfangenen State in diesen Namespace zu schreiben. Ein Wert von 2 (minimum und Standard) bedeutet bei einem Empfangenen topic von z. B. _**javascript/0/presence/gustes**_, dass ein Objekt mit der ID _**javascript.0.presence**_ existieren muss (Suche beginnt mit Index = 0). Andernfalls wird die Nachricht in den Namespace des Adapters, also als _**iobmqtt.0.javascript.0.presence.gustes**_ geschrieben. Durch die gezielte Anlage von Objekten vom Typ _**channel**_ kann das Ziel also gesteuert werden.
*   **update common and native if given** - Wenn eine erhaltene Nachricht im Attribut "attr" common and native enthält, wird der entsprechende state aktualisiert
*   **Schreibe nur bei Änderung** - Wenn aktiv, wird das empfangene State-Objekt nur geschrieben, wenn der Wert, ack oder tc (letzte Änderung) von den vorhandenen Werten abweichen.

### MQTT publish Einstellungen
*   **Bekanntgabe eigene States beim Verbinden** - die konfiurierten und freigegebenen States werden beim Start des Adapters gesendet, unabhängig davon werden die maskierten States auch bei jeder Änderung (val, ack, tc) gesendet
*   **Default QoS** - Quality of Service für die konfigurierten Masken, kann je Maske geändert werden.
*   **retain flag** - Vorgabe für alle konfigurierten Masken, wenn gesetzt, werden alle States der konfigurierten Masken mit dem retain-flag gesendet, kann je Maske geändert werden
*   **send common and native** - Vorgabe für alle konfigurierten Masken, wenn aktiviert, werden von allen states zusätzlich die Properties "common" und "native" gesendet, kann für jede Maske geändert werden
*   **Tabelle mit Masken für Bekanntgeben von eigenen States** - Diese Masken dienen zum Subscriben von States, die an den Broker gesendet werden sollen. Es gelten die Regeln für States beim Subscribe, also nur "*" ist erlaubt. Ein "+" in der ID eines State wird transparent in "~" umgewandelt.
*   **Sende nur States mit ack=true** - Normally all states independent from the ack state will be sent to the broker. If this flag is set, only states with ackÜtrue will be sent. 
