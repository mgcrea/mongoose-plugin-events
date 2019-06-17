# mongoose-plugin-events

[![npm version](https://img.shields.io/npm/v/mongoose-plugin-events.svg)](https://www.npmjs.com/package/mongoose-plugin-events)
[![license](https://img.shields.io/github/license/mgcrea/mongoose-plugin-events.svg?style=flat)](https://tldrlegal.com/license/mit-license)
[![build status](http://img.shields.io/travis/mgcrea/mongoose-plugin-events/master.svg?style=flat)](http://travis-ci.org/mgcrea/mongoose-plugin-events)
[![dependencies status](https://img.shields.io/david/mgcrea/mongoose-plugin-events.svg?style=flat)](https://david-dm.org/mgcrea/mongoose-plugin-events)
[![devDependencies status](https://img.shields.io/david/dev/mgcrea/mongoose-plugin-events.svg?style=flat)](https://david-dm.org/mgcrea/mongoose-plugin-events#info=devDependencies)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/9766cf4c70c74694b7be0496d515c677)](https://www.codacy.com/app/olivier_5/mongoose-plugin-events?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=mgcrea/mongoose-plugin-events&amp;utm_campaign=Badge_Grade)
[![npm downloads](https://img.shields.io/npm/dm/mongoose-plugin-events.svg)](https://www.npmjs.com/package/mongoose-plugin-events)

React on database changes with document and models events

## Note

- **v2.x** for `mongoose@^5`
- **v1.x** for `mongoose@^4`

## Quickstart

- Load the plugin inside your schema

```js
import {Schema} from 'mongoose';
import eventsPlugin from 'mongoose-plugin-events';

const schema = new Schema({
  name: {type: String, required: true},
  content: {type: Object, default: {}}
});

// Add events
schema.plugin(eventsPlugin, {});

export default schema;
```

- Listen on document events

```js
const Device = mongoose.model('Device');
Device.on('created', ({_id}) => {
  log.info('Detected device="%s" creation', _id);
})
```

- Listen for field scoped events

```js
const Device = mongoose.model('Device');
Device.on('updated:lastSeen', ({query, operator, update}) => {
  const deviceId = update._id;
  log.info('Detected device="%s" lastSeen update', deviceId);
});
```

- Listen on schema events (eg. other plugins):

```js
schema.on('model:updated', ({query, update}, model) => {
  const updateActivities = [];
  if (update.name) {
    updateActivities.push(castUpdateActivity({
      code: ACTIVITY_CODES.DEVICE_RENAMED,
      context: {name: update.name}
    }));
  }
  if (updateActivities.length) {
    model.trackActivities(updateActivities);
  }
});

schema.on('model:removed', (doc, model) => {
  model.trackActivity({
    code: ACTIVITY_CODES.DEVICE_DELETED,
    context: {},
    target: doc._id,
    targetRef: 'Device',
    source: doc.removedBy,
    sourceRef: 'User'
  });
});
```

## Testing

- You can quickly start hacking around

```bash
git clone -o github git@github.com:mgcrea/mongoose-plugin-events.git
cd mongoose-plugin-events
npm i
npm test
```
