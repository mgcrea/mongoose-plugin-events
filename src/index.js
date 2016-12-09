import {get, isObject, isFunction} from 'lodash';

const isObjectId = maybeObjectId => isObject(maybeObjectId) && isFunction(maybeObjectId.getTimestamp);

export default function eventsPlugin(schema, {ignoredPaths = ['updatedAt', 'createdAt']}) {
  //
  schema.pre('save', function preSave(next) {
    const doc = this;
    const model = doc.model(doc.constructor.modelName);
    if (doc.isNew) {
      const object = doc.toObject();
      // d('emit:created', object);
      model.emit('created', object);
    } else {
      const modifiedPaths = doc.modifiedPaths();
      if (modifiedPaths) {
        const object = doc.toObject();
        // d('emit:updated', object);
        model.emit('updated', object);
        modifiedPaths.forEach((pathName) => {
          if (ignoredPaths.includes(pathName)) {
            return;
          }
          const eventKey = `updated:${pathName}`;
          // d(`emit:${eventKey}`, {_id: object._id, [pathName]: get(object, pathName)});
          model.emit(eventKey, {_id: object._id, [pathName]: get(object, pathName)});
        });
      }
    }
    next();
  });
  schema.pre('update', function preUpdate(next) {
    const query = this.getQuery();
    const update = this.getUpdate().$set;
    const modifiedPaths = Object.keys(update);
    const model = this.model(this.constructor.modelName);
    if (modifiedPaths) {
      model.emit('updated', {...query, ...update});
      modifiedPaths.forEach((pathName) => {
        if (ignoredPaths.includes(pathName)) {
          return;
        }
        const eventKey = `updated:${pathName}`;
        if (query && isObjectId(query._id)) {
          model.emit(eventKey, {_id: query._id, [pathName]: get(update, pathName)});
        } else {
          // d('@TODO', query, update)
        }
      });
    }
    next();
  });
  schema.pre('remove', function preRemove(next) {
    const doc = this;
    const model = doc.model(doc.constructor.modelName);
    const object = doc.toObject();
    // d('emit:removed', object);
    model.emit('removed', object);
  });
}
