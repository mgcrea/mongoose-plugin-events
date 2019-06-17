import {get, initial, isObject, without, pick, isFunction, uniq} from 'lodash';
import relayMongoEvents from './relay';

export {relayMongoEvents};

const isObjectId = maybeObjectId => isObject(maybeObjectId) && isFunction(maybeObjectId.getTimestamp);

export default function eventsPlugin(schema, {ignoredPaths = ['updatedAt', 'createdAt']}) {
  //
  // Helper to emit on both model/document and schema for easier cross plugin interactions
  schema.methods.$emit = function emit(eventName, ...args) {
    this.schema.emit(`doc:${eventName}`, ...args.concat(this));
    return this.emit(eventName, ...args);
  };
  schema.statics.$emit = function emit(eventName, ...args) {
    this.schema.emit(`model:${eventName}`, ...args.concat(this));
    return this.emit(eventName, ...args);
  };

  // Handle document creation
  schema.pre('save', function preSave(next) {
    this.$wasNew = this.isNew;
    this.$wasModifiedPaths = this.modifiedPaths() || [];
    next();
  });
  schema.post('save', function postSave(doc, next) {
    const model = doc.model(doc.constructor.modelName);
    if (this.$wasNew) {
      const object = doc.toObject();
      // d('emit:created', object);
      model.$emit('created', object);
    } else {
      const modifiedPaths = without(this.$wasModifiedPaths, ...ignoredPaths);
      if (modifiedPaths.length) {
        // Build query/update pair exactly like an update
        const query = {_id: doc._id};
        const update = pick(doc.toObject(), modifiedPaths);
        update._id = query._id;
        // d('emit:updated', object);
        model.$emit('updated', {query, update});
        modifiedPaths.forEach(pathName => {
          const eventKey = `updated:${pathName}`;
          const emitUpdate = {...query, [pathName]: get(update, pathName)};
          model.$emit(eventKey, {query, operator: '$set', update: emitUpdate});
        });
      }
    }
    next();
  });

  const updateOperators = [
    '$inc',
    '$mul',
    '$rename',
    '$set',
    '$unset',
    '$min',
    '$max',
    '$addToSet',
    '$pop',
    '$pullAll',
    '$pull',
    '$pushAll',
    '$push'
  ];
  function preUpdate(next) {
    this.$wasQuery = this.getQuery();
    this.$wasUpdate = this.getUpdate();
    next();
  }
  function postUpdate(res, next) {
    const query = this.$wasQuery;
    const update = this.$wasUpdate;
    const {model} = this;
    const {overwrite} = this.options;
    const wasRawUpdate = !overwrite && Object.keys(update).some(key => !key.startsWith('$'));
    const wasUpdated =
      wasRawUpdate || updateOperators.some(operator => update[operator] && Object.keys(update[operator]).length > 0);
    if (wasUpdated) {
      const mongoUpdate = wasRawUpdate ? {$set: update} : update;
      // Flatten $set
      const flatUpdate = Object.keys(mongoUpdate).reduce(
        (soFar, key) => Object.assign(soFar, key === '$set' ? mongoUpdate[key] : {[key]: mongoUpdate[key]}),
        query && query._id ? {_id: query._id} : {}
      );
      const flatModifiedPaths = without(Object.keys(flatUpdate), ...ignoredPaths, '_id');
      if (flatModifiedPaths.length) {
        // Emit updated event
        model.$emit('updated', {query, update: flatUpdate});
      }
      updateOperators.forEach(operator => {
        if (mongoUpdate[operator]) {
          const modifiedPaths = without(Object.keys(mongoUpdate[operator]), ...ignoredPaths);
          const parentEvents = [];
          const parentEventsUpdates = {};
          modifiedPaths.forEach(pathName => {
            // Emit exact path event
            const eventKey = `updated:${pathName}`;
            const emitUpdate = {[pathName]: get(mongoUpdate[operator], pathName)};
            if (query && isObjectId(query._id)) {
              emitUpdate._id = query._id;
              model.$emit(eventKey, {query, operator, update: emitUpdate});
            } else {
              // d('@TODO', query, update)
            }
            // Compute parent path events
            const parentPathNames = initial(pathName.split('.')).reduce((soFar, pathNamePart) => {
              soFar.unshift(soFar[0] ? `${soFar}.${pathNamePart}` : pathNamePart);
              parentEventsUpdates[soFar[0]] = parentEventsUpdates[soFar[0]]
                ? {...parentEventsUpdates[soFar[0]], ...emitUpdate}
                : emitUpdate;
              return soFar;
            }, []);
            parentEvents.push(...parentPathNames);
          });
          // Emit parent path events
          uniq(parentEvents).forEach(pathName => {
            if (ignoredPaths.includes(pathName)) {
              return;
            }
            // Emit exact path event
            const eventKey = `updated:${pathName}`;
            if (query && isObjectId(query._id)) {
              // const fieldUpdate = {_id: query._id, [pathName]: get(update[operator], pathName)};
              model.$emit(eventKey, {query, operator, update: parentEventsUpdates[pathName]});
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
  schema.post('update', postUpdate);
  schema.post('findOneAndUpdate', postUpdate);

  schema.post('remove', {query: true}, function postRemove() {
    const doc = this;
    // Check if it's a single doc or multi docs which have been removed
    if (doc.toObject) {
      const model = doc.model(doc.constructor.modelName);
      model.$emit('removed', {query: doc.toObject()});
    } else {
      const query = doc.getQuery();
      doc.model.$emit('removed', {query});
    }
  });

  // Prepare potential relays
  schema.statics.$on = function modelOnListener(eventName, callback = () => {}) {
    return this.on(eventName, callback);
  };
  schema.$on = function schemaOnListener(eventName, callback = () => {}) {
    return this.on(eventName, callback);
  };
  schema.statics.$once = function modelOnceListener(eventName, callback = () => {}) {
    return this.once(eventName, callback);
  };
  schema.$once = function schemaOnceListener(eventName, callback = () => {}) {
    return this.once(eventName, callback);
  };
}
