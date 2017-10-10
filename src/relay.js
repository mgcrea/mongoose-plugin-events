import EJSON from 'mongodb-extended-json';
import {pull} from 'lodash';

const ucfirst = str => str.charAt(0).toUpperCase() + str.substr(1);

const RELAYED_EVENTS = [
  'created',
  /updated:?.*/,
  'deleted'
];

// @TODO
// test publish on one model do not impact other model!

export default function relayMongoEvents({
  log = console,
  logLevel = 'debug',
  mongoClient,
  redisClient,
  schemas = [],
  events = RELAYED_EVENTS,
  useExtendedJson = false
}) {
  // static
  const eventListeners = {};
  const clearEventListener = (client, channel, callback) => {
    log[logLevel]('Removing pmessage listener for channel="%s"', channel);
    pull(eventListeners[channel], callback);
    if (!eventListeners[channel].length) {
      log[logLevel]('Socket punsubscribe on channel="%s"', channel);
      client.punsubscribe(channel);
    }
  };
  const isRelayedEvent = eventName =>
    events.some(relayedEvent => (
      relayedEvent instanceof RegExp ? relayedEvent.test(eventName) : relayedEvent === eventName));
  // Once the client enters the subscribed state it is not supposed to issue any other commands,
  // except for additional SUBSCRIBE, PSUBSCRIBE, UNSUBSCRIBE and PUNSUBSCRIBE commands.
  const subRedisClient = redisClient.duplicate();

  subRedisClient.setMaxListeners(0);
  subRedisClient.on('pmessage', (pattern, channel, message) => {
    if (eventListeners[pattern]) {
      let payload;
      try {
        payload = (useExtendedJson ? EJSON : JSON).parse(message);
      } catch (err) {
        log.warn('Failed to parse JSON pmessage="%s" from channel="%s" Redis', message, channel);
      }
      if (payload) {
        eventListeners[pattern].forEach(callback => callback.call({eventName: channel}, payload));
      }
    }
  });

  schemas.forEach((schemaName) => {
    const Model = mongoClient.model(ucfirst(schemaName));
    const parentEmit = Model.emit.bind(Model);
    Model.emit = (eventName, payload = {}) => {
      const parentReturn = parentEmit(eventName, payload, eventName);
      if (!isRelayedEvent(eventName)) {
        return parentReturn;
      }
      log[logLevel]('Emitting relayed eventName="%s" for schema="%s"', eventName, schemaName);
      const patternName = `${schemaName}.${eventName}`;
      let message;
      try {
        message = (useExtendedJson ? EJSON : JSON).stringify(payload);
      } catch (err) {
        log.warn('Failed to stringify JSON payload for eventName="%s" for schema="%s"', eventName, schemaName);
      }
      if (message) {
        redisClient.publish(patternName, message);
      }
      return parentReturn;
    };
    Model.$on = (eventName, callback = () => {}) => {
      log[logLevel]('Subscribing to relayed eventName="%s" for schema="%s"', eventName, schemaName);
      const patternName = `${schemaName}.${eventName}`;
      if (!eventListeners[patternName] || !eventListeners[patternName].length) {
        subRedisClient.psubscribe(patternName);
        eventListeners[patternName] = [];
      }
      eventListeners[patternName].push(callback);
      return () => {
        clearEventListener(subRedisClient, patternName, callback);
      };
    };
    Model.$once = function addOnceListener(eventName, callback = () => {}) {
      log[logLevel]('Subscribing once to relayed eventName="%s" for schema="%s"', eventName, schemaName);
      const clearListener = this.$on(eventName, (...args) => {
        callback(...args);
        clearListener();
      });
      return () => {
        clearListener();
      };
    };
  });
}
