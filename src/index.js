import {get, isObject, isFunction} from 'lodash';
import relayMongoEvents from './relay';

export {relayMongoEvents};

const isObjectId = maybeObjectId => isObject(maybeObjectId) && isFunction(maybeObjectId.getTimestamp);

export default function eventsPlugin(schema, {ignoredPaths = ['updatedAt', 'createdAt']}) {
  //
  schema.pre('save', function preSave(next) {
    const doc = this;
    const model = doc.model(doc.constructor.modelName);
    const slowEmit = (...args) => setTimeout(() => model.emit(...args));
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

  function preUpdate(next) {
    const query = this.getQuery();
    const update = this.getUpdate().$set;
    const modifiedPaths = Object.keys(update || {});
    const model = this.model;
    const slowEmit = (...args) => setTimeout(() => model.emit(...args));
    if (modifiedPaths) {
      // d(this.getUpdate());
      slowEmit('updated', {...query, ...update});
      modifiedPaths.forEach((pathName) => {
        if (ignoredPaths.includes(pathName)) {
          return;
        }
        const eventKey = `updated:${pathName}`;
        if (query && isObjectId(query._id)) {
          slowEmit(eventKey, {_id: query._id, [pathName]: get(update, pathName)});
        } else {
          // d('@TODO', query, update)
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
    const slowEmit = (...args) => setTimeout(() => model.emit(...args));
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
