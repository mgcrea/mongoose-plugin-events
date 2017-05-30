import {get, isObject, isFunction} from 'lodash';
import relayMongoEvents from './relay';

export {relayMongoEvents};

const isObjectId = maybeObjectId => isObject(maybeObjectId) && isFunction(maybeObjectId.getTimestamp);

export default function eventsPlugin(schema, {ignoredPaths = ['updatedAt', 'createdAt']}) {
  //
  schema.pre('save', function preSave(next) {
    const doc = this;
    const model = doc.model(doc.constructor.modelName);
    const slowEmit = (...args) => setTimeout(() => {
      schema.emit(...args.concat(model));
      model.emit(...args);
    });
    if (doc.isNew) {
      const object = doc.toObject();
      // d('emit:created', object);
      slowEmit('created', object);
    } else {
      const modifiedPaths = doc.modifiedPaths();
      if (modifiedPaths) {
        const object = doc.toObject();
        // d('emit:updated', object);
        slowEmit('updated', object);
        modifiedPaths.forEach((pathName) => {
          if (ignoredPaths.includes(pathName)) {
            return;
          }
          const eventKey = `updated:${pathName}`;
          // d(`emit:${eventKey}`, {_id: object._id, [pathName]: get(object, pathName)});
          slowEmit(eventKey, {_id: object._id, [pathName]: get(object, pathName)});
        });
      }
    }
    next();
  });

  const updateOperators = [
    '$inc', '$mul', '$rename', '$set', '$unset', '$min', '$max', '$addToSet', '$pop', '$pullAll', '$pull', '$pushAll', '$push'
  ];
  function preUpdate(next) {
    const query = this.getQuery();
    const update = this.getUpdate();
    const model = this.model;
    const wasUpdated = updateOperators.reduce((soFar, operator) =>
      soFar || (update[operator] && (Object.keys(update[operator]).length > 0))
    , false);
    if (wasUpdated) {
      const slowEmit = (...args) => setTimeout(() => {
        schema.emit(...args.concat(model));
        model.emit(...args);
      });
      // Flatten $set
      const flatUpdate = Object.keys(update).reduce((soFar, key) =>
        Object.assign(soFar, key === '$set' ? update[key] : {[key]: update[key]})
      , query && query._id ? {_id: query._id} : {});
      // Emit updated event
      slowEmit('updated', {query, update: flatUpdate});
      updateOperators.forEach((operator) => {
        if (update[operator]) {
          const modifiedPaths = Object.keys(update[operator]);
          modifiedPaths.forEach((pathName) => {
            if (ignoredPaths.includes(pathName)) {
              return;
            }
            const eventKey = `updated:${pathName}`;
            if (query && isObjectId(query._id)) {
              const fieldUpdate = {_id: query._id, [pathName]: get(update[operator], pathName)};
              slowEmit(eventKey, {query, operator, update: fieldUpdate});
            } else {
              // d('@TODO', query, update)
            }
          });
        }
      });
    }
    next();
  }
  schema.pre('update', preUpdate);
  schema.pre('findOneAndUpdate', preUpdate);

  schema.pre('remove', function preRemove(next) {
    const doc = this;
    const model = doc.model(doc.constructor.modelName);
    const slowEmit = (...args) => setTimeout(() => {
      schema.emit(...args.concat(model));
      model.emit(...args);
    });
    const object = doc.toObject();
    // d('emit:removed', object);
    slowEmit('removed', object);
    next();
  });

  // Prepare potential relays
  schema.statics.$on = function globalOn(eventName, callback = () => {}) {
    return this.on(eventName, callback);
  };
  schema.statics.$once = function globalOn(eventName, callback = () => {}) {
    return this.once(eventName, callback);
  };
}
