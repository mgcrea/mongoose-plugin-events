import {Schema} from 'mongoose';
import eventsPlugin from '../../src';

const schema = new Schema({
  name: {type: String, required: true},
  content: {type: Object, default: {}},
  count: {type: Number}
});

schema.plugin(eventsPlugin, {ignoredPaths: ['updatedAt', 'createdAt', 'count']});

export default schema;
