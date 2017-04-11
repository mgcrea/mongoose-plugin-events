import {pull} from 'lodash';

const ucfirst = str => str.charAt(0).toUpperCase() + str.substr(1);

export default function relayMongoEvents({log = console, mongoClient, redisClient, schemas = [], debug}) {
  // static
  const eventListeners = {};
  const clearEventListener = (client, channel, callback) => {
    log.debug('Removing pmessage listener for channel="%s"', channel);
    pull(eventListeners[channel], callback);
    if (!eventListeners[channel].length) {
      log.debug('Socket punsubscribe on channel="%s"', channel);
      client.punsubscribe(channel);
    }
  };
  // Once the client enters the subscribed state it is not supposed to issue any other commands,
  // except for additional SUBSCRIBE, PSUBSCRIBE, UNSUBSCRIBE and PUNSUBSCRIBE commands.
  const subRedisClient = redisClient.duplicate();

  subRedisClient.setMaxListeners(0);
  subRedisClient.on('pmessage', (pattern, channel, message) => {
    if (eventListeners[pattern]) {
      let payload;
      try {
        payload = JSON.parse(message);
      } catch (err) {
        log.warn('Failed to parse JSON pmessage="%s" from channel="%s" Redis', message, channel);
      }
      eventListeners[pattern].forEach(callback => callback.call({eventName: channel}, payload));
    }
  });

  schemas.forEach((schemaName) => {
    const Model = mongoClient.model(ucfirst(schemaName));
    const parentEmit = Model.emit.bind(Model);
    Model.emit = (eventName, payload = {}) => {
      log.debug('Emitting relayed eventName="%s"', eventName);
      const parentReturn = parentEmit(eventName, payload, eventName);
      redisClient.publish(eventName, JSON.stringify(payload));
      return parentReturn;
    };
    Model.$on = (eventName, callback = () => {}) => {
      log.debug('Subscribing to relayed eventName="%s"', eventName);
      if (!eventListeners[eventName] || !eventListeners[eventName].length) {
        subRedisClient.psubscribe(eventName);
        eventListeners[eventName] = [];
      }
      eventListeners[eventName].push(callback);
      return () => {
        clearEventListener(subRedisClient, eventName, callback);
      };
    };
    Model.$once = function addOnceListener(eventName, callback = () => {}) {
      log.debug('Subscribing once to relayed eventName="%s"', eventName);
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
